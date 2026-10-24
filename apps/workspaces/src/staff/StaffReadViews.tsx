import { type Resource, workspaceAccess } from "@kandamkulathi/client";
import type { ClientSession } from "@kandamkulathi/contracts/client";
import { formatDate, formatMoney, type Locale } from "@kandamkulathi/i18n";
import { Button, Notice } from "@kandamkulathi/ui";
import { useEffect, useMemo, useState } from "react";
import { staffReadLabels } from "../../../../packages/i18n/src/staff-read";
import {
  type StaffKind,
  type StaffReader,
  type StaffResult,
  type StaffRow,
  staffKinds,
} from "./read-model";
import "./staff.css";

function dateTime(value: string, locale: Locale) {
  return new Intl.DateTimeFormat({ en: "en-IN", ml: "ml-IN", ta: "ta-IN" }[locale], {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  }).format(new Date(value));
}
function cells(row: StaffRow, locale: Locale) {
  const missing = staffReadLabels[locale].notProvided;
  const common = [row.clinicLabel, row.status ?? missing];
  if (row.kind === "orders")
    return [
      row.reference,
      ...common,
      formatMoney(row.totalPaise, locale),
      row.metadata?.source ?? missing,
      row.metadata ? dateTime(row.metadata.createdAt, locale) : missing,
      row.metadata ? dateTime(row.metadata.expiresAt, locale) : missing,
      row.metadata ? String(row.metadata.version) : missing,
    ];
  if (row.kind === "batches")
    return [
      `${row.productLabel} / ${row.batchCode}`,
      ...common,
      formatDate(new Date(`${row.expiresOn}T00:00:00Z`), locale),
      row.onHand === undefined && row.quantity === undefined
        ? missing
        : String(row.onHand ?? row.quantity),
      row.reserved === undefined ? missing : String(row.reserved),
      row.recalled === undefined ? missing : String(row.recalled),
    ];
  return [
    row.doctorLabel,
    ...common,
    dateTime(row.startsAt, locale),
    dateTime(row.endsAt, locale),
    row.modeLabel,
  ];
}

export interface StaffReadViewsProps {
  session: Resource<ClientSession>;
  reader?: StaffReader;
  locale?: Locale;
  /** Reviewed filter values, not grants. Empty by default; server still authorizes every read. */
  statuses?: Partial<Record<StaffKind, readonly string[]>>;
}

/** Embed inside the existing staff/session shell. No writes or production fixture fallback. */
export function StaffReadViews({ session, reader, statuses, locale = "en" }: StaffReadViewsProps) {
  const text = staffReadLabels[locale];
  const headers = {
    orders: [
      text.order,
      text.clinic,
      text.status,
      text.total,
      text.source,
      text.created,
      text.expires,
      text.version,
    ],
    batches: [
      text.productBatch,
      text.clinic,
      text.status,
      text.expiry,
      text.units,
      text.reserved,
      text.recalled,
    ],
    schedules: [text.doctor, text.clinic, text.status, text.starts, text.ends, text.mode],
  };
  const [kind, setKind] = useState<StaffKind>("orders");
  const [filter, setFilter] = useState("");
  const [cursors, setCursors] = useState<(string | null)[]>([null]);
  const [revision, setRevision] = useState(0);
  const [active, setActive] = useState(true);
  const [expired, setExpired] = useState(false);
  const cursor = cursors.at(-1) ?? null;
  const request = useMemo(
    () => ({ session, reader, kind, filter, cursor, revision, active, expired }),
    [session, reader, kind, filter, cursor, revision, active, expired],
  );
  const [result, setResult] = useState<{ request: typeof request; value: StaffResult } | null>(
    null,
  );
  const allowed = session.status === "ready" && workspaceAccess(session.data, "staff") && !expired;

  useEffect(() => {
    setExpired(false);
    if (session.status !== "ready") return;
    let timer: ReturnType<typeof setTimeout>;
    const checkExpiry = () => {
      const remaining = Date.parse(session.data.expiresAt) - Date.now();
      if (remaining <= 0) setExpired(true);
      else timer = setTimeout(checkExpiry, Math.min(2147483647, remaining));
    };
    checkExpiry();
    return () => clearTimeout(timer);
  }, [session]);
  useEffect(() => {
    const hide = () => {
      setActive(false);
      setResult(null);
    };
    const visibility = () => {
      if (document.visibilityState === "hidden") hide();
    };
    window.addEventListener("pagehide", hide);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      window.removeEventListener("pagehide", hide);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, []);
  useEffect(() => {
    if (!allowed || !reader || !active) return;
    const controller = new AbortController();
    let current = true;
    const timeout = setTimeout(() => {
      current = false;
      controller.abort();
      setResult({ request, value: { status: "error" } });
    }, 5000);
    Promise.resolve()
      .then(() => reader(kind, { cursor, limit: 20, status: filter }, controller.signal))
      .then(
        (value) => {
          if (current) setResult({ request, value });
        },
        () => {
          if (current) setResult({ request, value: { status: "error" } });
        },
      )
      .finally(() => clearTimeout(timeout));
    return () => {
      current = false;
      clearTimeout(timeout);
      controller.abort();
    };
  }, [allowed, reader, active, request, kind, cursor, filter]);

  const value: StaffResult = !allowed
    ? {
        status:
          session.status === "ready"
            ? expired || Date.parse(session.data.expiresAt) <= Date.now()
              ? "anonymous"
              : "denied"
            : session.status,
      }
    : !active || !reader
      ? { status: "unavailable" }
      : result?.request === request
        ? result.value
        : { status: "loading" };
  function reset() {
    setCursors([null]);
    setRevision((value) => value + 1);
  }
  const options = [...new Set(statuses?.[kind] ?? [])].filter((value) =>
    /^[A-Za-z0-9_-]{1,256}$/.test(value),
  );
  return (
    <section
      className="staff-read"
      aria-label={text.records}
      lang={locale}
      data-staff-state={value.status}
    >
      <h2>{text.records}</h2>
      <p>{text.readOnly}</p>
      <div className="actions">
        {staffKinds.map((item) => (
          <Button
            key={item}
            aria-pressed={kind === item}
            onClick={() => {
              setKind(item);
              setFilter("");
              reset();
            }}
          >
            {text[item]}
          </Button>
        ))}
      </div>
      <h3>{text[kind]}</h3>
      <div className="actions">
        <label>
          {text.filter}{" "}
          <select
            value={filter}
            disabled={!allowed || options.length === 0}
            onChange={(event) => {
              setFilter(event.target.value);
              reset();
            }}
          >
            <option value="">{text.allStatuses}</option>
            {options.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </label>
        <Button
          disabled={value.status === "loading" || !allowed}
          onClick={() => {
            setActive(true);
            reset();
          }}
        >
          {text.refresh}
        </Button>
      </div>
      <div aria-busy={value.status === "loading"}>
        {value.status !== "ready" ? (
          <Notice error={value.status === "error" || value.status === "denied"}>
            {text[value.status]}
          </Notice>
        ) : value.data.rows.length === 0 ? (
          <Notice>{text.empty}</Notice>
        ) : (
          <section className="staff-table-scroll" aria-label={`${text[kind]} ${text.table}`}>
            <table>
              <caption>
                {text[kind]} — {text.currentPage}
              </caption>
              <thead>
                <tr>
                  {headers[kind].map((title) => (
                    <th key={title} scope="col">
                      {title}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {value.data.rows.map((row) => (
                  <tr key={row.id}>
                    {cells(row, locale).map((cell, index) => (
                      <td key={headers[kind][index]}>{cell}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}
      </div>
      <div className="actions">
        <Button
          disabled={value.status !== "ready" || cursors.length === 1}
          onClick={() => setCursors((values) => values.slice(0, -1))}
        >
          {text.previous}
        </Button>
        <span>
          {text.page} {cursors.length}
        </span>
        <Button
          disabled={
            value.status !== "ready" ||
            !value.data.nextCursor ||
            cursors.includes(value.data.nextCursor)
          }
          onClick={() => {
            if (value.status === "ready" && value.data.nextCursor)
              setCursors((values) => [...values, value.data.nextCursor]);
          }}
        >
          {text.next}
        </Button>
      </div>
    </section>
  );
}
