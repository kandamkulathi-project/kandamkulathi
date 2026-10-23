import type { Locale } from "./index";

// Draft development labels. Company translation review remains pending.
const rows = {
  language: ["Language", "ഭാഷ", "மொழி"],
  preview: ["Team preview", "ടീം പ്രിവ്യൂ", "குழு முன்னோட்டம்"],
  workspace: ["Workspaces", "പ്രവർത്തനസ്ഥലങ്ങൾ", "பணியிடங்கள்"],
  customer: ["Customer", "ഉപഭോക്താവ്", "வாடிக்கையாளர்"],
  staff: ["Staff", "ജീവനക്കാർ", "பணியாளர்"],
  physician: ["Physician", "ഡോക്ടർ", "மருத்துவர்"],
  support: ["Support", "സഹായം", "உதவி"],
  loading: ["Checking access…", "പ്രവേശനം പരിശോധിക്കുന്നു…", "அணுகலைச் சரிபார்க்கிறது…"],
  anonymous: [
    "Sign in is required. Authentication setup is pending.",
    "സൈൻ ഇൻ ആവശ്യമാണ്. സജ്ജീകരണം തയ്യാറാകുന്നു.",
    "உள்நுழைவு தேவை. அமைப்பு தயாராகிறது.",
  ],
  denied: [
    "You do not have access to this workspace.",
    "ഈ പ്രവർത്തനസ്ഥലത്തേക്ക് പ്രവേശനമില്ല.",
    "இந்தப் பணியிடத்திற்கு அணுகல் இல்லை.",
  ],
  unavailable: [
    "This service is not available yet.",
    "ഈ സേവനം ഇതുവരെ ലഭ്യമല്ല.",
    "இந்தச் சேவை இன்னும் கிடைக்கவில்லை.",
  ],
  error: [
    "We could not check access. Try again.",
    "പരിശോധിക്കാനായില്ല. വീണ്ടും ശ്രമിക്കുക.",
    "சரிபார்க்க முடியவில்லை. மீண்டும் முயலவும்.",
  ],
  ready: [
    "Access verified. Feature integration is pending.",
    "പ്രവേശനം പരിശോധിച്ചു. സംയോജനം തയ്യാറാകുന്നു.",
    "அணுகல் சரிபார்க்கப்பட்டது. இணைப்பு நிலுவையில் உள்ளது.",
  ],
  retry: ["Check access again", "വീണ്ടും പരിശോധിക്കുക", "மீண்டும் சரிபார்க்கவும்"],
  empty: ["No items to display.", "പ്രദർശിപ്പിക്കാൻ വിവരങ്ങളില്ല.", "காண்பிக்கத் தகவல்கள் இல்லை."],
  pending: ["Implementation pending", "നിർമ്മാണം പൂർത്തിയായിട്ടില്ല", "செயலாக்கம் நிலுவையில் உள்ளது"],
  home: ["Overview", "അവലോകനം", "கண்ணோட்டம்"],
  skip: ["Skip to content", "ഉള്ളടക്കത്തിലേക്ക് പോകുക", "உள்ளடக்கத்திற்குச் செல்லவும்"],
  commerce: ["Commerce", "വ്യാപാരം", "வணிகம்"],
  commerceDescription: [
    "Catalogue, orders and fulfilment.",
    "കാറ്റലോഗ്, ഓർഡറുകൾ, വിതരണം.",
    "பட்டியல், ஆர்டர்கள் மற்றும் விநியோகம்.",
  ],
  consultations: ["Consultations", "കൺസൾട്ടേഷനുകൾ", "ஆலோசனைகள்"],
  consultationDescription: [
    "Appointments and care workspaces.",
    "അപ്പോയിന്റ്മെന്റുകളും പരിചരണവും.",
    "முன்பதிவுகள் மற்றும் பராமரிப்பு.",
  ],
  companion: ["Companion", "സഹായി", "துணை"],
  companionDescription: [
    "Approved knowledge and guided assistance.",
    "അംഗീകൃത അറിവും സഹായവും.",
    "அங்கீகரிக்கப்பட்ட அறிவும் உதவியும்.",
  ],
  footer: [
    "Company content and integrations await review.",
    "ഉള്ളടക്കവും സേവനങ്ങളും അവലോകനത്തിനായി കാത്തിരിക്കുന്നു.",
    "உள்ளடக்கம் மற்றும் சேவைகளின் மதிப்பாய்வு நிலுவையில் உள்ளது.",
  ],
  devices: ["Local device check", "ലോക്കൽ ഉപകരണ പരിശോധന", "உள்ளூர் சாதனச் சோதனை"],
  camera: ["Check camera", "ക്യാമറ പരിശോധിക്കുക", "கேமராவைச் சோதிக்கவும்"],
  microphone: ["Check microphone", "മൈക്രോഫോൺ പരിശോധിക്കുക", "மைக்ரோஃபோனைச் சோதிக்கவும்"],
  stop: ["Stop and release devices", "ഉപകരണങ്ങൾ നിർത്തുക", "சாதனங்களை நிறுத்தவும்"],
  mediaActive: [
    "Local preview only. Nothing is uploaded.",
    "ലോക്കൽ പ്രിവ്യൂ മാത്രം. അപ്‌ലോഡ് ചെയ്യുന്നില്ല.",
    "உள்ளூர் முன்னோட்டம் மட்டும். பதிவேற்றம் இல்லை.",
  ],
  permissionDenied: [
    "Device access was denied or is unavailable. You can continue without it.",
    "ഉപകരണ പ്രവേശനമില്ല. അതില്ലാതെ തുടരാം.",
    "சாதன அணுகல் இல்லை. அது இல்லாமல் தொடரலாம்.",
  ],
  voice: ["Voice input", "ശബ്ദ ഇൻപുട്ട്", "குரல் உள்ளீடு"],
  draft: ["Editable message draft", "തിരുത്താവുന്ന സന്ദേശം", "திருத்தக்கூடிய செய்தி"],
  draftHelp: [
    "Review before sending. Transcription and sending are pending.",
    "അയയ്ക്കുന്നതിന് മുമ്പ് പരിശോധിക്കുക. സേവനം തയ്യാറാകുന്നു.",
    "அனுப்பும் முன் சரிபார்க்கவும். சேவை தயாராகிறது.",
  ],
  notifications: [
    "Check notification permission",
    "അറിയിപ്പ് അനുമതി പരിശോധിക്കുക",
    "அறிவிப்பு அனுமதியைச் சோதிக்கவும்",
  ],
  storage: ["Check secure storage", "സുരക്ഷിത സംഭരണം പരിശോധിക്കുക", "பாதுகாப்பான சேமிப்பைச் சோதிக்கவும்"],
  storageHelp: [
    "Synthetic marker only; no private data.",
    "പരിശോധനാ അടയാളം മാത്രം; സ്വകാര്യ വിവരങ്ങളില്ല.",
    "சோதனைக் குறி மட்டும்; தனிப்பட்ட தரவு இல்லை.",
  ],
  completed: ["Local check completed", "ലോക്കൽ പരിശോധന പൂർത്തിയായി", "உள்ளூர் சோதனை முடிந்தது"],
  checkFailed: ["Local check failed", "ലോക്കൽ പരിശോധന പരാജയപ്പെട്ടു", "உள்ளூர் சோதனை தோல்வியடைந்தது"],
  sendPending: [
    "Sending is not available yet",
    "അയയ്ക്കൽ ഇതുവരെ ലഭ്യമല്ല",
    "அனுப்புதல் இன்னும் கிடைக்கவில்லை",
  ],
  citationPending: [
    "Approved answers and citations await backend integration.",
    "അംഗീകൃത മറുപടികളും ഉറവിടങ്ങളും തയ്യാറാകുന്നു.",
    "அங்கீகரிக்கப்பட்ட பதில்களும் ஆதாரங்களும் தயாராகின்றன.",
  ],
} satisfies Record<string, readonly [string, string, string]>;
type Labels = { [K in keyof typeof rows]: string };
const labels = (index: 0 | 1 | 2) =>
  Object.fromEntries(Object.entries(rows).map(([key, values]) => [key, values[index]])) as Labels;
export const foundation: Record<Locale, Labels> = { en: labels(0), ml: labels(1), ta: labels(2) };
export function formatMoney(paise: number, locale: Locale) {
  if (!Number.isSafeInteger(paise) || paise < 0) throw new Error("Integer paise required");
  return new Intl.NumberFormat({ en: "en-IN", ml: "ml-IN", ta: "ta-IN" }[locale], {
    style: "currency",
    currency: "INR",
  }).format(paise / 100);
}
export function formatDate(value: Date, locale: Locale) {
  if (!Number.isFinite(value.getTime())) throw new Error("Valid date required");
  return new Intl.DateTimeFormat({ en: "en-IN", ml: "ml-IN", ta: "ta-IN" }[locale], {
    dateStyle: "medium",
    timeZone: "Asia/Kolkata",
  }).format(value);
}
