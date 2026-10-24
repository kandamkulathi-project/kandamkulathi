import { foundation } from "./foundation";
import type { Locale } from "./index";

/** Draft NONCLINICAL interface labels only. Company language review remains pending. */
export const staffReadTranslationReview = "draft-unreviewed-nonclinical" as const;
const rows = {
  reserved: ["Reserved units", "റിസർവ് ചെയ്ത യൂണിറ്റുകൾ", "ஒதுக்கப்பட்ட அலகுகள்"],
  recalled: [
    "Recalled (server flag)",
    "തിരിച്ചുവിളിച്ചത് (സെർവർ ഫ്ലാഗ്)",
    "திரும்பப்பெறப்பட்டது (சேவையகக் குறி)",
  ],
  source: ["Source", "ഉറവിടം", "மூலம்"],
  created: ["Created (IST)", "സൃഷ്ടിച്ചത് (IST)", "உருவாக்கம் (IST)"],
  expires: ["Expires (IST)", "കാലാവധി (IST)", "காலாவதி (IST)"],
  version: ["Version", "പതിപ്പ്", "பதிப்பு"],
  notProvided: ["Not provided", "നൽകിയിട്ടില്ല", "வழங்கப்படவில்லை"],
  records: ["Operational records", "പ്രവർത്തന രേഖകൾ", "செயல்பாட்டுப் பதிவுகள்"],
  readOnly: [
    "Read-only · authorization and current clinic scope are enforced by the server.",
    "വായിക്കാൻ മാത്രം · അനുമതിയും നിലവിലെ ക്ലിനിക് പരിധിയും സെർവർ പരിശോധിക്കുന്നു.",
    "பார்வைக்கு மட்டும் · அனுமதியையும் தற்போதைய கிளினிக் வரம்பையும் சேவையகம் சரிபார்க்கிறது.",
  ],
  orders: ["Orders", "ഓർഡറുകൾ", "ஆர்டர்கள்"],
  batches: ["Batches", "ബാച്ചുകൾ", "தொகுதிகள்"],
  schedules: ["Doctor schedules", "ഡോക്ടർമാരുടെ സമയക്രമം", "மருத்துவர் அட்டவணைகள்"],
  loading: ["Loading current records…", "നിലവിലെ രേഖകൾ ലഭ്യമാക്കുന്നു…", "தற்போதைய பதிவுகள் ஏற்றப்படுகின்றன…"],
  anonymous: [
    "Sign in again to view staff records.",
    "ജീവനക്കാരുടെ രേഖകൾ കാണാൻ വീണ്ടും സൈൻ ഇൻ ചെയ്യുക.",
    "பணியாளர் பதிவுகளைக் காண மீண்டும் உள்நுழையவும்.",
  ],
  denied: [foundation.en.denied, foundation.ml.denied, foundation.ta.denied],
  unavailable: [
    "Pending — the authorized read adapter is not available.",
    "പൂർത്തിയായിട്ടില്ല — അനുമതിയുള്ള വായനാ സേവനം ലഭ്യമല്ല.",
    "நிலுவையில் உள்ளது — அனுமதிக்கப்பட்ட வாசிப்பு சேவை கிடைக்கவில்லை.",
  ],
  error: [
    "Records could not be loaded. Retry to request current data.",
    "രേഖകൾ ലഭ്യമാക്കാനായില്ല. നിലവിലെ വിവരങ്ങൾക്കായി വീണ്ടും ശ്രമിക്കുക.",
    "பதிவுகளை ஏற்ற முடியவில்லை. தற்போதைய தரவுக்கு மீண்டும் முயலவும்.",
  ],
  empty: [
    "No records match this view.",
    "ഈ കാഴ്ചയുമായി പൊരുത്തപ്പെടുന്ന രേഖകളില്ല.",
    "இந்தக் காட்சிக்குப் பொருந்தும் பதிவுகள் இல்லை.",
  ],
  filter: ["Status filter", "നില ഫിൽട്ടർ", "நிலை வடிகட்டி"],
  allStatuses: ["All permitted statuses", "അനുവദിച്ച എല്ലാ നിലകളും", "அனுமதிக்கப்பட்ட அனைத்து நிலைகளும்"],
  refresh: ["Refresh records", "രേഖകൾ പുതുക്കുക", "பதிவுகளைப் புதுப்பிக்கவும்"],
  table: ["table", "പട്ടിക", "அட்டவணை"],
  currentPage: ["current page only", "നിലവിലെ പേജ് മാത്രം", "தற்போதைய பக்கம் மட்டும்"],
  previous: ["Previous page", "മുൻ പേജ്", "முந்தைய பக்கம்"],
  next: ["Next page", "അടുത്ത പേജ്", "அடுத்த பக்கம்"],
  page: ["Page", "പേജ്", "பக்கம்"],
  order: ["Order", "ഓർഡർ", "ஆர்டர்"],
  clinic: ["Clinic", "ക്ലിനിക്", "கிளினிக்"],
  status: ["Status", "നില", "நிலை"],
  total: ["Total", "ആകെ", "மொத்தம்"],
  productBatch: ["Product / batch", "ഉൽപ്പന്നം / ബാച്ച്", "தயாரிப்பு / தொகுதி"],
  expiry: ["Expiry date", "കാലാവധി തീയതി", "காலாவதி தேதி"],
  units: ["Units (on hand)", "യൂണിറ്റുകൾ (കൈവശമുള്ളത്)", "அலகுகள் (கையிருப்பு)"],
  doctor: ["Doctor", "ഡോക്ടർ", "மருத்துவர்"],
  starts: ["Starts (IST)", "ആരംഭം (IST)", "தொடக்கம் (IST)"],
  ends: ["Ends (IST)", "അവസാനം (IST)", "முடிவு (IST)"],
  mode: ["Mode", "രീതി", "முறை"],
} satisfies Record<string, readonly [string, string, string]>;
export type StaffReadLabels = { [K in keyof typeof rows]: string };
const labels = (index: 0 | 1 | 2) =>
  Object.fromEntries(
    Object.entries(rows).map(([key, values]) => [key, values[index]]),
  ) as StaffReadLabels;
export const staffReadLabels: Record<Locale, StaffReadLabels> = {
  en: labels(0),
  ml: labels(1),
  ta: labels(2),
};
