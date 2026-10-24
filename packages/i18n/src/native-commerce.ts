import type { Locale } from "./index";

/** Draft NONCLINICAL operational copy. Company language review remains pending. */
export const nativeCommerceTranslationReview = "draft-unreviewed-nonclinical" as const;
const rows = {
  translationNotice: [
    "Checkout interface translations are drafts; company language review is pending.",
    "ചെക്ക്ഔട്ട് ഇന്റർഫേസ് വിവർത്തനങ്ങൾ കരടുകളാണ്; കമ്പനിയുടെ ഭാഷാ അവലോകനം ബാക്കിയുണ്ട്.",
    "செக்அவுட் இடைமுக மொழிபெயர்ப்புகள் வரைவுகள்; நிறுவன மொழி மதிப்பாய்வு நிலுவையில் உள்ளது.",
  ],
  recipientName: ["Recipient name", "സ്വീകർത്താവിന്റെ പേര്", "பெறுநர் பெயர்"],
  line1: ["Address line 1", "വിലാസം വരി 1", "முகவரி வரி 1"],
  line2: ["Address line 2 (optional)", "വിലാസം വരി 2 (ഐച്ഛികം)", "முகவரி வரி 2 (விருப்பம்)"],
  city: ["City", "നഗരം", "நகரம்"],
  region: ["State / union territory", "സംസ്ഥാനം / കേന്ദ്രഭരണ പ്രദേശം", "மாநிலம் / ஒன்றியப் பகுதி"],
  postalCode: ["PIN code (6 digits)", "പിൻ കോഡ് (6 അക്കങ്ങൾ)", "அஞ்சல் குறியீடு (6 இலக்கங்கள்)"],
  contactPhone: [
    "Contact phone (international format, e.g. +91…)",
    "ബന്ധപ്പെടാനുള്ള ഫോൺ (അന്താരാഷ്ട്ര രൂപം, ഉദാ. +91…)",
    "தொடர்பு தொலைபேசி (சர்வதேச வடிவம், எ.கா. +91…)",
  ],
  invalid: [
    "Choose a clinic and at least one SKU. Check the marked delivery fields and quantities before requesting a quote.",
    "ഒരു ക്ലിനിക്കും കുറഞ്ഞത് ഒരു SKU-വും തിരഞ്ഞെടുക്കുക. വിലവിവരം ആവശ്യപ്പെടുന്നതിന് മുമ്പ് അടയാളപ്പെടുത്തിയ വിതരണ വിലാസവും അളവുകളും പരിശോധിക്കുക.",
    "ஒரு கிளினிக்கையும் குறைந்தது ஒரு SKU-வையும் தேர்ந்தெடுக்கவும். விலை விவரம் கோரும் முன் குறிக்கப்பட்ட விநியோகப் புலங்களையும் அளவுகளையும் சரிபார்க்கவும்.",
  ],
  uncertain: [
    "The outcome is uncertain. Keep this screen open. Retry the SAME operation; do not start another order or payment.",
    "ഫലം ഉറപ്പില്ല. ഈ സ്ക്രീൻ തുറന്നുവയ്ക്കുക. അതേ നടപടി വീണ്ടും ശ്രമിക്കുക; മറ്റൊരു ഓർഡറോ പണമടയ്ക്കലോ ആരംഭിക്കരുത്.",
    "முடிவு உறுதியாகத் தெரியவில்லை. இந்தத் திரையைத் திறந்தே வைக்கவும். அதே செயல்பாட்டை மீண்டும் முயலவும்; மற்றொரு ஆர்டரையோ கட்டணத்தையோ தொடங்க வேண்டாம்.",
  ],
  conflict: [
    "Price, stock or operation changed. Request a fresh server quote before confirming.",
    "വിലയിലോ സ്റ്റോക്കിലോ നടപടിയിലോ മാറ്റമുണ്ട്. സ്ഥിരീകരിക്കുന്നതിന് മുമ്പ് സെർവറിൽ നിന്ന് പുതിയ വിലവിവരം ആവശ്യപ്പെടുക.",
    "விலை, இருப்பு அல்லது செயல்பாடு மாறியுள்ளது. உறுதிப்படுத்தும் முன் சேவையகத்திலிருந்து புதிய விலை விவரத்தைக் கோரவும்.",
  ],
  error: [
    "The response could not be verified. Retry current server data.",
    "മറുപടി പരിശോധിച്ച് ഉറപ്പാക്കാനായില്ല. നിലവിലെ സെർവർ വിവരങ്ങൾ വീണ്ടും ലഭ്യമാക്കുക.",
    "பதிலைச் சரிபார்க்க முடியவில்லை. தற்போதைய சேவையகத் தரவை மீண்டும் பெற முயலவும்.",
  ],
  restored: [
    "Recovered operation details are last-known, not current success. Retry the same checkout/payment operation or read/reconcile the existing intent to obtain current server state.",
    "വീണ്ടെടുത്ത നടപടിവിവരങ്ങൾ അവസാനം ലഭ്യമായവയാണ്; നിലവിലെ വിജയസ്ഥിതി അല്ല. നിലവിലെ സെർവർ സ്ഥിതി ലഭിക്കാൻ അതേ ചെക്ക്ഔട്ട്/പണമടയ്ക്കൽ നടപടി വീണ്ടും ശ്രമിക്കുക, അല്ലെങ്കിൽ നിലവിലുള്ള പണമടയ്ക്കൽ അഭ്യർത്ഥന വായിക്കുക/ഒത്തുനോക്കുക.",
    "மீட்டெடுக்கப்பட்ட செயல்பாட்டு விவரங்கள் கடைசியாக அறியப்பட்டவை; தற்போதைய வெற்றி நிலை அல்ல. தற்போதைய சேவையக நிலையைப் பெற அதே செக்அவுட்/கட்டணச் செயல்பாட்டை மீண்டும் முயலவும் அல்லது ஏற்கெனவே உள்ள கட்டணக் கோரிக்கையைப் படிக்கவும்/ஒப்பிட்டுச் சரிபார்க்கவும்.",
  ],
  sessionHidden: [
    "Shopping data is hidden. Restore a current authorized session to continue; payment completion is never assumed.",
    "വാങ്ങൽ വിവരങ്ങൾ മറച്ചിരിക്കുന്നു. തുടരാൻ നിലവിലെ അനുമതിയുള്ള സെഷൻ പുനഃസ്ഥാപിക്കുക; പണമടയ്ക്കൽ പൂർത്തിയായെന്ന് അനുമാനിക്കില്ല.",
    "வாங்குதல் தரவு மறைக்கப்பட்டுள்ளது. தொடர தற்போதைய அங்கீகரிக்கப்பட்ட அமர்வை மீட்டெடுக்கவும்; கட்டணம் முடிந்ததாகக் கருதப்படாது.",
  ],
  refreshSession: ["Refresh session", "സെഷൻ പുതുക്കുക", "அமர்வைப் புதுப்பிக்கவும்"],
  clinic: ["Fulfilment clinic", "ഓർഡർ നിറവേറ്റുന്ന ക്ലിനിക്", "ஆர்டரை நிறைவேற்றும் கிளினிக்"],
  noDirectory: [
    "No approved clinic directory is available. Checkout is unavailable.",
    "അംഗീകൃത ക്ലിനിക് പട്ടിക ലഭ്യമല്ല. ചെക്ക്ഔട്ട് ലഭ്യമല്ല.",
    "அங்கீகரிக்கப்பட்ட கிளினிக் பட்டியல் இல்லை. செக்அவுட் கிடைக்கவில்லை.",
  ],
  selected: ["Selected: {name}", "തിരഞ്ഞെടുത്തത്: {name}", "தேர்ந்தெடுக்கப்பட்டது: {name}"],
  choose: ["Choose: {name}", "തിരഞ്ഞെടുക്കുക: {name}", "தேர்ந்தெடுக்கவும்: {name}"],
  products: ["Products", "ഉൽപ്പന്നങ്ങൾ", "தயாரிப்புகள்"],
  productStock: [
    "{amount} · Stock: {status}",
    "{amount} · സ്റ്റോക്ക്: {status}",
    "{amount} · இருப்பு: {status}",
  ],
  consultationRequired: [
    "Consultation required. Eligibility is checked by the server.",
    "കൺസൾട്ടേഷൻ ആവശ്യമാണ്. അർഹത സെർവർ പരിശോധിക്കുന്നു.",
    "ஆலோசனை தேவை. தகுதியைச் சேவையகம் சரிபார்க்கிறது.",
  ],
  addProduct: ["Add {name}", "{name} ചേർക്കുക", "{name} சேர்க்கவும்"],
  refreshProducts: ["Refresh products", "ഉൽപ്പന്നങ്ങൾ പുതുക്കുക", "தயாரிப்புகளைப் புதுப்பிக்கவும்"],
  nextProducts: ["Next product page", "അടുത്ത ഉൽപ്പന്ന പേജ്", "அடுத்த தயாரிப்புப் பக்கம்"],
  cart: [
    "Your cart (on this device session)",
    "നിങ്ങളുടെ കാർട്ട് (ഈ ഉപകരണ സെഷനിൽ)",
    "உங்கள் கூடை (இந்தச் சாதன அமர்வில்)",
  ],
  cartEmpty: [
    "Your cart is empty. Choose a clinic and add a product.",
    "നിങ്ങളുടെ കാർട്ട് ശൂന്യമാണ്. ഒരു ക്ലിനിക് തിരഞ്ഞെടുത്ത് ഉൽപ്പന്നം ചേർക്കുക.",
    "உங்கள் கூடை காலியாக உள்ளது. ஒரு கிளினிக்கைத் தேர்ந்தெடுத்து ஒரு தயாரிப்பைச் சேர்க்கவும்.",
  ],
  sku: ["SKU {id}", "SKU {id}", "SKU {id}"],
  quantity: ["Quantity for {name}", "{name} എന്നതിന്റെ അളവ്", "{name} அளவு"],
  removeProduct: ["Remove {name}", "{name} നീക്കുക", "{name} நீக்கவும்"],
  deliveryAddress: ["Delivery address", "വിതരണ വിലാസം", "விநியோக முகவரி"],
  countryNotice: [
    "Country: India. Address validation does not establish courier serviceability; the server decides checkout eligibility.",
    "രാജ്യം: ഇന്ത്യ. വിലാസ പരിശോധന കൊറിയർ സേവനലഭ്യത ഉറപ്പാക്കുന്നില്ല; ചെക്ക്ഔട്ട് അർഹത സെർവർ തീരുമാനിക്കുന്നു.",
    "நாடு: இந்தியா. முகவரி சரிபார்ப்பு கூரியர் சேவை கிடைப்பதை உறுதிப்படுத்தாது; செக்அவுட் தகுதியைச் சேவையகம் தீர்மானிக்கிறது.",
  ],
  checkField: ["Check {field}.", "{field} പരിശോധിക്കുക.", "{field} சரிபார்க்கவும்."],
  requestQuote: [
    "Get current server quote",
    "നിലവിലെ സെർവർ വിലവിവരം ലഭ്യമാക്കുക",
    "தற்போதைய சேவையக விலை விவரத்தைப் பெறவும்",
  ],
  reviewQuote: [
    "Review server quote",
    "സെർവർ വിലവിവരം പരിശോധിക്കുക",
    "சேவையக விலை விவரத்தை மதிப்பாய்வு செய்யவும்",
  ],
  quoteLine: [
    "SKU {id} · {quantity} units · {amount} · Tax {tax}",
    "SKU {id} · {quantity} യൂണിറ്റുകൾ · {amount} · നികുതി {tax}",
    "SKU {id} · {quantity} அலகுகள் · {amount} · வரி {tax}",
  ],
  serverTotal: ["Server total: {amount}", "സെർവർ ആകെ തുക: {amount}", "சேவையக மொத்தம்: {amount}"],
  confirmNotice: [
    "Confirm this total and delivery address to reserve an order. This does not mean payment was received.",
    "ഓർഡർ റിസർവ് ചെയ്യാൻ ഈ ആകെ തുകയും വിതരണ വിലാസവും സ്ഥിരീകരിക്കുക. പണം ലഭിച്ചുവെന്ന് ഇത് അർത്ഥമാക്കുന്നില്ല.",
    "ஆர்டரை முன்பதிவு செய்ய இந்த மொத்தத்தையும் விநியோக முகவரியையும் உறுதிப்படுத்தவும். இதனால் பணம் பெறப்பட்டதாக அர்த்தமில்லை.",
  ],
  retryCheckout: [
    "Retry same checkout operation",
    "അതേ ചെക്ക്ഔട്ട് നടപടി വീണ്ടും ശ്രമിക്കുക",
    "அதே செக்அவுட் செயல்பாட்டை மீண்டும் முயலவும்",
  ],
  confirmReserve: [
    "Confirm {amount} and reserve order",
    "{amount} സ്ഥിരീകരിച്ച് ഓർഡർ റിസർവ് ചെയ്യുക",
    "{amount} உறுதிப்படுத்தி ஆர்டரை முன்பதிவு செய்யவும்",
  ],
  reservation: ["Order reservation", "ഓർഡർ റിസർവേഷൻ", "ஆர்டர் முன்பதிவு"],
  reservationExpiry: [
    "Server reservation expiry: {time}",
    "സെർവർ റിസർവേഷൻ അവസാനിക്കുന്നത്: {time}",
    "சேவையக முன்பதிவு காலாவதி: {time}",
  ],
  recoverPayment: [
    "Recover same payment initiation",
    "അതേ പണമടയ്ക്കൽ ആരംഭനടപടി വീണ്ടെടുക്കുക",
    "அதே கட்டணத் தொடக்கத்தை மீட்டெடுக்கவும்",
  ],
  initiatePayment: [
    "Initiate payment for this order",
    "ഈ ഓർഡറിനായി പണമടയ്ക്കൽ ആരംഭിക്കുക",
    "இந்த ஆர்டருக்குக் கட்டணத்தைத் தொடங்கவும்",
  ],
  paymentLastKnown: [
    "Last-known payment state",
    "അവസാനം ലഭ്യമായ പണമടയ്ക്കൽ സ്ഥിതി",
    "கடைசியாக அறியப்பட்ட கட்டண நிலை",
  ],
  paymentCurrent: ["Current payment state", "നിലവിലെ പണമടയ്ക്കൽ സ്ഥിതി", "தற்போதைய கட்டண நிலை"],
  paymentCaptured: [
    "The server reports this intent captured. Order fulfilment is separate.",
    "ഈ പണമടയ്ക്കൽ അഭ്യർത്ഥനയിലെ തുക ലഭിച്ചതായി സെർവർ അറിയിക്കുന്നു. ഓർഡർ നിറവേറ്റൽ വേറെയാണ്.",
    "இந்தக் கட்டணக் கோரிக்கைக்கான தொகை பெறப்பட்டதாகச் சேவையகம் தெரிவிக்கிறது. ஆர்டர் நிறைவேற்றம் தனியானது.",
  ],
  paymentPending: [
    "No payment completion is assumed. Provider checkout SDK/device acceptance is pending; this screen does not capture funds.",
    "പണമടയ്ക്കൽ പൂർത്തിയായെന്ന് അനുമാനിക്കില്ല. സേവനദാതാവിന്റെ ചെക്ക്ഔട്ട് SDK/ഉപകരണ പരിശോധനയുടെ അംഗീകാരം ബാക്കിയുണ്ട്; ഈ സ്ക്രീൻ പണം സ്വീകരിക്കുന്നില്ല.",
    "கட்டணம் முடிந்ததாகக் கருதப்படாது. வழங்குநரின் செக்அவுட் SDK/சாதனச் சோதனை ஏற்பு நிலுவையில் உள்ளது; இந்தத் திரை பணத்தைப் பெறுவதில்லை.",
  ],
  payWithProvider: ["Pay with Razorpay", "Razorpay വഴി പണമടയ്ക്കുക", "Razorpay மூலம் செலுத்தவும்"],
  openingProvider: ["Opening Razorpay…", "Razorpay തുറക്കുന്നു…", "Razorpay திறக்கப்படுகிறது…"],
  providerUnavailable: [
    "Razorpay could not open. Refresh payment status before trying again.",
    "Razorpay തുറക്കാനായില്ല. വീണ്ടും ശ്രമിക്കുന്നതിന് മുമ്പ് പണമടയ്ക്കൽ സ്ഥിതി പുതുക്കുക.",
    "Razorpay திறக்க முடியவில்லை. மீண்டும் முயலும் முன் கட்டண நிலையைப் புதுப்பிக்கவும்.",
  ],
  providerReconcile: [
    "Razorpay returned. Check payment status; payment is confirmed only by the server.",
    "Razorpay-യിൽ നിന്ന് മടങ്ങിയെത്തി. പണമടയ്ക്കൽ സ്ഥിതി പരിശോധിക്കുക; സെർവർ മാത്രമാണ് പണമടയ്ക്കൽ സ്ഥിരീകരിക്കുന്നത്.",
    "Razorpay-இலிருந்து திரும்பியுள்ளது. கட்டண நிலையைச் சரிபார்க்கவும்; சேவையகம் மட்டுமே கட்டணத்தை உறுதிப்படுத்தும்.",
  ],
  readPayment: [
    "Read existing payment",
    "നിലവിലുള്ള പണമടയ്ക്കൽ വിവരം വായിക്കുക",
    "ஏற்கெனவே உள்ள கட்டணத்தைப் படிக்கவும்",
  ],
  reconcilePayment: [
    "Reconcile existing payment",
    "നിലവിലുള്ള പണമടയ്ക്കൽ ഒത്തുനോക്കുക",
    "ஏற்கெனவே உள்ள கட்டணத்தை ஒப்பிட்டுச் சரிபார்க்கவும்",
  ],
} as const satisfies Record<string, readonly [string, string, string]>;

export type NativeCommerceLabelKey = keyof typeof rows;
function column(index: 0 | 1 | 2): Record<NativeCommerceLabelKey, string> {
  return Object.fromEntries(
    Object.entries(rows).map(([key, values]) => [key, values[index]]),
  ) as Record<NativeCommerceLabelKey, string>;
}
export const nativeCommerceLabels: Record<Locale, Record<NativeCommerceLabelKey, string>> = {
  en: column(0),
  ml: column(1),
  ta: column(2),
};

/** Plain text only: supplied IDs/names/statuses are preserved, never evaluated or translated. */
export function formatNativeCommerceLabel(
  locale: Locale,
  key: NativeCommerceLabelKey,
  values: Readonly<Record<string, string | number>>,
): string {
  const template = nativeCommerceLabels[locale][key];
  const keys = [...template.matchAll(/\{([a-zA-Z]+)\}/g)].map((match) => match[1] ?? "");
  if (
    keys.some((name) => !Object.hasOwn(values, name)) ||
    Object.keys(values).some((name) => !keys.includes(name))
  )
    throw new Error("Native commerce label requires exact template values");
  return template.replace(/\{([a-zA-Z]+)\}/g, (_match, name: string) => String(values[name]));
}
