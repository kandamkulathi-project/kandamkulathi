import type { ClientSession } from "@kandamkulathi/contracts/client";
import { knowledgeIdSchema } from "@kandamkulathi/contracts/knowledge";
import type { Locale } from "@kandamkulathi/i18n";
import { Button, Notice } from "@kandamkulathi/ui";
import { useId, useMemo, useState } from "react";
import { staffContent } from "../../../../packages/i18n/src/staff-content";
import { createBrowserAuthoringTransport } from "./browser-authoring";
import { ContentEditor } from "./ContentEditor";
import { createContentHttpIntegration } from "./http-source";

export function ContentWorkspace({
  session,
  locale,
  coreOrigin,
  companionOrigin,
  local,
  transport,
}: {
  session: ClientSession;
  locale: Locale;
  coreOrigin: string;
  companionOrigin: string;
  local: boolean;
  transport?: typeof fetch;
}) {
  const id = useId();
  const text = staffContent[locale];
  const [entryId, setEntryId] = useState("");
  const [selected, setSelected] = useState<{ id: string; attempt: number }>();
  const resource = useMemo(() => ({ status: "ready" as const, data: session }), [session]);
  const integration = useMemo(
    () =>
      selected && transport
        ? createContentHttpIntegration({
            session,
            entryId: selected.id,
            coreOrigin,
            companionOrigin,
            local,
            transport: createBrowserAuthoringTransport(coreOrigin, transport),
          })
        : undefined,
    [selected, transport, session, coreOrigin, companionOrigin, local],
  );
  const valid = knowledgeIdSchema.safeParse(entryId);
  return (
    <>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (valid.success && transport)
            setSelected((previous) => ({ id: valid.data, attempt: (previous?.attempt ?? 0) + 1 }));
        }}
      >
        <div className="field">
          <label htmlFor={id}>{text.entry}</label>
          <input
            id={id}
            value={entryId}
            maxLength={36}
            onChange={(event) => {
              setSelected(undefined);
              setEntryId(event.target.value);
            }}
          />
        </div>
        {entryId && !valid.success && <Notice error>{text.invalid}</Notice>}
        <Button type="submit" disabled={!valid.success || !transport}>
          {text.refresh}
        </Button>
      </form>
      <ContentEditor
        key={selected ? `${selected.id}:${selected.attempt}` : "pending"}
        locale={locale}
        session={resource}
        {...(integration ? { readRecord: integration.readRecord } : {})}
        {...(integration?.status === "configured" ? { authoring: integration.authoring } : {})}
      />
    </>
  );
}
