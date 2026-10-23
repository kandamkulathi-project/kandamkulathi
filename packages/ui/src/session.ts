import { loadSession, type Resource } from "@kandamkulathi/client";
import type { ClientSession } from "@kandamkulathi/contracts/client";
import { useCallback, useEffect, useRef, useState } from "react";

/** Clears private UI on background/navigation and revalidates; no persisted credentials. */
export function useSession(origin: string, local: boolean) {
  const [attempt, setAttempt] = useState(0);
  const [blocked, setBlocked] = useState(false);
  const blockedRef = useRef(false);
  const latestAttempt = useRef(attempt);
  const [result, setResult] = useState<Resource<ClientSession>>({ status: "loading" });
  const revalidate = useCallback(() => {
    if (blockedRef.current) return;
    setResult({ status: "loading" });
    setAttempt(++latestAttempt.current);
  }, []);
  // Only an explicit user retry may clear a local logout/revocation block.
  const reload = useCallback(() => {
    blockedRef.current = false;
    setBlocked(false);
    revalidate();
  }, [revalidate]);
  const invalidate = useCallback(() => {
    blockedRef.current = true;
    latestAttempt.current++;
    setBlocked(true);
    setResult({ status: "anonymous" });
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    if (blocked) return () => controller.abort();
    setResult({ status: "loading" });
    if (document.hidden) return () => controller.abort();
    let expiry: ReturnType<typeof setTimeout> | undefined;
    const timeout = setTimeout(() => {
      if (blockedRef.current || latestAttempt.current !== attempt) return;
      controller.abort();
      setResult({ status: "error" });
    }, 5000);
    void loadSession(origin, local, controller.signal).then((value) => {
      if (
        blockedRef.current ||
        controller.signal.aborted ||
        document.hidden ||
        latestAttempt.current !== attempt
      )
        return;
      clearTimeout(timeout);
      setResult(value);
      if (value.status === "ready")
        expiry = setTimeout(
          revalidate,
          Math.min(2147483647, Math.max(0, Date.parse(value.data.expiresAt) - Date.now())),
        );
    });
    return () => {
      controller.abort();
      clearTimeout(timeout);
      clearTimeout(expiry);
    };
  }, [origin, local, attempt, revalidate, blocked]);
  useEffect(() => {
    document.addEventListener("visibilitychange", revalidate);
    window.addEventListener("pageshow", revalidate);
    return () => {
      document.removeEventListener("visibilitychange", revalidate);
      window.removeEventListener("pageshow", revalidate);
    };
  }, [revalidate]);
  return { result, reload, invalidate };
}
