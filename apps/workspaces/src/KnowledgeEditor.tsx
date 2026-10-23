import { type SensitiveResult, sensitiveClient } from "@kandamkulathi/client/sensitive";
import type { ClientSession } from "@kandamkulathi/contracts/client";
import {
  type KnowledgeDocument,
  type KnowledgeDraft,
  publicSourceUrl,
  reviewReady,
  saveDraftSchema,
} from "@kandamkulathi/contracts/knowledge";
import { referenceSchema } from "@kandamkulathi/contracts/sensitive";
import { type Locale, localeNames, locales } from "@kandamkulathi/i18n";
import { knowledgeText } from "@kandamkulathi/i18n/knowledge";
import { sensitiveText } from "@kandamkulathi/i18n/sensitive";
import { Button, Notice } from "@kandamkulathi/ui";
import { useEffect, useMemo, useRef, useState } from "react";
import { createKnowledgeRecovery, type SaveAttempt } from "./knowledgeRecovery";

const recoveryText = {
  en: {
    retry: "Retry the same draft save",
    help: "The save is unconfirmed. Fields are locked; retry sends the same draft and operation, not a new draft.",
  },
  ml: {
    retry: "അതേ ഡ്രാഫ്റ്റ് സേവ് വീണ്ടും ശ്രമിക്കുക",
    help: "സേവ് സ്ഥിരീകരിച്ചിട്ടില്ല. വിവരങ്ങൾ മാറ്റാനാകില്ല; വീണ്ടും ശ്രമിക്കുമ്പോൾ അതേ ഡ്രാഫ്റ്റും നടപടിയും അയക്കും, പുതിയ ഡ്രാഫ്റ്റല്ല.",
  },
  ta: {
    retry: "அதே வரைவு சேமிப்பை மீண்டும் முயற்சிக்கவும்",
    help: "சேமிப்பு உறுதியாகவில்லை. புலங்களை மாற்ற முடியாது; மீண்டும் முயற்சிப்பது அதே வரைவையும் செயலையும் அனுப்பும், புதிய வரைவை அல்ல.",
  },
};

const empty = (locale: Locale): KnowledgeDocument => ({
  locale,
  kind: "nonclinical",
  title: "",
  body: "",
  sourceUrl: "",
  sourceDigest: "",
  productIds: [],
  concernIds: [],
  safety: { warnings: "", redFlags: "", consultOnly: "", disclaimer: "" },
});

export function KnowledgeEditor({
  session,
  locale,
  onRevoked,
}: {
  session: ClientSession;
  locale: Locale;
  onRevoked(): void;
}) {
  const text = knowledgeText[locale];
  const client = useMemo(
    () =>
      sensitiveClient({
        origin: import.meta.env.VITE_CORE_API_ORIGIN ?? "http://127.0.0.1:8787",
        local: import.meta.env.DEV || location.hostname === "127.0.0.1",
        session,
        onRevoked,
      }),
    [session, onRevoked],
  );
  const [reference, setReference] = useState("");
  const [draft, setDraft] = useState<KnowledgeDraft>();
  const [content, setDocument] = useState<KnowledgeDocument>();
  const [products, setProducts] = useState("");
  const [concerns, setConcerns] = useState("");
  const [state, setState] = useState<
    "pending" | "current" | "loading" | Exclude<SensitiveResult<unknown>["status"], "ready">
  >("pending");
  const epoch = useRef(0);
  const busy = useRef(false);
  const operation = useRef(crypto.randomUUID());
  const [recovery] = useState(createKnowledgeRecovery);
  const reset = () => {
    recovery.clear();
    setDraft(undefined);
    setDocument(undefined);
    setProducts("");
    setConcerns("");
  };
  useEffect(
    () => () => {
      epoch.current++;
      recovery.clear();
      client.dispose();
    },
    [client, recovery],
  );
  useEffect(() => {
    const suspend = () => {
      epoch.current++;
      recovery.clear();
      client.dispose();
      setDraft(undefined);
      setDocument(undefined);
      setReference("");
      setProducts("");
      setConcerns("");
    };
    window.addEventListener("pagehide", suspend);
    globalThis.document.addEventListener("visibilitychange", suspend);
    return () => {
      window.removeEventListener("pagehide", suspend);
      globalThis.document.removeEventListener("visibilitychange", suspend);
    };
  }, [client, recovery]);
  async function run(action: () => Promise<SensitiveResult<KnowledgeDraft>>, save?: SaveAttempt) {
    if (busy.current) return;
    busy.current = true;
    const attempt = ++epoch.current;
    setState("loading");
    try {
      const result = await action();
      if (attempt !== epoch.current) return;
      // Save responses are correlated by the adapter before it retires their wire retry identity.
      if (!save && result.status === "ready" && reference && reference !== result.data.id) {
        reset();
        setState("error");
        return;
      }
      if (save && !recovery.finish(save, result.status)) return;
      if (result.status === "ready") {
        if (save) operation.current = crypto.randomUUID();
        setDraft(result.data);
        setDocument(result.data.document);
        setReference(result.data.id);
        setProducts(result.data.document.productIds.join(","));
        setConcerns(result.data.document.concernIds.join(","));
        setState("current");
      } else {
        if (!save || !recovery.pending) reset();
        if (result.status === "anonymous" || result.status === "denied") setReference("");
        setState(result.status);
      }
    } finally {
      busy.current = false;
    }
  }
  const recovering = recovery.pending !== undefined;
  const editable =
    content &&
    ((!draft && session.workspaces.includes("staff")) ||
      (draft?.state === "draft" && draft.permissions.edit));
  const payload = content
    ? {
        id: draft?.id ?? null,
        expectedRevision: draft?.revision ?? null,
        document: {
          ...content,
          productIds: products
            .split(",")
            .map((value) => value.trim())
            .filter(Boolean),
          concernIds: concerns
            .split(",")
            .map((value) => value.trim())
            .filter(Boolean),
        },
      }
    : null;
  return (
    <section aria-label={text.editor} data-editor-state={state}>
      <h2>{text.editor}</h2>
      <Notice>{text.editorHelp}</Notice>
      <Notice error={state === "denied" || state === "error"}>
        {
          sensitiveText[locale][
            state === "busy"
              ? "busy"
              : state === "current"
                ? "current"
                : state === "pending"
                  ? "pending"
                  : state
          ]
        }
      </Notice>
      {recovering && state !== "loading" && <Notice>{recoveryText[locale].help}</Notice>}
      <label>
        {text.reference}
        <input
          value={reference}
          disabled={state === "loading" || recovering}
          maxLength={36}
          autoComplete="off"
          onChange={(event) => {
            setReference(event.target.value);
            reset();
            setState("pending");
          }}
        />
      </label>
      <Button
        disabled={
          state === "loading" || recovering || !referenceSchema.safeParse(reference).success
        }
        onClick={() => void run(() => client.knowledgeDraft(reference))}
      >
        {text.load}
      </Button>
      {session.workspaces.includes("staff") && (
        <Button
          disabled={state === "loading" || recovering}
          onClick={() => {
            reset();
            setReference("");
            setDocument(empty(locale));
            operation.current = crypto.randomUUID();
            setState("pending");
          }}
        >
          {text.newDraft}
        </Button>
      )}
      {draft && (
        <p data-knowledge-status={draft.state}>
          {text[draft.state]} · v{draft.revision}
        </p>
      )}
      {content && (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (busy.current) return;
            const save = recovery.reserve(payload, operation.current);
            if (save)
              void run(
                () => client.saveKnowledgeDraft(save.operation.input, save.operation.operationId),
                save,
              );
          }}
        >
          <fieldset disabled={!editable || state === "loading" || recovering}>
            <label>
              {text.title}
              <input
                value={content.title}
                maxLength={160}
                onChange={(event) => setDocument({ ...content, title: event.target.value })}
              />
            </label>
            <label>
              {text.body}
              <textarea
                aria-label={text.body}
                value={content.body}
                maxLength={6000}
                onChange={(event) => setDocument({ ...content, body: event.target.value })}
              />
            </label>
            <label>
              {text.source}
              <input
                type="url"
                value={content.sourceUrl}
                maxLength={1000}
                onChange={(event) => setDocument({ ...content, sourceUrl: event.target.value })}
              />
            </label>
            <label>
              {text.digest}
              <input
                value={content.sourceDigest}
                maxLength={64}
                onChange={(event) => setDocument({ ...content, sourceDigest: event.target.value })}
              />
            </label>
            <select
              aria-label={foundationLanguage(locale)}
              value={content.locale}
              onChange={(event) => {
                const value = locales.find((item) => item === event.target.value);
                if (value) setDocument({ ...content, locale: value });
              }}
            >
              {locales.map((value) => (
                <option key={value} value={value}>
                  {localeNames[value]}
                </option>
              ))}
            </select>
            <select
              aria-label={`${text.medical} / ${text.nonclinical}`}
              value={content.kind}
              onChange={(event) =>
                setDocument({
                  ...content,
                  kind: event.target.value === "medical" ? "medical" : "nonclinical",
                })
              }
            >
              <option value="nonclinical">{text.nonclinical}</option>
              <option value="medical">{text.medical}</option>
            </select>
            <label>
              {text.products}
              <input
                value={products}
                maxLength={1200}
                onChange={(event) => setProducts(event.target.value)}
              />
            </label>
            <label>
              {text.concerns}
              <input
                value={concerns}
                maxLength={1200}
                onChange={(event) => setConcerns(event.target.value)}
              />
            </label>
            {(["warnings", "redFlags", "consultOnly", "disclaimer"] as const).map((key) => (
              <label key={key}>
                {text[key]}
                <textarea
                  value={content.safety[key]}
                  maxLength={1500}
                  onChange={(event) =>
                    setDocument({
                      ...content,
                      safety: { ...content.safety, [key]: event.target.value },
                    })
                  }
                />
              </label>
            ))}
          </fieldset>
          {publicSourceUrl(content.sourceUrl) && (
            <a
              href={publicSourceUrl(content.sourceUrl) ?? undefined}
              target="_blank"
              rel="noopener noreferrer"
              referrerPolicy="no-referrer"
            >
              {new URL(content.sourceUrl).hostname}
            </a>
          )}
          <Button
            type="submit"
            disabled={
              state === "loading" ||
              (!recovering && (!editable || !saveDraftSchema.safeParse(payload).success))
            }
          >
            {recovering ? recoveryText[locale].retry : text.save}
          </Button>
        </form>
      )}
      {draft && (
        <div className="actions">
          {(["request_review", "approve", "withdraw"] as const).map((action) => (
            <Button
              key={action}
              disabled={
                state === "loading" ||
                recovering ||
                JSON.stringify(payload?.document) !== JSON.stringify(draft.document) ||
                (action === "request_review"
                  ? draft.state !== "draft" ||
                    !draft.permissions.edit ||
                    !reviewReady(draft.document)
                  : action === "approve"
                    ? draft.state !== "in_review" ||
                      !draft.permissions.approve ||
                      draft.authorId === session.userId ||
                      !reviewReady(draft.document)
                    : draft.state !== "approved" || !draft.permissions.withdraw)
              }
              onClick={() =>
                void run(() => client.reviewKnowledge(draft.id, draft.revision, action))
              }
            >
              {text[action]}
            </Button>
          ))}
        </div>
      )}
    </section>
  );
}
function foundationLanguage(locale: Locale) {
  return { en: "Content language", ml: "ഉള്ളടക്ക ഭാഷ", ta: "உள்ளடக்க மொழி" }[locale];
}
