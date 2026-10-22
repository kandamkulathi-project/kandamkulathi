import { currentAnswer } from "@kandamkulathi/client/knowledge";
import type { SensitiveClient } from "@kandamkulathi/client/sensitive";
import {
  type ApprovedEntry,
  type KnowledgeReply,
  publicSourceUrl,
} from "@kandamkulathi/contracts/knowledge";
import { foundation, type Locale } from "@kandamkulathi/i18n";
import { knowledgeText } from "@kandamkulathi/i18n/knowledge";
import { sensitiveText } from "@kandamkulathi/i18n/sensitive";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import { Button, Field, Notice } from "./index";

export function CompanionShell({
  client,
  locale,
  draft,
  onDraft,
}: {
  client: SensitiveClient | undefined;
  locale: Locale;
  draft: string;
  onDraft(value: string): void;
}) {
  const text = knowledgeText[locale];
  const [state, setState] = useState("pending");
  const [entries, setEntries] = useState<ApprovedEntry[]>([]);
  const [reply, setReply] = useState<KnowledgeReply>();
  const busy = useRef(false);
  const epoch = useRef(0);
  const operation = useRef<{ text: string; id: string } | undefined>(undefined);
  const handoffId = useRef<string | undefined>(undefined);
  useEffect(() => {
    const clear = () => {
      epoch.current++;
      setEntries([]);
      setReply(undefined);
      operation.current = undefined;
      handoffId.current = undefined;
      onDraft("");
    };
    document.addEventListener("visibilitychange", clear);
    window.addEventListener("pagehide", clear);
    return () => {
      epoch.current++;
      document.removeEventListener("visibilitychange", clear);
      window.removeEventListener("pagehide", clear);
    };
  }, [onDraft]);
  async function display(value: KnowledgeReply, attempt: number) {
    if (!client || attempt !== epoch.current) return;
    setEntries([]);
    if (value.locale !== locale) {
      setState("error");
      return;
    }
    setReply(value);
    if (value.kind !== "answer") {
      setState(value.kind);
      return;
    }
    const result = await currentAnswer(client, value);
    if (attempt !== epoch.current) return;
    if (result.status === "ready") {
      setEntries(result.data);
      setState("ready");
    } else setState("unavailable");
  }
  async function refreshAnswer() {
    if (!reply || busy.current) return;
    busy.current = true;
    const attempt = ++epoch.current;
    setState("loading");
    try {
      await display(reply, attempt);
    } finally {
      busy.current = false;
    }
  }
  const recheck = useEffectEvent(() => {
    void refreshAnswer();
  });
  useEffect(() => {
    if (!entries.length) return;
    const expiry = setTimeout(
      () => {
        setEntries([]);
        setState("unavailable");
      },
      Math.min(
        2147483647,
        Math.max(
          0,
          Math.min(...entries.map((entry) => Date.parse(entry.reviewUntil))) - Date.now(),
        ),
      ),
    );
    const timer = setInterval(recheck, 30000);
    return () => {
      clearTimeout(expiry);
      clearInterval(timer);
    };
  }, [entries]);
  const message =
    state === "queued"
      ? text.queued
      : state === "intake_required"
        ? text.intake
        : state === "action_required"
          ? text.actions
          : state === "ready"
            ? text.citations
            : ["unavailable", "handoff_required"].includes(state)
              ? text.fallback
              : sensitiveText[locale][
                  state === "loading"
                    ? "loading"
                    : state === "denied"
                      ? "denied"
                      : state === "anonymous"
                        ? "anonymous"
                        : state === "unknown" ||
                            state === "conflict" ||
                            state === "expired" ||
                            state === "busy" ||
                            state === "error"
                          ? state
                          : "pending"
                ];
  return (
    <section aria-label={foundation[locale].companion} data-chat-state={state}>
      <h2>{foundation[locale].companion}</h2>
      <Notice>{client ? message : foundation[locale].citationPending}</Notice>
      <Field
        id="message-draft"
        label={foundation[locale].draft}
        help={text.voice}
        value={draft}
        disabled={state === "loading"}
        onChange={(value) => {
          epoch.current++;
          onDraft(value);
          setEntries([]);
          setReply(undefined);
          setState("pending");
        }}
      />
      <Button
        disabled={!client || !draft.trim() || state === "loading"}
        onClick={async () => {
          if (!client || busy.current) return;
          busy.current = true;
          const attempt = ++epoch.current;
          setState("loading");
          setEntries([]);
          if (!operation.current || operation.current.text !== draft)
            operation.current = { text: draft, id: crypto.randomUUID() };
          try {
            const result = await client.chat({
              operationId: operation.current.id,
              message: draft,
              locale,
            });
            if (attempt !== epoch.current) return;
            if (result.status === "ready") await display(result.data, attempt);
            else {
              setReply(undefined);
              setState(result.status);
            }
          } finally {
            busy.current = false;
          }
        }}
      >
        {client ? text.send : foundation[locale].sendPending}
      </Button>
      {client && (
        <Button
          disabled={state === "loading"}
          onClick={async () => {
            if (busy.current) return;
            busy.current = true;
            const attempt = ++epoch.current;
            setState("loading");
            setEntries([]);
            setReply(undefined);
            handoffId.current ??= crypto.randomUUID();
            try {
              const result = await client.requestHandoff(handoffId.current, locale);
              if (attempt === epoch.current)
                setState(result.status === "ready" ? "queued" : result.status);
            } finally {
              busy.current = false;
            }
          }}
        >
          {text.handoff}
        </Button>
      )}
      {client &&
        entries.map((entry) => (
          <article key={entry.id} data-approved-revision={entry.revision}>
            <h3>{entry.document.title}</h3>
            <p>{entry.document.body}</p>
            <p>
              {text.approver}: {entry.approvedBy?.displayName}
            </p>
            {Object.entries(entry.document.safety).map(
              ([name, value]) =>
                value && (
                  <p key={name} data-safety-block={name}>
                    {value}
                  </p>
                ),
            )}
            <a
              href={publicSourceUrl(entry.document.sourceUrl) ?? undefined}
              target="_blank"
              rel="noopener noreferrer"
              referrerPolicy="no-referrer"
            >
              {text.citations}: {new URL(entry.document.sourceUrl).hostname} · v{entry.revision}
            </a>
          </article>
        ))}
      {client && reply?.kind === "answer" && (
        <Button disabled={state === "loading"} onClick={() => void refreshAnswer()}>
          {text.refresh}
        </Button>
      )}
    </section>
  );
}
