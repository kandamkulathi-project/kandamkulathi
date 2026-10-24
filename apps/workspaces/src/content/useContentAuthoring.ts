import type { ClientSession } from "@kandamkulathi/contracts/client";
import type { KnowledgeRecord } from "@kandamkulathi/contracts/knowledge";
import { useEffect, useRef, useState } from "react";
import { type AuthoringAttemptState, createAuthoringLane } from "./authoring-attempt";
import { type AuthoringCommand, persistedTransition } from "./authoring-dto";
import {
  type AuthoringPermission,
  type ContentAuthoringPort,
  loadSourceAuthorization,
  mutationBody,
  type SourceAuthorization,
} from "./authoring-port";
import type { ContentReader, ContentState } from "./model";

export function useContentAuthoring(
  port: ContentAuthoringPort | undefined,
  session: ClientSession,
  record: KnowledgeRecord,
  readCurrent: ContentReader,
  update: (state: ContentState) => void,
) {
  const [authority, setAuthority] = useState<{
    status: "pending" | "loading" | "ready" | "denied" | "error";
    grants: Partial<Record<AuthoringPermission, SourceAuthorization>>;
  }>({ status: port ? "loading" : "pending", grants: {} });
  const [progress, setProgress] = useState<"checking" | "submitting" | "reloading" | null>(null);
  const lane = useRef<ReturnType<typeof createAuthoringLane> | null>(null);
  const updateRef = useRef(update);
  updateRef.current = update;
  useEffect(() => () => lane.current?.invalidate(), []);
  useEffect(() => {
    if (!port) return;
    const controller = new AbortController();
    let live = true;
    setAuthority({ status: "loading", grants: {} });
    const timeout = setTimeout(() => {
      live = false;
      controller.abort();
      setAuthority({ status: "error", grants: {} });
    }, 5000);
    const permissions: AuthoringPermission[] =
      record.state === "draft"
        ? ["edit", "approve"]
        : record.state === "approved"
          ? ["edit", "withdraw"]
          : ["edit"];
    void Promise.all(
      permissions.map(async (permission) => ({
        permission,
        grant: await loadSourceAuthorization(
          port,
          { session, record, permission },
          controller.signal,
        ),
      })),
    )
      .then((results) => {
        if (!live) return;
        const grants: Partial<Record<AuthoringPermission, SourceAuthorization>> = {};
        for (const result of results) if (result.grant) grants[result.permission] = result.grant;
        setAuthority({ status: Object.keys(grants).length ? "ready" : "denied", grants });
      })
      .catch(() => {
        if (live) setAuthority({ status: "error", grants: {} });
      })
      .finally(() => clearTimeout(timeout));
    return () => {
      live = false;
      controller.abort();
      clearTimeout(timeout);
    };
  }, [port, record, session]);
  useEffect(() => {
    const expiry = Math.min(
      ...Object.values(authority.grants).map((grant) =>
        Math.min(Date.parse(grant.expiresAt), Date.parse(session.expiresAt)),
      ),
    );
    if (!Number.isFinite(expiry)) return;
    let timer: ReturnType<typeof setTimeout>;
    const check = () => {
      const remaining = expiry - Date.now();
      if (remaining <= 0) {
        lane.current?.invalidate();
        updateRef.current({ status: "denied" });
      } else timer = setTimeout(check, Math.min(remaining, 2147483647));
    };
    check();
    return () => clearTimeout(timer);
  }, [authority, session.expiresAt]);
  const permitted = (permission: AuthoringPermission) => {
    const grant = authority.grants[permission];
    return Boolean(
      port &&
        !progress &&
        grant &&
        Date.parse(grant.expiresAt) > Date.now() &&
        Date.parse(session.expiresAt) > Date.now(),
    );
  };
  const start = (command: AuthoringCommand) => {
    if (!port || !permitted(command.action) || lane.current) return;
    const publish = (state: AuthoringAttemptState) => {
      if (
        state.status === "checking" ||
        state.status === "submitting" ||
        state.status === "reloading"
      )
        setProgress(state.status);
      else if (state.status === "ready")
        updateRef.current({ status: "ready", record: state.record });
      else updateRef.current({ status: state.status });
    };
    lane.current = createAuthoringLane(publish);
    void lane.current.run({
      checkCurrentAuthority: async (signal) =>
        Boolean(
          await loadSourceAuthorization(
            port,
            { session, record, permission: command.action },
            signal,
          ),
        ),
      submit: async (signal) => mutationBody(await port.submit(command, signal)),
      persistedRecord: (response) => persistedTransition(response, command, record, session.userId),
      readCurrent,
    });
  };
  return {
    authority: authority.status,
    permitted,
    start,
    progress,
    hasAttempted: () => lane.current !== null,
  };
}
