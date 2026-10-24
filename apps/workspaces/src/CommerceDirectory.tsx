/// <reference types="vite/client" />
import { type Resource, workspaceAccess } from "@kandamkulathi/client";
import type { ClientSession } from "@kandamkulathi/contracts/client";
import { foundation, type Locale } from "@kandamkulathi/i18n";
import { Button, Notice } from "@kandamkulathi/ui";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  commerceClinicsSchema,
  commerceStaffClinicsSchema,
} from "../../../packages/contracts/src/commerce-clinics";
import { staffReadLabels } from "../../../packages/i18n/src/staff-read";
import { createCommerceStaffReader, type StaffReader, StaffReadViews } from "./staff";

export type CommerceClinic = ReturnType<typeof commerceClinicsSchema.parse>["items"][number];
export type CommerceStaffClinic = ReturnType<
  typeof commerceStaffClinicsSchema.parse
>["items"][number];
export type CommerceDirectoryResult =
  | { status: "ready"; items: (CommerceClinic | CommerceStaffClinic)[] }
  | { status: "loading" | "empty" | "error" | "denied" | "anonymous" | "unavailable" };
export interface CommerceDirectoryOptions {
  origin: string;
  local: boolean;
  staff: boolean;
  /** Root-owned verified browser transport. Never defaults to raw fetch. */
  transport: typeof fetch;
}

/** Public checkout references use approved location IDs, never clinic routing IDs. */
export function commerceLocations(items: readonly CommerceClinic[]) {
  const locations = new Map<string, string>();
  for (const clinic of items) {
    const previous = locations.get(clinic.locationId);
    if (previous !== undefined && previous !== clinic.name)
      throw new Error("Ambiguous location title");
    locations.set(clinic.locationId, clinic.name);
  }
  return [...locations].map(([reference, title]) => ({ reference, title }));
}

export async function readCommerceClinics(
  options: CommerceDirectoryOptions,
  signal: AbortSignal,
): Promise<CommerceDirectoryResult> {
  try {
    signal.throwIfAborted();
    const url = new URL(options.origin);
    if (
      url.origin !== options.origin ||
      url.username ||
      url.password ||
      !(
        url.protocol === "https:" ||
        (options.local &&
          url.protocol === "http:" &&
          ["localhost", "127.0.0.1"].includes(url.hostname))
      )
    )
      return { status: "error" };
    const response = await options.transport(
      `${options.origin}/v1/${options.staff ? "staff/" : ""}commerce/clinics`,
      {
        method: "GET",
        credentials: "include",
        cache: "no-store",
        redirect: "error",
        headers: { Accept: "application/json" },
        signal,
      },
    );
    signal.throwIfAborted();
    if (response.status === 401) return { status: "anonymous" };
    if (response.status === 403) return { status: "denied" };
    if (response.status === 503) return { status: "unavailable" };
    if (
      response.status !== 200 ||
      !/^application\/json(?:\s*;|$)/i.test(response.headers.get("content-type") ?? "")
    )
      return { status: "error" };
    // Bound the streamed bytes as well as the declared size; do not buffer arbitrary payloads.
    const maxBytes = 128 * 1024;
    const length = response.headers.get("content-length");
    if (length !== null && (!/^\d+$/.test(length) || Number(length) > maxBytes))
      return { status: "error" };
    const reader = response.body?.getReader();
    if (!reader) return { status: "error" };
    const decoder = new TextDecoder("utf-8", { fatal: true });
    let text = "";
    let bytes = 0;
    const cancel = () => {
      void reader.cancel().catch(() => {});
    };
    signal.addEventListener("abort", cancel, { once: true });
    try {
      while (true) {
        signal.throwIfAborted();
        const chunk = await reader.read();
        signal.throwIfAborted();
        if (chunk.done) break;
        bytes += chunk.value.byteLength;
        if (bytes > maxBytes) {
          await reader.cancel();
          return { status: "error" };
        }
        text += decoder.decode(chunk.value, { stream: true });
      }
      text += decoder.decode();
    } finally {
      signal.removeEventListener("abort", cancel);
      reader.releaseLock();
    }
    const schema = options.staff ? commerceStaffClinicsSchema : commerceClinicsSchema;
    const { items } = schema.parse(JSON.parse(text));
    if (new Set(items.map((clinic) => clinic.clinicId)).size !== items.length)
      return { status: "error" };
    commerceLocations(items);
    return items.length ? { status: "ready", items } : { status: "empty" };
  } catch {
    return { status: "error" };
  }
}

/** Enable only inside the root's verified, current browser-transport epoch. */
export function useCommerceClinics(
  options: Omit<CommerceDirectoryOptions, "transport"> & {
    enabled: boolean;
    transport?: typeof fetch;
  },
) {
  const { origin, local, staff, enabled, transport } = options;
  const [revision, setRevision] = useState(0);
  const [active, setActive] = useState(true);
  const request = useMemo(
    () => ({ origin, local, staff, enabled, transport, revision, active }),
    [origin, local, staff, enabled, transport, revision, active],
  );
  const [snapshot, setSnapshot] = useState<{
    request: typeof request;
    result: CommerceDirectoryResult;
  }>();
  const reload = useCallback(() => setRevision((value) => value + 1), []);
  useEffect(() => {
    const hide = () => {
      setActive(false);
      setSnapshot(undefined);
    };
    const visibility = () => {
      if (document.hidden) hide();
    };
    window.addEventListener("pagehide", hide);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      window.removeEventListener("pagehide", hide);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, []);
  useEffect(() => {
    if (!enabled || !transport || !active) return;
    const controller = new AbortController();
    let current = true;
    const timer = setTimeout(() => {
      current = false;
      controller.abort();
      setSnapshot({ request, result: { status: "error" } });
    }, 5000);
    void readCommerceClinics({ origin, local, staff, transport }, controller.signal).then(
      (result) => {
        if (current) setSnapshot({ request, result });
        clearTimeout(timer);
      },
    );
    return () => {
      current = false;
      clearTimeout(timer);
      controller.abort();
    };
  }, [request, enabled, transport, active, origin, local, staff]);
  const result: CommerceDirectoryResult =
    !enabled || !transport || !active
      ? { status: "unavailable" }
      : snapshot?.request === request
        ? snapshot.result
        : { status: "loading" };
  const locations = useMemo(
    () => (result.status === "ready" ? commerceLocations(result.items) : []),
    [result],
  );
  return { result, locations, reload };
}

/** Presentation filtering only. Core must reauthorize each clinic/action read. */
export function guardCommerceStaffReader(
  clinic: CommerceStaffClinic,
  reader: StaffReader,
): StaffReader {
  return (kind, input, signal) => {
    if (kind === "schedules") return Promise.resolve({ status: "unavailable" });
    if (!clinic.actions.includes(kind === "orders" ? "orders:read" : "stock:read"))
      return Promise.resolve({ status: "denied" });
    return reader(kind, input, signal);
  };
}

export function StaffCommerceWorkspace({
  origin,
  local,
  transport,
  session,
  locale = "en",
}: {
  origin: string;
  local: boolean;
  transport?: typeof fetch;
  session: Resource<ClientSession>;
  locale?: Locale;
}) {
  const text = staffReadLabels[locale];
  const enabled = session.status === "ready" && workspaceAccess(session.data, "staff");
  const { result, reload } = useCommerceClinics({
    origin,
    local,
    staff: true,
    enabled,
    ...(transport ? { transport } : {}),
  });
  const [selection, setSelection] = useState<{ owner: typeof result; id: string }>();
  const clinic =
    result.status === "ready" && selection?.owner === result
      ? result.items.find(
          (item): item is CommerceStaffClinic =>
            item.clinicId === selection.id && "actions" in item,
        )
      : undefined;
  const reader = useMemo(
    () =>
      clinic && transport
        ? guardCommerceStaffReader(
            clinic,
            createCommerceStaffReader(
              {
                origin,
                local,
                clinicId: clinic.clinicId,
                locationId: clinic.locationId,
                clinicName: clinic.name,
              },
              transport,
            ),
          )
        : undefined,
    [clinic, transport, origin, local],
  );
  const status = !enabled
    ? session.status === "ready"
      ? "denied"
      : session.status
    : result.status;
  return (
    <section className="staff-read" data-commerce-directory-state={status}>
      <h2>{text.clinic}</h2>
      {status !== "ready" && (
        <Notice error={status === "error" || status === "denied"}>{text[status]}</Notice>
      )}
      <Button onClick={reload} disabled={status === "loading"}>
        {text.refresh}
      </Button>
      {result.status === "ready" && enabled && (
        <label>
          {text.clinic}{" "}
          <select
            data-testid="staff-clinic-select"
            value={clinic?.clinicId ?? ""}
            onChange={(event) => setSelection({ owner: result, id: event.target.value })}
          >
            <option value="">{foundation[locale].pending}</option>
            {result.items.map((item) => (
              <option key={item.clinicId} value={item.clinicId}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
      )}
      {reader && clinic ? (
        <StaffReadViews key={clinic.clinicId} session={session} locale={locale} reader={reader} />
      ) : (
        status === "ready" && <Notice>{foundation[locale].pending}</Notice>
      )}
    </section>
  );
}
