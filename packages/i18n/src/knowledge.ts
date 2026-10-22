import type { Locale } from "./index";

const rows = {
  editor: ["Knowledge editor", "വിജ്ഞാന എഡിറ്റർ", "அறிவுத் தொகுப்பாசிரியர்"],
  reference: ["Knowledge reference", "വിജ്ഞാന റഫറൻസ്", "அறிவுப் பதிவு குறிப்பு"],
  load: ["Load current draft", "നിലവിലെ കരട് കാണുക", "தற்போதைய வரைவைப் பெறு"],
  newDraft: ["Start a new draft", "പുതിയ കരട് ആരംഭിക്കുക", "புதிய வரைவைத் தொடங்கு"],
  title: ["Title", "ശീർഷകം", "தலைப்பு"],
  body: ["Content", "ഉള്ളടക്കം", "உள்ளடக்கம்"],
  source: ["Public source URL", "പൊതു ഉറവിട URL", "பொது ஆதார URL"],
  digest: ["Source SHA-256", "ഉറവിട SHA-256", "ஆதார SHA-256"],
  products: [
    "Product UUIDs (comma separated)",
    "ഉൽപ്പന്ന UUID-കൾ (കോമ ഉപയോഗിക്കുക)",
    "தயாரிப்பு UUID-கள் (காற்புள்ளியால் பிரி)",
  ],
  concerns: [
    "Concern UUIDs (comma separated)",
    "വിഷയ UUID-കൾ (കോമ ഉപയോഗിക്കുക)",
    "தேவை UUID-கள் (காற்புள்ளியால் பிரி)",
  ],
  medical: ["Medical", "ചികിത്സാപരം", "மருத்துவம்"],
  nonclinical: ["Nonclinical", "ചികിത്സേതരം", "மருத்துவமல்லாதது"],
  warnings: ["Approved warnings", "അംഗീകൃത മുന്നറിയിപ്പുകൾ", "அங்கீகரிக்கப்பட்ட எச்சரிக்கைகள்"],
  redFlags: ["Approved red-flag routing", "അംഗീകൃത അപകടസൂചനാ നിർദേശം", "அங்கீகரிக்கப்பட்ட அபாய வழிமுறை"],
  consultOnly: ["Consultation restrictions", "കൺസൾട്ടേഷൻ നിയന്ത്രണങ്ങൾ", "ஆலோசனைக் கட்டுப்பாடுகள்"],
  disclaimer: ["Approved disclaimer", "അംഗീകൃത അറിയിപ്പ്", "அங்கீகரிக்கப்பட்ட அறிவிப்பு"],
  save: ["Save as draft", "കരടായി സൂക്ഷിക്കുക", "வரைவாகச் சேமி"],
  request_review: [
    "Request independent review",
    "സ്വതന്ത്ര പരിശോധന ആവശ്യപ്പെടുക",
    "சுயாதீன பரிசீலனையைக் கோரு",
  ],
  approve: ["Approve current revision", "നിലവിലെ പതിപ്പ് അംഗീകരിക്കുക", "தற்போதைய பதிப்பை அங்கீகரி"],
  withdraw: ["Withdraw current revision", "നിലവിലെ പതിപ്പ് പിൻവലിക്കുക", "தற்போதைய பதிப்பை விலக்கு"],
  draft: [
    "Draft — not in retrieval",
    "കരട് — മറുപടികളിൽ ഉപയോഗിക്കില്ല",
    "வரைவு — பதில்களில் பயன்படுத்தப்படாது",
  ],
  in_review: [
    "Awaiting independent review",
    "സ്വതന്ത്ര പരിശോധനയ്ക്കായി കാത്തിരിക്കുന്നു",
    "சுயாதீன பரிசீலனை நிலுவையில்",
  ],
  approved: ["Approved revision", "അംഗീകൃത പതിപ്പ്", "அங்கீகரிக்கப்பட்ட பதிப்பு"],
  withdrawn: ["Withdrawn", "പിൻവലിച്ചു", "விலக்கப்பட்டது"],
  send: ["Send reviewed message", "പരിശോധിച്ച സന്ദേശം അയയ്ക്കുക", "சரிபார்த்த செய்தியை அனுப்பு"],
  fallback: [
    "A current approved answer is unavailable. Contact the care team for help.",
    "നിലവിലെ അംഗീകൃത മറുപടി ലഭ്യമല്ല. സഹായത്തിന് പരിചരണ സംഘവുമായി ബന്ധപ്പെടുക.",
    "தற்போதைய அங்கீகரிக்கப்பட்ட பதில் கிடைக்கவில்லை. உதவிக்கு பராமரிப்புக் குழுவை அணுகவும்.",
  ],
  intake: [
    "Clinical access requires the approved identity, consent and intake process.",
    "ചികിത്സാ പ്രവേശനത്തിന് അംഗീകൃത തിരിച്ചറിയൽ, സമ്മതം, വിവരശേഖരണം എന്നിവ ആവശ്യമാണ്.",
    "மருத்துவ அணுகலுக்கு அங்கீகரிக்கப்பட்ட அடையாளம், ஒப்புதல் மற்றும் தகவல் சேகரிப்பு தேவை.",
  ],
  actions: [
    "Actions require a separate reviewed confirmation flow. No action was executed.",
    "നടപടികൾക്ക് പ്രത്യേക പരിശോധനയും സ്ഥിരീകരണവും ആവശ്യമാണ്. നടപടിയൊന്നും നടപ്പാക്കിയിട്ടില്ല.",
    "செயல்களுக்கு தனிப் பரிசீலனையும் உறுதியும் தேவை. எந்தச் செயலும் செயல்படுத்தப்படவில்லை.",
  ],
  handoff: [
    "Request care-team help",
    "പരിചരണ സംഘത്തിന്റെ സഹായം ആവശ്യപ്പെടുക",
    "பராமரிப்புக் குழு உதவியைக் கோரு",
  ],
  queued: [
    "Request queued. A live agent has not joined.",
    "അഭ്യർത്ഥന ക്യൂവിലാണ്. ജീവനക്കാരൻ ഇതുവരെ ചേർന്നിട്ടില്ല.",
    "கோரிக்கை வரிசையில் உள்ளது. நேரடி உதவியாளர் இன்னும் இணையவில்லை.",
  ],
  citations: ["Current approved sources", "നിലവിലെ അംഗീകൃത ഉറവിടങ്ങൾ", "தற்போதைய அங்கீகரிக்கப்பட்ட ஆதாரங்கள்"],
  approver: ["Approved by", "അംഗീകരിച്ചത്", "அங்கீகரித்தவர்"],
  refresh: [
    "Recheck current sources",
    "നിലവിലെ ഉറവിടങ്ങൾ വീണ്ടും പരിശോധിക്കുക",
    "தற்போதைய ஆதாரங்களை மீண்டும் சரிபார்",
  ],
  voice: [
    "Review and edit voice text before sending. Upload/transcription integration is pending.",
    "അയയ്ക്കുന്നതിന് മുമ്പ് ശബ്ദത്തിൽ നിന്നുള്ള എഴുത്ത് പരിശോധിച്ച് തിരുത്തുക. അപ്‌ലോഡ്/എഴുത്താക്കൽ സംവിധാനം തയ്യാറായിട്ടില്ല.",
    "அனுப்பும் முன் குரல் உரையைச் சரிபார்த்து திருத்தவும். பதிவேற்றம்/உரைமாற்ற இணைப்பு நிலுவையில் உள்ளது.",
  ],
  editorHelp: [
    "Use approved public sources only. Do not paste patient records. Saving does not approve or publish.",
    "അംഗീകൃത പൊതു ഉറവിടങ്ങൾ മാത്രം ഉപയോഗിക്കുക. രോഗിയുടെ രേഖകൾ ചേർക്കരുത്. സൂക്ഷിക്കുന്നത് അംഗീകാരമോ പ്രസിദ്ധീകരണമോ അല്ല.",
    "அங்கீகரிக்கப்பட்ட பொது ஆதாரங்களை மட்டும் பயன்படுத்து. நோயாளர் பதிவுகளை இட வேண்டாம். சேமிப்பது அங்கீகாரமோ வெளியீடோ அல்ல.",
  ],
} satisfies Record<string, readonly [string, string, string]>;
type Labels = { [K in keyof typeof rows]: string };
const labels = (index: 0 | 1 | 2) =>
  Object.fromEntries(Object.entries(rows).map(([key, value]) => [key, value[index]])) as Labels;
export const knowledgeText: Record<Locale, Labels> = {
  en: labels(0),
  ml: labels(1),
  ta: labels(2),
};
