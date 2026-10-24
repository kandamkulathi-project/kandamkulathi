// Isolated Vite test entry, not imported by the application or included in its production build.
import { sessionSchema } from "@kandamkulathi/contracts/client";
import { createRoot } from "react-dom/client";
import "@kandamkulathi/i18n/fonts.css";
import "../../styles.css";
import { createCommerceStaffReader } from "../commerce-reader";
import { createStaffReader, type StaffReader } from "../read-model";
import { StaffReadViews } from "../StaffReadViews";
import { staffCommerceAssociation } from "./commerce-fixtures";

const params = new URLSearchParams(location.search);
const language = params.get("locale");
const locale = language === "ml" || language === "ta" ? language : "en";
document.documentElement.lang = locale;
const mode = params.get("mode");
const session = sessionSchema.parse({
  userId: "00000000-0000-4000-8000-000000000001",
  expiresAt: new Date(Date.now() + (mode === "expiry" ? 1500 : 3600000)).toISOString(),
  workspaces: mode === "customer" ? ["customer"] : ["staff"],
});
const statuses = {
  orders: ["confirmed", "packed"],
  batches: ["available"],
  schedules: ["available"],
};
const httpReader = createStaffReader({
  origin: location.origin,
  local: true,
  statuses,
  cursorParameter: "cursor",
  statusParameter: "status",
  decoders: { orders: (input) => input, batches: (input) => input, schedules: (input) => input },
  endpoints: {
    orders: "/v1/staff/synthetic-orders",
    batches: "/v1/staff/synthetic-batches",
    schedules: "/v1/staff/synthetic-schedules",
  },
});
let calls = 0;
const lateReader: StaffReader = async () => {
  if (++calls > 1) return { status: "ready", data: { rows: [], nextCursor: null } };
  await new Promise((resolve) => setTimeout(resolve, 400));
  return {
    status: "ready",
    data: {
      rows: [
        {
          id: "late",
          kind: "orders",
          reference: "Late synthetic order",
          totalPaise: 100,
          clinicLabel: "Synthetic clinic",
          status: "confirmed",
        },
      ],
      nextCursor: null,
    },
  };
};
const neverReader: StaffReader = () => new Promise(() => {});
const reader =
  mode === "commerce"
    ? createCommerceStaffReader({
        origin: location.origin,
        local: true,
        ...staffCommerceAssociation,
      })
    : mode === "late"
      ? lateReader
      : mode === "timeout"
        ? neverReader
        : httpReader;
const root = document.getElementById("root");
if (!root) throw new Error("Missing fixture root");
createRoot(root).render(
  <main>
    <h1>Synthetic staff fixture — not operational data</h1>
    <StaffReadViews
      locale={locale}
      session={{ status: "ready", data: session }}
      {...(mode === "commerce" ? {} : { statuses })}
      {...(mode === "missing" ? {} : { reader })}
    />
  </main>,
);
