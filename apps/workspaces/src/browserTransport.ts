import { type ClientSession, sessionSchema } from "@kandamkulathi/contracts/client";
import { securityContextSchema } from "@kandamkulathi/contracts/sensitive";

/** One root-owned, verified session epoch; never an authorization or role-grant source.
 * Core only: a separate Companion host cannot inherit Core's host cookie/context.
 */
export function createWorkspaceBrowserTransport(options: {
  origin: string;
  local: boolean;
  session: ClientSession;
  active: () => boolean;
  onRevoked: () => void;
  transport?: typeof fetch;
}): {
  transport: typeof fetch;
  authorizeMutation(signal: AbortSignal): Promise<HeadersInit>;
  dispose(): void;
} {
  const origin = new URL(options.origin);
  if (
    origin.origin !== options.origin ||
    origin.username ||
    origin.password ||
    !(
      origin.protocol === "https:" ||
      (options.local &&
        origin.protocol === "http:" &&
        ["localhost", "127.0.0.1"].includes(origin.hostname))
    )
  )
    throw new Error("Invalid browser API origin");
  const session = sessionSchema.parse(options.session);
  const expiresAt = Date.parse(session.expiresAt);
  const underlying = options.transport ?? fetch;
  const pending = new Set<AbortController>();
  let disposed = false;
  let revoked = false;
  let sessionId: string | undefined;
  let expiry: ReturnType<typeof setTimeout>;
  const dispose = () => {
    disposed = true;
    clearTimeout(expiry);
    for (const controller of pending) controller.abort();
  };
  const revoke = () => {
    dispose();
    if (!revoked) {
      revoked = true;
      options.onRevoked();
    }
  };
  const scheduleExpiry = () => {
    const remaining = expiresAt - Date.now();
    if (remaining <= 0) revoke();
    else expiry = setTimeout(scheduleExpiry, Math.min(remaining, 2147483647));
  };
  scheduleExpiry();
  const guard = (signal: AbortSignal) => {
    signal.throwIfAborted();
    if (Date.now() >= expiresAt) revoke();
    if (disposed || !options.active()) throw new DOMException("Inactive session", "AbortError");
  };
  /** Lifecycle permit for consumers requiring AuthoritativeTransport; MUST be paired
   * with this instance's transport, never raw fetch. This is not CSRF proof: the
   * paired transport alone reads fresh context and adds CSRF immediately before POST.
   */
  const authorizeMutation = async (signal: AbortSignal): Promise<HeadersInit> => {
    guard(signal);
    return {};
  };
  const transport: typeof fetch = async (input, init) => {
    const raw = input instanceof Request ? input.url : String(input);
    const url = new URL(raw);
    if (
      url.href !== raw ||
      url.origin !== origin.origin ||
      url.username ||
      url.password ||
      url.hash ||
      raw.includes("#") ||
      !/^\/v1\/[A-Za-z0-9_/-]+$/.test(url.pathname) ||
      new Set(url.searchParams.keys()).size !== [...url.searchParams.keys()].length
    )
      throw new Error("Invalid browser API URL");
    const request = new Request(input, init);
    if (
      !["GET", "POST"].includes(request.method) ||
      request.headers.has("authorization") ||
      request.headers.has("proxy-authorization") ||
      request.headers.has("x-csrf-token")
    )
      throw new Error("Invalid browser API request");
    const controller = new AbortController();
    const abort = () => controller.abort(request.signal.reason);
    request.signal.addEventListener("abort", abort, { once: true });
    if (request.signal.aborted) abort();
    pending.add(controller);
    const check = () => guard(controller.signal);
    try {
      check();
      const headers = new Headers(request.headers);
      let contextExpiry: number | undefined;
      if (request.method === "POST") {
        const response = await underlying(`${origin.origin}/v1/security/context`, {
          method: "GET",
          credentials: "include",
          cache: "no-store",
          redirect: "error",
          signal: controller.signal,
        });
        check();
        if (response.status === 401) revoke();
        if (!response.ok) throw new Error("Security context unavailable");
        const parsed = securityContextSchema.safeParse(await response.json());
        check();
        if (!parsed.success) throw new Error("Invalid security context");
        const context = parsed.data;
        contextExpiry = Date.parse(context.expiresAt);
        if (
          context.userId !== session.userId ||
          contextExpiry <= Date.now() ||
          contextExpiry > expiresAt ||
          (sessionId !== undefined && context.sessionId !== sessionId)
        )
          throw new Error("Security context does not match session");
        sessionId = context.sessionId;
        headers.set("X-CSRF-Token", context.csrfToken);
      }
      check();
      if (contextExpiry !== undefined && Date.now() >= contextExpiry)
        throw new Error("Security context expired");
      const response = await underlying(request, {
        headers,
        credentials: "include",
        cache: "no-store",
        redirect: "error",
        signal: controller.signal,
      });
      check();
      if (contextExpiry !== undefined && Date.now() >= contextExpiry)
        throw new Error("Security context expired");
      if (response.status === 401) revoke();
      return response;
    } finally {
      pending.delete(controller);
      request.signal.removeEventListener("abort", abort);
    }
  };
  return { transport, authorizeMutation, dispose };
}
