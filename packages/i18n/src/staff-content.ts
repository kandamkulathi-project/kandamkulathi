import type { Locale } from "./index";

// NONCLINICAL DEVELOPMENT COPY ONLY. All three languages are draft/unreviewed.
// No medical text, translation approval or company permission matrix is supplied.
const en = {
  heading: "Knowledge editor",
  unreviewed:
    "Draft interface labels — unreviewed. Medical wording and translation approvals are absent.",
  loading: "Loading the supplied record…",
  empty: "No record was supplied. This is not a complete content or translation inventory.",
  error: "The record could not be loaded. Retry the authorized read.",
  invalid: "Invalid record or session. Content is hidden.",
  denied: "Access denied. Content is hidden.",
  anonymous: "A current staff or physician session is required.",
  pending:
    "Source/authoring integration pending. Browser authoring requires the same approved Core and Companion origin.",
  suspended: "Content and local edits cleared. Refresh to request current authorized data.",
  refresh: "Refresh record",
  reported: "Supplied record state (not current publication authorization)",
  draft: "Draft",
  approved: "Approved",
  withdrawn: "Withdrawn",
  version: "Revision",
  entry: "Entry ID",
  hash: "Content hash",
  previous: "Previous content hash",
  none: "None — first revision",
  language: "Source language",
  kind: "Content kind",
  editor: "Recorded editor",
  provenance: "Source provenance",
  source: "Source ID",
  sourceHash: "Source SHA-256",
  citations: "Citations",
  exact: "Exact supplied text — interface language does not translate this content.",
  title: "Local title draft",
  body: "Local text draft",
  draftHelp:
    "Local only; never saved or submitted. Refresh, session changes and backgrounding clear edits.",
  invalidDraft: "Enter a nonblank title (up to 200 characters) and text (up to 16000 characters).",
  localOnly: "Local draft only — not saved, approved or published.",
  save: "Save draft — pending",
  saveEnabled: "Save new draft revision",
  approveEnabled: "Approve this revision",
  withdrawEnabled: "Withdraw this revision",
  checking: "Checking current scoped authoring authority…",
  submitting: "Submitting once. The result is not yet confirmed…",
  reloading: "Reloading the persisted current record…",
  conflict: "The current record changed. Edits cleared; refresh before another action.",
  unknown:
    "The operation outcome is unknown. Edits cleared; refresh and reconcile before any further action. No mutation was retried.",
  authorityReady:
    "Current scoped authoring authority checked. The server must independently revalidate every action.",
  authorityDenied:
    "No matching current authoring grant. Workspace roles do not enable these actions.",
  authorityError: "Authoring authority could not be checked. Actions remain disabled.",
  unsaved: "Save or discard local edits before approving or withdrawing the recorded revision.",
  sourcePending:
    "Complete matching pre-reviewed public source bytes are missing or invalid. Saving remains pending.",
  sourceFiles: "Local public source files",
  sourcePrerequisites:
    "Select only explicitly public, pre-reviewed source files with approved publication rights. Never select private clinical or patient data. Hash matching is not rights or medical approval; the server revalidates current authority.",
  sourceFileLimit:
    "One file per source ID; 1–48000 bytes each. The complete UTF-8 JSON request must fit 65536 bytes including content, provenance and base64. Larger combined drafts cannot be sent.",
  sourceFile: "File for source",
  clearFiles: "Clear all local files",
  file_missing: "No file selected — local only, nothing uploaded.",
  file_hashing: "Checking actual file bytes locally… Nothing uploaded.",
  file_ready: "SHA-256 matches registered provenance. Local only until explicit Save.",
  file_mismatch: "File SHA-256 does not match this source. Nothing uploaded.",
  file_size: "File must contain 1–48000 bytes. Nothing uploaded.",
  file_duplicate: "Select exactly one file for this source ID. Nothing uploaded.",
  file_error: "File could not be read or hashed. Nothing uploaded.",
  sourceBodySize:
    "The complete draft exceeds the 65536-byte UTF-8 JSON request limit. Reduce content/source size through approved provenance; nothing was sent.",
  oversized:
    "The server rejected the request size (413). Local content/files cleared; refresh before a new action.",
  authoringDraftHelp:
    "Save explicitly submits a new chained draft revision with pre-reviewed public source bytes. Refresh, session changes and backgrounding clear edits.",
  approval: "Independent physician approval",
  approver: "Recorded approver",
  approvedAt: "Recorded approval time",
  withdrawal: "Recorded withdrawal",
  selfApproval: "Self-approval denied. UUID spelling aliases identify the same editor.",
  approvalPending:
    "Independent current physician qualification and scoped approval authority must be verified by the server. Workspace access is not approval permission.",
  approve: "Approve — unavailable",
  withdraw: "Withdraw — unavailable",
  immutable:
    "Approved and withdrawn records are read-only. Changes require a new chained draft and independent approval.",
  verification:
    "Schema validation only: source bytes, content integrity, current grants and publication must be verified by the authoritative backend. No clinical use is authorized here.",
};

type ContentLabels = { [Key in keyof typeof en]: string };
export const staffContent = {
  en,
  ml: {
    heading: "വിജ്ഞാന എഡിറ്റർ",
    unreviewed:
      "കരട് ഇന്റർഫേസ് വാക്കുകൾ — അവലോകനം ചെയ്തിട്ടില്ല. വൈദ്യവാചകങ്ങൾക്കും വിവർത്തനങ്ങൾക്കും അംഗീകാരം ലഭ്യമല്ല.",
    loading: "നൽകിയ രേഖ ലോഡ് ചെയ്യുന്നു…",
    empty: "രേഖ നൽകിയിട്ടില്ല. ഇത് പൂർണ്ണ ഉള്ളടക്കമോ വിവർത്തന പട്ടികയോ അല്ല.",
    error: "രേഖ ലോഡ് ചെയ്യാനായില്ല. അനുമതിയുള്ള വായന വീണ്ടും ശ്രമിക്കുക.",
    invalid: "രേഖയോ സെഷനോ അസാധുവാണ്. ഉള്ളടക്കം മറച്ചിരിക്കുന്നു.",
    denied: "പ്രവേശനം നിരസിച്ചു. ഉള്ളടക്കം മറച്ചിരിക്കുന്നു.",
    anonymous: "നിലവിലുള്ള സ്റ്റാഫ് അല്ലെങ്കിൽ വൈദ്യ സെഷൻ ആവശ്യമാണ്.",
    pending:
      "ഉറവിട/എഴുത്ത് സംയോജനം തയ്യാറായിട്ടില്ല. ബ്രൗസർ എഴുത്തിന് Core, Companion എന്നിവയ്ക്ക് ഒരേ അംഗീകൃത ഓറിജിൻ വേണം.",
    suspended: "ഉള്ളടക്കവും പ്രാദേശിക മാറ്റങ്ങളും നീക്കി. നിലവിലെ അനുമതിയുള്ള വിവരങ്ങൾക്ക് പുതുക്കുക.",
    refresh: "രേഖ പുതുക്കുക",
    reported: "നൽകിയ രേഖയുടെ നില (നിലവിലെ പ്രസിദ്ധീകരണ അനുമതിയല്ല)",
    draft: "കരട്",
    approved: "അംഗീകരിച്ചത്",
    withdrawn: "പിൻവലിച്ചത്",
    version: "പതിപ്പ്",
    entry: "രേഖയുടെ ID",
    hash: "ഉള്ളടക്ക ഹാഷ്",
    previous: "മുൻ ഉള്ളടക്ക ഹാഷ്",
    none: "ഇല്ല — ആദ്യ പതിപ്പ്",
    language: "മൂല ഭാഷ",
    kind: "ഉള്ളടക്ക തരം",
    editor: "രേഖപ്പെടുത്തിയ എഡിറ്റർ",
    provenance: "ഉറവിട വിവരങ്ങൾ",
    source: "ഉറവിട ID",
    sourceHash: "ഉറവിട SHA-256",
    citations: "അവലംബങ്ങൾ",
    exact: "നൽകിയ അതേ വാചകം — ഇന്റർഫേസ് ഭാഷ ഉള്ളടക്കം വിവർത്തനം ചെയ്യുന്നില്ല.",
    title: "പ്രാദേശിക തലക്കെട്ട് കരട്",
    body: "പ്രാദേശിക വാചക കരട്",
    draftHelp:
      "പ്രാദേശികം മാത്രം; സംരക്ഷിക്കുകയോ സമർപ്പിക്കുകയോ ചെയ്യുന്നില്ല. പുതുക്കൽ, സെഷൻ മാറ്റം, പശ്ചാത്തലത്തിലാകൽ എന്നിവ മാറ്റങ്ങൾ നീക്കും.",
    invalidDraft: "ശൂന്യമല്ലാത്ത തലക്കെട്ടും (200 അക്ഷരം വരെ) വാചകവും (16000 അക്ഷരം വരെ) നൽകുക.",
    localOnly: "പ്രാദേശിക കരട് മാത്രം — സംരക്ഷിച്ചതോ അംഗീകരിച്ചതോ പ്രസിദ്ധീകരിച്ചതോ അല്ല.",
    save: "കരട് സംരക്ഷിക്കൽ — ലഭ്യമല്ല",
    saveEnabled: "പുതിയ കരട് പതിപ്പ് സംരക്ഷിക്കുക",
    approveEnabled: "ഈ പതിപ്പ് അംഗീകരിക്കുക",
    withdrawEnabled: "ഈ പതിപ്പ് പിൻവലിക്കുക",
    checking: "നിലവിലെ നിർദ്ദിഷ്ട എഴുത്ത് അധികാരം പരിശോധിക്കുന്നു…",
    submitting: "ഒരിക്കൽ സമർപ്പിക്കുന്നു. ഫലം ഇതുവരെ സ്ഥിരീകരിച്ചിട്ടില്ല…",
    reloading: "സംരക്ഷിച്ച നിലവിലെ രേഖ വീണ്ടും ലോഡ് ചെയ്യുന്നു…",
    conflict: "നിലവിലെ രേഖ മാറി. മാറ്റങ്ങൾ നീക്കി; മറ്റൊരു പ്രവർത്തനത്തിന് മുമ്പ് പുതുക്കുക.",
    unknown:
      "പ്രവർത്തന ഫലം വ്യക്തമല്ല. മാറ്റങ്ങൾ നീക്കി; തുടർ പ്രവർത്തനത്തിന് മുമ്പ് പുതുക്കി ഫലം പരിശോധിക്കുക. സമർപ്പണം വീണ്ടും ശ്രമിച്ചിട്ടില്ല.",
    authorityReady:
      "നിലവിലെ നിർദ്ദിഷ്ട എഴുത്ത് അധികാരം പരിശോധിച്ചു. ഓരോ പ്രവർത്തനവും സെർവർ വീണ്ടും സ്വതന്ത്രമായി പരിശോധിക്കണം.",
    authorityDenied:
      "പൊരുത്തപ്പെടുന്ന നിലവിലെ എഴുത്ത് അനുമതിയില്ല. പ്രവർത്തനസ്ഥല പദവികൾ ഈ പ്രവർത്തനങ്ങൾ അനുവദിക്കുന്നില്ല.",
    authorityError: "എഴുത്ത് അധികാരം പരിശോധിക്കാനായില്ല. പ്രവർത്തനങ്ങൾ ലഭ്യമല്ല.",
    unsaved:
      "രേഖപ്പെടുത്തിയ പതിപ്പ് അംഗീകരിക്കുന്നതിനോ പിൻവലിക്കുന്നതിനോ മുമ്പ് പ്രാദേശിക മാറ്റങ്ങൾ സംരക്ഷിക്കുകയോ ഉപേക്ഷിക്കുകയോ ചെയ്യുക.",
    sourcePending:
      "പൊരുത്തപ്പെടുന്ന മുൻകൂട്ടി അവലോകനം ചെയ്ത പൂർണ്ണ പൊതുഉറവിട ബൈറ്റുകൾ ലഭ്യമല്ല അല്ലെങ്കിൽ അസാധുവാണ്. സംരക്ഷിക്കൽ ലഭ്യമല്ല.",
    sourceFiles: "പ്രാദേശിക പൊതുഉറവിട ഫയലുകൾ",
    sourcePrerequisites:
      "പ്രസിദ്ധീകരണ അവകാശമുള്ള, പൊതുവായ, മുൻകൂട്ടി അവലോകനം ചെയ്ത ഉറവിട ഫയലുകൾ മാത്രം തിരഞ്ഞെടുക്കുക. സ്വകാര്യ ചികിത്സാ/രോഗി വിവരങ്ങൾ ഒരിക്കലും തിരഞ്ഞെടുക്കരുത്. ഹാഷ് പൊരുത്തം അവകാശമോ വൈദ്യ അംഗീകാരമോ അല്ല; സെർവർ നിലവിലെ അധികാരം വീണ്ടും പരിശോധിക്കും.",
    sourceFileLimit:
      "ഓരോ ഉറവിട ID-ക്കും ഒരു ഫയൽ; 1–48000 ബൈറ്റുകൾ. ഉള്ളടക്കം, ഉറവിടവിവരം, base64 എന്നിവ ഉൾപ്പെടുന്ന പൂർണ്ണ UTF-8 JSON അഭ്യർത്ഥന 65536 ബൈറ്റിൽ ഒതുങ്ങണം.",
    sourceFile: "ഉറവിടത്തിനുള്ള ഫയൽ",
    clearFiles: "എല്ലാ പ്രാദേശിക ഫയലുകളും നീക്കുക",
    file_missing: "ഫയൽ തിരഞ്ഞെടുത്തിട്ടില്ല — പ്രാദേശികം മാത്രം, അപ്‌ലോഡ് ചെയ്തിട്ടില്ല.",
    file_hashing: "യഥാർത്ഥ ഫയൽ ബൈറ്റുകൾ പ്രാദേശികമായി പരിശോധിക്കുന്നു… അപ്‌ലോഡ് ചെയ്തിട്ടില്ല.",
    file_ready: "SHA-256 രേഖപ്പെടുത്തിയ ഉറവിടവുമായി പൊരുത്തപ്പെടുന്നു. വ്യക്തമായി സംരക്ഷിക്കുന്നതുവരെ പ്രാദേശികം മാത്രം.",
    file_mismatch: "ഫയലിന്റെ SHA-256 ഈ ഉറവിടവുമായി പൊരുത്തപ്പെടുന്നില്ല. അപ്‌ലോഡ് ചെയ്തിട്ടില്ല.",
    file_size: "ഫയലിൽ 1–48000 ബൈറ്റുകൾ വേണം. അപ്‌ലോഡ് ചെയ്തിട്ടില്ല.",
    file_duplicate: "ഈ ഉറവിട ID-ക്ക് കൃത്യമായി ഒരു ഫയൽ തിരഞ്ഞെടുക്കുക. അപ്‌ലോഡ് ചെയ്തിട്ടില്ല.",
    file_error: "ഫയൽ വായിക്കാനോ ഹാഷ് പരിശോധിക്കാനോ കഴിഞ്ഞില്ല. അപ്‌ലോഡ് ചെയ്തിട്ടില്ല.",
    sourceBodySize:
      "പൂർണ്ണ കരട് 65536-ബൈറ്റ് UTF-8 JSON പരിധി കടക്കുന്നു. അംഗീകൃത ഉറവിടക്രമത്തിലൂടെ വലിപ്പം കുറയ്ക്കുക; ഒന്നും അയച്ചിട്ടില്ല.",
    oversized:
      "സെർവർ അഭ്യർത്ഥനാ വലിപ്പം നിരസിച്ചു (413). പ്രാദേശിക ഉള്ളടക്കവും ഫയലുകളും നീക്കി; പുതിയ പ്രവർത്തനത്തിന് മുമ്പ് പുതുക്കുക.",
    authoringDraftHelp:
      "സംരക്ഷിക്കൽ മുൻകൂട്ടി അവലോകനം ചെയ്ത പൊതുഉറവിട ബൈറ്റുകളോടെ ബന്ധിപ്പിച്ച പുതിയ കരട് പതിപ്പ് സമർപ്പിക്കും. പുതുക്കൽ, സെഷൻ മാറ്റം, പശ്ചാത്തലത്തിലാകൽ എന്നിവ മാറ്റങ്ങൾ നീക്കും.",
    approval: "സ്വതന്ത്ര വൈദ്യ അംഗീകാരം",
    approver: "രേഖപ്പെടുത്തിയ അംഗീകാരദാതാവ്",
    approvedAt: "രേഖപ്പെടുത്തിയ അംഗീകാര സമയം",
    withdrawal: "രേഖപ്പെടുത്തിയ പിൻവലിക്കൽ",
    selfApproval: "സ്വയം അംഗീകാരം നിരസിച്ചു. UUID അക്ഷരരൂപ വ്യത്യാസം മറ്റൊരു എഡിറ്ററല്ല.",
    approvalPending:
      "നിലവിലെ വൈദ്യ യോഗ്യതയും നിർദ്ദിഷ്ട അംഗീകാര അധികാരവും സെർവർ പരിശോധിക്കണം. പ്രവർത്തനസ്ഥല പ്രവേശനം അംഗീകാര അനുമതിയല്ല.",
    approve: "അംഗീകരിക്കൽ — ലഭ്യമല്ല",
    withdraw: "പിൻവലിക്കൽ — ലഭ്യമല്ല",
    immutable:
      "അംഗീകരിച്ചതും പിൻവലിച്ചതുമായ രേഖകൾ വായിക്കാൻ മാത്രം. മാറ്റങ്ങൾക്ക് ബന്ധിപ്പിച്ച പുതിയ കരടും സ്വതന്ത്ര അംഗീകാരവും വേണം.",
    verification:
      "സ്കീമ പരിശോധന മാത്രം: ഉറവിട ബൈറ്റുകൾ, ഉള്ളടക്ക സമഗ്രത, നിലവിലെ അനുമതികൾ, പ്രസിദ്ധീകരണം എന്നിവ അധികാരമുള്ള ബാക്കെൻഡ് പരിശോധിക്കണം. ഇവിടെ വൈദ്യ ഉപയോഗത്തിന് അനുമതിയില്ല.",
  },
  ta: {
    heading: "அறிவுத் தொகுப்பு திருத்தி",
    unreviewed:
      "வரைவு இடைமுகச் சொற்கள் — மதிப்பாய்வு செய்யப்படவில்லை. மருத்துவ உரை மற்றும் மொழிபெயர்ப்பு ஒப்புதல்கள் இல்லை.",
    loading: "வழங்கிய பதிவை ஏற்றுகிறது…",
    empty: "பதிவு வழங்கப்படவில்லை. இது முழு உள்ளடக்க அல்லது மொழிபெயர்ப்புப் பட்டியல் அல்ல.",
    error: "பதிவை ஏற்ற முடியவில்லை. அனுமதியுள்ள வாசிப்பை மீண்டும் முயலவும்.",
    invalid: "தவறான பதிவு அல்லது அமர்வு. உள்ளடக்கம் மறைக்கப்பட்டுள்ளது.",
    denied: "அணுகல் மறுக்கப்பட்டது. உள்ளடக்கம் மறைக்கப்பட்டுள்ளது.",
    anonymous: "நடப்பு ஊழியர் அல்லது மருத்துவர் அமர்வு தேவை.",
    pending:
      "மூல/எழுதும் ஒருங்கிணைப்பு நிலுவையில் உள்ளது. உலாவியில் எழுத Core, Companion இரண்டுக்கும் ஒரே அங்கீகரிக்கப்பட்ட origin தேவை.",
    suspended: "உள்ளடக்கமும் உள்ளூர் மாற்றங்களும் அகற்றப்பட்டன. நடப்பு அனுமதியுள்ள தரவைக் கோர புதுப்பிக்கவும்.",
    refresh: "பதிவைப் புதுப்பிக்கவும்",
    reported: "வழங்கிய பதிவின் நிலை (நடப்பு வெளியீட்டு அனுமதி அல்ல)",
    draft: "வரைவு",
    approved: "ஒப்புதல் பெற்றது",
    withdrawn: "திரும்பப் பெறப்பட்டது",
    version: "பதிப்பு",
    entry: "பதிவு ID",
    hash: "உள்ளடக்க ஹாஷ்",
    previous: "முந்தைய உள்ளடக்க ஹாஷ்",
    none: "இல்லை — முதல் பதிப்பு",
    language: "மூல மொழி",
    kind: "உள்ளடக்க வகை",
    editor: "பதிவுசெய்த திருத்துநர்",
    provenance: "மூலத் தகவல்கள்",
    source: "மூல ID",
    sourceHash: "மூல SHA-256",
    citations: "மேற்கோள்கள்",
    exact: "வழங்கிய அதே உரை — இடைமுக மொழி இந்த உள்ளடக்கத்தை மொழிபெயர்க்காது.",
    title: "உள்ளூர் தலைப்பு வரைவு",
    body: "உள்ளூர் உரை வரைவு",
    draftHelp:
      "உள்ளூரில் மட்டும்; சேமிக்கவோ சமர்ப்பிக்கவோ இல்லை. புதுப்பித்தல், அமர்வு மாற்றம் மற்றும் பின்னணிக்குச் செல்லுதல் மாற்றங்களை அகற்றும்.",
    invalidDraft: "வெறுமையற்ற தலைப்பு (200 எழுத்துகள் வரை) மற்றும் உரையை (16000 எழுத்துகள் வரை) உள்ளிடவும்.",
    localOnly: "உள்ளூர் வரைவு மட்டும் — சேமிக்கவோ ஒப்புதல் பெறவோ வெளியிடவோ இல்லை.",
    save: "வரைவு சேமிப்பு — நிலுவை",
    saveEnabled: "புதிய வரைவு பதிப்பைச் சேமிக்கவும்",
    approveEnabled: "இந்தப் பதிப்பை ஒப்புதல் அளிக்கவும்",
    withdrawEnabled: "இந்தப் பதிப்பைத் திரும்பப்பெறவும்",
    checking: "நடப்பு குறிப்பிட்ட எழுதும் அதிகாரத்தைச் சரிபார்க்கிறது…",
    submitting: "ஒருமுறை சமர்ப்பிக்கிறது. முடிவு இன்னும் உறுதிப்படுத்தப்படவில்லை…",
    reloading: "சேமிக்கப்பட்ட நடப்பு பதிவை மீண்டும் ஏற்றுகிறது…",
    conflict: "நடப்பு பதிவு மாறிவிட்டது. மாற்றங்கள் அகற்றப்பட்டன; மற்றொரு செயலுக்கு முன் புதுப்பிக்கவும்.",
    unknown:
      "செயலின் முடிவு தெரியவில்லை. மாற்றங்கள் அகற்றப்பட்டன; அடுத்த செயலுக்கு முன் புதுப்பித்து முடிவைச் சரிபார்க்கவும். சமர்ப்பிப்பு மீண்டும் முயலப்படவில்லை.",
    authorityReady:
      "நடப்பு குறிப்பிட்ட எழுதும் அதிகாரம் சரிபார்க்கப்பட்டது. ஒவ்வொரு செயலையும் சேவையகம் மீண்டும் சுயாதீனமாகச் சரிபார்க்க வேண்டும்.",
    authorityDenied: "பொருந்தும் நடப்பு எழுதும் அனுமதி இல்லை. பணியிடப் பங்குகள் இந்தச் செயல்களை அனுமதிக்காது.",
    authorityError: "எழுதும் அதிகாரத்தைச் சரிபார்க்க முடியவில்லை. செயல்கள் முடக்கப்பட்டுள்ளன.",
    unsaved:
      "பதிவுசெய்த பதிப்பை ஒப்புதல் அளிக்கவோ திரும்பப்பெறவோ முன் உள்ளூர் மாற்றங்களைச் சேமிக்கவும் அல்லது கைவிடவும்.",
    sourcePending:
      "பொருந்தும் முன் மதிப்பாய்வு செய்யப்பட்ட முழு பொது மூல பைட்டுகள் இல்லை அல்லது தவறானவை. சேமித்தல் நிலுவையில் உள்ளது.",
    sourceFiles: "உள்ளூர் பொது மூலக் கோப்புகள்",
    sourcePrerequisites:
      "வெளியீட்டு உரிமையுள்ள, வெளிப்படையாகப் பொது மற்றும் முன் மதிப்பாய்வு செய்யப்பட்ட மூலக் கோப்புகளை மட்டும் தேர்ந்தெடுக்கவும். தனிப்பட்ட மருத்துவ அல்லது நோயாளித் தரவை ஒருபோதும் தேர்ந்தெடுக்க வேண்டாம். ஹாஷ் பொருத்தம் உரிமையோ மருத்துவ ஒப்புதலோ அல்ல; சேவையகம் நடப்பு அதிகாரத்தை மீண்டும் சரிபார்க்கும்.",
    sourceFileLimit:
      "ஒவ்வொரு மூல ID-க்கும் ஒரு கோப்பு; தலா 1–48000 பைட்டுகள். உள்ளடக்கம், மூலத் தகவல், base64 உட்பட முழு UTF-8 JSON கோரிக்கை 65536 பைட்டுகளில் இருக்க வேண்டும்.",
    sourceFile: "மூலத்திற்கான கோப்பு",
    clearFiles: "அனைத்து உள்ளூர் கோப்புகளையும் அகற்றவும்",
    file_missing: "கோப்பு தேர்ந்தெடுக்கப்படவில்லை — உள்ளூரில் மட்டும், பதிவேற்றம் இல்லை.",
    file_hashing: "உண்மையான கோப்பு பைட்டுகளை உள்ளூரில் சரிபார்க்கிறது… பதிவேற்றம் இல்லை.",
    file_ready: "SHA-256 பதிவுசெய்த மூலத்துடன் பொருந்துகிறது. வெளிப்படையாகச் சேமிக்கும் வரை உள்ளூரில் மட்டும்.",
    file_mismatch: "கோப்பின் SHA-256 இந்த மூலத்துடன் பொருந்தவில்லை. பதிவேற்றம் இல்லை.",
    file_size: "கோப்பில் 1–48000 பைட்டுகள் இருக்க வேண்டும். பதிவேற்றம் இல்லை.",
    file_duplicate: "இந்த மூல ID-க்கு சரியாக ஒரு கோப்பைத் தேர்ந்தெடுக்கவும். பதிவேற்றம் இல்லை.",
    file_error: "கோப்பைப் படிக்கவோ ஹாஷ் கணக்கிடவோ முடியவில்லை. பதிவேற்றம் இல்லை.",
    sourceBodySize:
      "முழு வரைவு 65536-பைட் UTF-8 JSON வரம்பை மீறுகிறது. அங்கீகரிக்கப்பட்ட மூல நடைமுறையில் அளவைக் குறைக்கவும்; எதுவும் அனுப்பப்படவில்லை.",
    oversized:
      "சேவையகம் கோரிக்கை அளவை நிராகரித்தது (413). உள்ளூர் உள்ளடக்கமும் கோப்புகளும் அகற்றப்பட்டன; புதிய செயலுக்கு முன் புதுப்பிக்கவும்.",
    authoringDraftHelp:
      "சேமித்தல் முன் மதிப்பாய்வு செய்யப்பட்ட பொது மூல பைட்டுகளுடன் இணைக்கப்பட்ட புதிய வரைவு பதிப்பைச் சமர்ப்பிக்கும். புதுப்பித்தல், அமர்வு மாற்றம் மற்றும் பின்னணிக்குச் செல்லுதல் மாற்றங்களை அகற்றும்.",
    approval: "சுயாதீன மருத்துவர் ஒப்புதல்",
    approver: "பதிவுசெய்த ஒப்புதலாளர்",
    approvedAt: "பதிவுசெய்த ஒப்புதல் நேரம்",
    withdrawal: "பதிவுசெய்த திரும்பப்பெறுதல்",
    selfApproval: "சுய ஒப்புதல் மறுக்கப்பட்டது. UUID எழுத்து வேறுபாடு வேறொரு திருத்துநரைக் குறிக்காது.",
    approvalPending:
      "நடப்பு மருத்துவர் தகுதியையும் குறிப்பிட்ட ஒப்புதல் அதிகாரத்தையும் சேவையகம் சரிபார்க்க வேண்டும். பணியிட அணுகல் ஒப்புதல் அனுமதி அல்ல.",
    approve: "ஒப்புதல் — கிடைக்கவில்லை",
    withdraw: "திரும்பப்பெறுதல் — கிடைக்கவில்லை",
    immutable:
      "ஒப்புதல் பெற்ற மற்றும் திரும்பப்பெற்ற பதிவுகள் வாசிக்க மட்டும். மாற்றங்களுக்கு இணைக்கப்பட்ட புதிய வரைவுடன் சுயாதீன ஒப்புதல் தேவை.",
    verification:
      "ஸ்கீமா சரிபார்ப்பு மட்டும்: மூல பைட்டுகள், உள்ளடக்க ஒருமைப்பாடு, நடப்பு அனுமதிகள் மற்றும் வெளியீட்டை அதிகாரமுள்ள பின்தளம் சரிபார்க்க வேண்டும். இங்கு மருத்துவப் பயன்பாட்டுக்கு அனுமதியில்லை.",
  },
} satisfies Record<Locale, ContentLabels>;
