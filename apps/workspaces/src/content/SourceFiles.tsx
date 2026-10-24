import type { KnowledgeContent } from "@kandamkulathi/contracts/knowledge";
import type { Locale } from "@kandamkulathi/i18n";
import { Button, Notice } from "@kandamkulathi/ui";
import { type RefObject, useEffect, useId, useRef, useState } from "react";
import { staffContent } from "../../../../packages/i18n/src/staff-content";
import { createSourceFileSelection, type SourceFileState } from "./source-files";

export type SourceSelection = ReturnType<typeof createSourceFileSelection>;
export function SourceFiles({
  sources,
  locale,
  selectionRef,
  onReady,
}: {
  sources: KnowledgeContent["sources"];
  locale: Locale;
  selectionRef: RefObject<SourceSelection | null>;
  onReady(ready: boolean): void;
}) {
  const labels = staffContent[locale];
  const id = useId();
  const [states, setStates] = useState<SourceFileState[]>([]);
  const local = useRef<SourceSelection | null>(null);
  useEffect(() => {
    const selection = createSourceFileSelection(sources, (next) => {
      setStates(next);
      onReady(next.length > 0 && next.every((state) => state.status === "ready"));
    });
    local.current = selection;
    selectionRef.current = selection;
    setStates([]);
    onReady(false);
    return () => {
      if (local.current === selection) local.current = null;
      if (selectionRef.current === selection) selectionRef.current = null;
      selection.dispose();
      onReady(false);
    };
  }, [sources, selectionRef, onReady]);
  return (
    <fieldset className="content-source-files">
      <legend>{labels.sourceFiles}</legend>
      <p id={`${id}-prerequisites`}>{labels.sourcePrerequisites}</p>
      <p>{labels.sourceFileLimit}</p>
      {sources.map((source) => {
        const state = states.find((value) => value.sourceId === source.sourceId);
        const status = state?.status ?? "missing";
        return (
          <div className="field" key={source.sourceId}>
            <label htmlFor={`${id}-${source.sourceId}`}>
              {labels.sourceFile} {source.sourceId}
            </label>
            <p>
              <code>{source.sha256}</code>
            </p>
            <input
              id={`${id}-${source.sourceId}`}
              type="file"
              aria-describedby={`${id}-prerequisites ${id}-${source.sourceId}-status`}
              onChange={(event) => {
                const files = Array.from(event.target.files ?? []);
                event.target.value = "";
                void local.current?.select(source.sourceId, files);
              }}
            />
            <div id={`${id}-${source.sourceId}-status`} data-source-state={status}>
              <Notice error={["mismatch", "size", "duplicate", "error"].includes(status)}>
                {labels[`file_${status}`]}
                {state?.name ? ` — ${state.name}` : ""}
              </Notice>
            </div>
          </div>
        );
      })}
      <Button onClick={() => local.current?.clear()}>{labels.clearFiles}</Button>
    </fieldset>
  );
}
