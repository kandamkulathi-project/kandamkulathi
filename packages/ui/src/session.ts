import { loadSession, type Resource } from "@kandamkulathi/client";
import type { ClientSession } from "@kandamkulathi/contracts/client";
import { useCallback, useEffect, useRef, useState } from "react";

/** Clears private UI on background/navigation and revalidates; no persisted credentials. */
export function useSession(origin: string, local: boolean) {
  const [attempt, setAttempt] = useState(0);
  const latestAttempt = useRef(attempt);
  latestAttempt.current = attempt;
  const [result, setResult] = useState<Resource<ClientSession>>({ status: "loading" });
  const reload = useCallback(() => setAttempt((value) => value + 1), []);
  useEffect(() => {
    const controller = new AbortController();
    setResult({ status: "loading" });
    if (document.hidden) return () => controller.abort();
    let expiry: ReturnType<typeof setTimeout> | undefined;
    const timeout = setTimeout(() => {
      controller.abort();
      setResult({ status: "error" });
    }, 5000);
    void loadSession(origin, local, controller.signal).then((value) => {
      if (controller.signal.aborted || document.hidden || latestAttempt.current !== attempt) return;
      clearTimeout(timeout);
      setResult(value);
      if (value.status === "ready")
        expiry = setTimeout(
          reload,
          Math.min(2147483647, Math.max(0, Date.parse(value.data.expiresAt) - Date.now())),
        );
    });
    return () => {
      controller.abort();
      clearTimeout(timeout);
      clearTimeout(expiry);
    };
  }, [origin, local, attempt, reload]);
  useEffect(() => {
    const invalidate = () => {
      setResult({ status: "loading" });
      reload();
    };
    document.addEventListener("visibilitychange", invalidate);
    window.addEventListener("pageshow", invalidate);
    return () => {
      document.removeEventListener("visibilitychange", invalidate);
      window.removeEventListener("pageshow", invalidate);
    };
  }, [reload]);
  return { result, reload };
}
