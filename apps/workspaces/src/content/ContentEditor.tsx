import type { Resource } from "@kandamkulathi/client";
import type { ClientSession } from "@kandamkulathi/contracts/client";
import type { KnowledgeRecord } from "@kandamkulathi/contracts/knowledge";
import type { Locale } from "@kandamkulathi/i18n";
import "@kandamkulathi/i18n/fonts.css";
import { Button, Notice } from "@kandamkulathi/ui";
import { useEffect, useId, useRef, useState } from "react";
import { staffContent } from "../../../../packages/i18n/src/staff-content";
import {
  type ContentReader,
  type ContentState,
  contentSession,
  contentSessionKey,
  isRecordedEditor,
  requestContent,
  validLocalDraft,
} from "./model";
import "./content.css";
import { authoringRequest, draftCommand } from "./authoring-dto";
import type { ContentAuthoringPort } from "./authoring-port";
import { SourceFiles, type SourceSelection } from "./SourceFiles";
import { withinKnowledgeBodyLimit } from "./source-files";
import { useContentAuthoring } from "./useContentAuthoring";

export interface ContentEditorProps {
  locale: Locale;
  session: Resource<unknown>;
  /** Inject only a scoped, current authorized read. Absent until the owner supplies an endpoint. */
  readRecord?: ContentReader;
  /** Requires an exact backend-owner source-grant codec; absent means Pending. */
  authoring?: ContentAuthoringPort;
}

/** Embeddable UI. No default transport/session bypass; authoring requires a validated injected port. */
export function ContentEditor({ locale, session, readRecord, authoring }: ContentEditorProps) {
  const labels = staffContent[locale];
  const access = contentSession(session);
  const [epoch, setEpoch] = useState(0);
  const [suspended, setSuspended] = useState(false);
  const expiresAt = access.status === "ready" ? access.session.expiresAt : null;
  useEffect(() => {
    const clear = () => {
      setSuspended(true);
      setEpoch((value) => value + 1);
    };
    const visibility = () => {
      if (document.visibilityState !== "visible") clear();
    };
    const restoration = (event: PageTransitionEvent) => {
      if (event.persisted) clear();
    };
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("pagehide", clear);
    window.addEventListener("pageshow", restoration);
    return () => {
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener("pagehide", clear);
      window.removeEventListener("pageshow", restoration);
    };
  }, []);
  useEffect(() => {
    if (!expiresAt) return;
    let timer: ReturnType<typeof setTimeout>;
    const checkExpiry = () => {
      const remaining = Date.parse(expiresAt) - Date.now();
      if (remaining <= 0) setEpoch((value) => value + 1);
      else timer = setTimeout(checkExpiry, Math.min(2147483647, remaining));
    };
    checkExpiry();
    return () => clearTimeout(timer);
  }, [expiresAt]);
  return (
    <section className="content-editor" lang={locale} aria-label={labels.heading}>
      <h2>{labels.heading}</h2>
      <Notice>{labels.unreviewed}</Notice>
      {access.status !== "ready" ? (
        <ContentNotice state={{ status: access.status }} locale={locale} />
      ) : (
        <>
          <Button
            onClick={() => {
              setSuspended(false);
              setEpoch((value) => value + 1);
            }}
          >
            {labels.refresh}
          </Button>
          {suspended ? (
            <Notice>{labels.suspended}</Notice>
          ) : (
            <ContentRead
              key={`${contentSessionKey(access.session)}:${epoch}`}
              locale={locale}
              session={access.session}
              readRecord={readRecord}
              authoring={authoring}
            />
          )}
        </>
      )}
    </section>
  );
}

function ContentNotice({
  state,
  locale,
}: {
  state: Exclude<ContentState, { status: "ready" }>;
  locale: Locale;
}) {
  return (
    <div data-content-state={state.status} aria-busy={state.status === "loading"}>
      <Notice
        error={["error", "invalid", "denied", "conflict", "unknown", "oversized"].includes(
          state.status,
        )}
      >
        {staffContent[locale][state.status]}
      </Notice>
    </div>
  );
}

function ContentRead({
  locale,
  session,
  readRecord,
  authoring,
}: {
  locale: Locale;
  session: ClientSession;
  readRecord: ContentReader | undefined;
  authoring: ContentAuthoringPort | undefined;
}) {
  const [result, setResult] = useState<{
    reader: ContentReader | undefined;
    port: ContentAuthoringPort | undefined;
    state: ContentState;
  }>({
    reader: readRecord,
    port: authoring,
    state: { status: readRecord ? "loading" : "pending" },
  });
  useEffect(() => {
    if (!readRecord) return;
    return requestContent(readRecord, (state) =>
      setResult({ reader: readRecord, port: authoring, state }),
    );
  }, [readRecord, authoring]);
  // A changed adapter must not render even one frame of the previous adapter's data.
  const state =
    result.reader === readRecord && result.port === authoring
      ? result.state
      : ({ status: readRecord ? "loading" : "pending" } as const);
  if (result.reader !== readRecord || result.port !== authoring)
    setResult({ reader: readRecord, port: authoring, state });
  if (state.status !== "ready") return <ContentNotice locale={locale} state={state} />;
  if (!readRecord) return <ContentNotice locale={locale} state={{ status: "pending" }} />;
  return (
    <RecordView
      key={JSON.stringify(state.record)}
      record={state.record}
      locale={locale}
      session={session}
      authoring={authoring}
      readCurrent={readRecord}
      update={(state) => setResult({ reader: readRecord, port: authoring, state })}
    />
  );
}

function RecordView({
  record,
  locale,
  session,
  authoring,
  readCurrent,
  update,
}: {
  record: KnowledgeRecord;
  locale: Locale;
  session: ClientSession;
  authoring: ContentAuthoringPort | undefined;
  readCurrent: ContentReader;
  update: (state: ContentState) => void;
}) {
  const labels = staffContent[locale];
  const actorId = session.userId;
  const actions = useContentAuthoring(authoring, session, record, readCurrent, update);
  const { content } = record;
  const id = useId();
  const [title, setTitle] = useState(content.title);
  const [text, setText] = useState(content.text);
  const invalid = !validLocalDraft(title, text);
  const dirty = title !== content.title || text !== content.text;
  const selectionRef = useRef<SourceSelection | null>(null);
  const [filesReady, setFilesReady] = useState(false);
  const [bodyTooLarge, setBodyTooLarge] = useState(false);
  const hasFiles = filesReady && Boolean(selectionRef.current?.ready());
  const save = () => {
    if (!actions.permitted("edit") || actions.hasAttempted() || invalid) return;
    const sources = selectionRef.current?.prepareUploads();
    const command = sources ? draftCommand(record, actorId, title, text, sources) : null;
    if (!command) return;
    if (!withinKnowledgeBodyLimit(authoringRequest(command).body)) {
      setBodyTooLarge(true);
      return;
    }
    setBodyTooLarge(false);
    actions.start(command);
  };
  const occurrences = new Map<string, number>();
  const citations = content.citations.map((citation) => {
    const identity = JSON.stringify(citation);
    const occurrence = (occurrences.get(identity) ?? 0) + 1;
    occurrences.set(identity, occurrence);
    return { citation, key: `${identity}:${occurrence}` };
  });
  if (actions.progress)
    return (
      <div data-authoring-state={actions.progress} aria-busy="true">
        <Notice>{labels[actions.progress]}</Notice>
      </div>
    );
  return (
    <div data-content-state="ready">
      <Notice>{labels.verification}</Notice>
      {authoring && (
        <Notice>
          {actions.authority === "ready"
            ? labels.authorityReady
            : actions.authority === "loading"
              ? labels.checking
              : actions.authority === "denied"
                ? labels.authorityDenied
                : actions.authority === "error"
                  ? labels.authorityError
                  : labels.pending}
        </Notice>
      )}
      <dl className="content-metadata">
        <dt>{labels.reported}</dt>
        <dd>{labels[record.state]}</dd>
        <dt>{labels.entry}</dt>
        <dd>{content.entryId}</dd>
        <dt>{labels.version}</dt>
        <dd>{content.revision}</dd>
        <dt>{labels.hash}</dt>
        <dd>
          <code>{record.contentHash}</code>
        </dd>
        <dt>{labels.previous}</dt>
        <dd>{content.previousContentHash ?? labels.none}</dd>
        <dt>{labels.language}</dt>
        <dd>{content.language}</dd>
        <dt>{labels.kind}</dt>
        <dd>{content.kind}</dd>
        <dt>{labels.editor}</dt>
        <dd>{content.editorId}</dd>
      </dl>
      <section aria-label={labels.exact}>
        <h3>{labels.exact}</h3>
        <div lang={content.language}>
          <h4>{content.title}</h4>
          <p className="content-exact">{content.text}</p>
        </div>
      </section>
      <section aria-label={labels.provenance}>
        <h3>{labels.provenance}</h3>
        {content.sources.map((source) => (
          <dl className="content-metadata" key={source.sourceId}>
            <dt>{labels.source}</dt>
            <dd>{source.sourceId}</dd>
            <dt>{labels.version}</dt>
            <dd>{source.revision}</dd>
            <dt>{labels.sourceHash}</dt>
            <dd>
              <code>{source.sha256}</code>
            </dd>
          </dl>
        ))}
        <h4>{labels.citations}</h4>
        <ul>
          {citations.map(({ citation, key }) => (
            <li key={key}>
              <a href={citation.publicUrl} rel="noreferrer" referrerPolicy="no-referrer">
                {citation.title}
              </a>
            </li>
          ))}
        </ul>
      </section>
      {record.state === "draft" || actions.permitted("edit") ? (
        <section aria-label={labels.draft}>
          <h3>{labels.draft}</h3>
          <p id={`${id}-help`}>
            {actions.permitted("edit") ? labels.authoringDraftHelp : labels.draftHelp}
          </p>
          <div className="field">
            <label htmlFor={`${id}-title`}>{labels.title}</label>
            <textarea
              id={`${id}-title`}
              lang={content.language}
              value={title}
              maxLength={200}
              aria-describedby={`${id}-help`}
              aria-invalid={invalid}
              onChange={(event) => setTitle(event.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor={`${id}-text`}>{labels.body}</label>
            <textarea
              id={`${id}-text`}
              lang={content.language}
              value={text}
              maxLength={16000}
              aria-describedby={`${id}-help`}
              aria-invalid={invalid}
              onChange={(event) => setText(event.target.value)}
            />
          </div>
          <Notice error={invalid}>{invalid ? labels.invalidDraft : labels.localOnly}</Notice>
          {actions.permitted("edit") && (
            <SourceFiles
              sources={content.sources}
              locale={locale}
              selectionRef={selectionRef}
              onReady={setFilesReady}
            />
          )}
          {actions.permitted("edit") && !hasFiles && !invalid && (
            <Notice>{labels.sourcePending}</Notice>
          )}
          {bodyTooLarge && <Notice error>{labels.sourceBodySize}</Notice>}
          <Button disabled={!actions.permitted("edit") || invalid || !hasFiles} onClick={save}>
            {actions.permitted("edit") && hasFiles ? labels.saveEnabled : labels.save}
          </Button>
        </section>
      ) : (
        <Notice>{labels.immutable}</Notice>
      )}
      <section aria-label={labels.approval}>
        <h3>{labels.approval}</h3>
        {dirty && (actions.permitted("approve") || actions.permitted("withdraw")) && (
          <Notice>{labels.unsaved}</Notice>
        )}
        <Notice error={isRecordedEditor(actorId, record)}>
          {isRecordedEditor(actorId, record) ? labels.selfApproval : labels.approvalPending}
        </Notice>
        {record.state !== "draft" && (
          <dl className="content-metadata">
            <dt>{labels.approver}</dt>
            <dd>
              {record.approval.approverDisplayName} ({record.approval.approverId})
            </dd>
            <dt>{labels.approvedAt}</dt>
            <dd>{record.approval.approvedAt}</dd>
            {record.state === "withdrawn" && (
              <>
                <dt>{labels.withdrawal}</dt>
                <dd>
                  {record.withdrawal.withdrawnAt} ({record.withdrawal.actorId})
                </dd>
              </>
            )}
          </dl>
        )}
        <div className="actions">
          <Button
            disabled={!actions.permitted("approve") || isRecordedEditor(actorId, record) || dirty}
            onClick={() =>
              actions.start({
                action: "approve",
                entryId: record.content.entryId,
                revision: record.content.revision,
                contentHash: record.contentHash,
              })
            }
          >
            {actions.permitted("approve") ? labels.approveEnabled : labels.approve}
          </Button>
          <Button
            disabled={!actions.permitted("withdraw") || dirty}
            onClick={() =>
              actions.start({
                action: "withdraw",
                entryId: record.content.entryId,
                revision: record.content.revision,
                contentHash: record.contentHash,
              })
            }
          >
            {actions.permitted("withdraw") ? labels.withdrawEnabled : labels.withdraw}
          </Button>
        </div>
      </section>
    </div>
  );
}
