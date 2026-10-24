import type { Locale } from "./index";

type Labels = {
  title: string;
  unavailable: string;
  record: string;
  stop: string;
  upload: string;
  discard: string;
  retryCleanup: string;
  acknowledge: string;
  version: string;
  review: string;
  states: Record<
    | "idle"
    | "requesting"
    | "recording"
    | "clip"
    | "loading"
    | "cleaning"
    | "cleanup-error"
    | "review"
    | "empty"
    | "not-configured"
    | "denied"
    | "invalid"
    | "rate-limited"
    | "unknown",
    string
  >;
};
export const transcriptionText: Record<Locale, Labels> = {
  en: {
    title: "Short voice clip",
    unavailable: "Voice transcription is unavailable. You can still type your message.",
    record: "Record a short clip",
    stop: "Stop recording",
    upload: "Upload clip for transcription",
    discard: "Discard clip",
    retryCleanup: "Retry recording cleanup",
    acknowledge: "I have read this notice and approve uploading this clip for transcription.",
    version: "Processing notice version",
    review:
      "Transcription may be incorrect. Review and edit the draft before using the separate Send button.",
    states: {
      cleaning: "Stopping and deleting the local recording…",
      "cleanup-error":
        "The local recording could not be fully cleaned up. Retry cleanup before recording again.",
      idle: "Record up to 14.5 seconds. Recording stays on this device until you choose Upload.",
      requesting: "Requesting microphone permission and preparing recording…",
      recording: "Recording locally. Stops automatically after 14.5 seconds.",
      clip: "Clip ready. Read the processing notice and approve this upload before continuing.",
      loading: "Transcribing this clip…",
      review: "Text added to your editable draft. Nothing has been sent to Companion.",
      empty: "No text was recognized. Type your message or record a new clip.",
      "not-configured": "Transcription is not configured. Type your message instead.",
      denied: "Permission or current session approval is missing. You can still type your message.",
      invalid:
        "This clip could not be used or exceeded the size limit. Try a shorter new clip or type your message.",
      "rate-limited":
        "Transcription is busy. No automatic retry will occur. Type your message or try a new clip later.",
      unknown:
        "The clip could not be completed or its result is uncertain. No automatic retry will occur. Type your message or record a new clip.",
    },
  },
  ml: {
    title: "ചെറിയ ശബ്ദ ക്ലിപ്പ്",
    unavailable: "ശബ്ദം എഴുത്താക്കൽ ലഭ്യമല്ല. സന്ദേശം ടൈപ്പ് ചെയ്യാം.",
    record: "ചെറിയ ക്ലിപ്പ് റെക്കോർഡ് ചെയ്യുക",
    stop: "റെക്കോർഡിംഗ് നിർത്തുക",
    upload: "എഴുത്താക്കാൻ ക്ലിപ്പ് അപ്‌ലോഡ് ചെയ്യുക",
    discard: "ക്ലിപ്പ് ഉപേക്ഷിക്കുക",
    retryCleanup: "റെക്കോർഡിംഗ് നീക്കം ചെയ്യാൻ വീണ്ടും ശ്രമിക്കുക",
    acknowledge: "ഈ അറിയിപ്പ് വായിച്ചു; ഈ ക്ലിപ്പ് എഴുത്താക്കുന്നതിനായി അപ്‌ലോഡ് ചെയ്യാൻ ഞാൻ സമ്മതിക്കുന്നു.",
    version: "പ്രോസസ്സിംഗ് അറിയിപ്പിന്റെ പതിപ്പ്",
    review: "എഴുത്താക്കിയതിൽ തെറ്റുകളുണ്ടാകാം. പ്രത്യേകം അയയ്ക്കുക ബട്ടൺ ഉപയോഗിക്കുന്നതിന് മുമ്പ് കരട് പരിശോധിച്ച് തിരുത്തുക.",
    states: {
      cleaning: "പ്രാദേശിക റെക്കോർഡിംഗ് നിർത്തി നീക്കം ചെയ്യുന്നു…",
      "cleanup-error":
        "പ്രാദേശിക റെക്കോർഡിംഗ് പൂർണ്ണമായി നീക്കാനായില്ല. വീണ്ടും റെക്കോർഡ് ചെയ്യുന്നതിന് മുമ്പ് നീക്കം ചെയ്യാൻ വീണ്ടും ശ്രമിക്കുക.",
      idle: "14.5 സെക്കൻഡ് വരെ റെക്കോർഡ് ചെയ്യാം. അപ്‌ലോഡ് തിരഞ്ഞെടുക്കുന്നതുവരെ റെക്കോർഡിംഗ് ഈ ഉപകരണത്തിൽ മാത്രമാണ്.",
      requesting: "മൈക്രോഫോൺ അനുമതി ചോദിച്ച് റെക്കോർഡിംഗ് തയ്യാറാക്കുന്നു…",
      recording: "ഉപകരണത്തിൽ റെക്കോർഡ് ചെയ്യുന്നു. 14.5 സെക്കൻഡിന് ശേഷം സ്വയം നിർത്തും.",
      clip: "ക്ലിപ്പ് തയ്യാറാണ്. തുടരുന്നതിന് മുമ്പ് പ്രോസസ്സിംഗ് അറിയിപ്പ് വായിച്ച് ഈ അപ്‌ലോഡിന് സമ്മതിക്കുക.",
      loading: "ക്ലിപ്പ് എഴുത്താക്കുന്നു…",
      review: "തിരുത്താവുന്ന കരടിൽ എഴുത്ത് ചേർത്തു. കമ്പാനിയനിലേക്ക് ഒന്നും അയച്ചിട്ടില്ല.",
      empty: "എഴുത്ത് തിരിച്ചറിഞ്ഞില്ല. സന്ദേശം ടൈപ്പ് ചെയ്യുകയോ പുതിയ ക്ലിപ്പ് റെക്കോർഡ് ചെയ്യുകയോ ചെയ്യുക.",
      "not-configured": "എഴുത്താക്കൽ ക്രമീകരിച്ചിട്ടില്ല. സന്ദേശം ടൈപ്പ് ചെയ്യുക.",
      denied: "അനുമതിയോ നിലവിലെ സെഷൻ അംഗീകാരമോ ഇല്ല. സന്ദേശം ടൈപ്പ് ചെയ്യാം.",
      invalid:
        "ക്ലിപ്പ് ഉപയോഗിക്കാനായില്ല അല്ലെങ്കിൽ വലുപ്പപരിധി കവിഞ്ഞു. ചെറിയ പുതിയ ക്ലിപ്പ് എടുക്കുകയോ ടൈപ്പ് ചെയ്യുകയോ ചെയ്യുക.",
      "rate-limited":
        "എഴുത്താക്കൽ തിരക്കിലാണ്. സ്വയം വീണ്ടും ശ്രമിക്കില്ല. ടൈപ്പ് ചെയ്യുക അല്ലെങ്കിൽ പിന്നീട് പുതിയ ക്ലിപ്പ് എടുക്കുക.",
      unknown:
        "ക്ലിപ്പ് പൂർത്തിയാക്കാനായില്ല അല്ലെങ്കിൽ ഫലം ഉറപ്പില്ല. സ്വയം വീണ്ടും ശ്രമിക്കില്ല. ടൈപ്പ് ചെയ്യുകയോ പുതിയ ക്ലിപ്പ് എടുക്കുകയോ ചെയ്യുക.",
    },
  },
  ta: {
    title: "குறுகிய குரல் பதிவு",
    unavailable: "குரலை எழுத்தாக்குவது கிடைக்கவில்லை. உங்கள் செய்தியைத் தட்டச்சு செய்யலாம்.",
    record: "குறுகிய பதிவைத் தொடங்கு",
    stop: "பதிவை நிறுத்து",
    upload: "எழுத்தாக்க பதிவைப் பதிவேற்று",
    discard: "பதிவை நீக்கு",
    retryCleanup: "பதிவை நீக்க மீண்டும் முயல்",
    acknowledge: "இந்த அறிவிப்பைப் படித்தேன்; இந்தப் பதிவை எழுத்தாக்கப் பதிவேற்ற ஒப்புக்கொள்கிறேன்.",
    version: "செயலாக்க அறிவிப்பின் பதிப்பு",
    review:
      "எழுத்தாக்கத்தில் பிழைகள் இருக்கலாம். தனியான அனுப்பு பொத்தானைப் பயன்படுத்துவதற்கு முன் வரைவைச் சரிபார்த்துத் திருத்தவும்.",
    states: {
      cleaning: "சாதனத்தில் உள்ள பதிவை நிறுத்தி நீக்குகிறது…",
      "cleanup-error":
        "சாதனப் பதிவை முழுவதுமாக நீக்க முடியவில்லை. மீண்டும் பதிவு செய்வதற்கு முன் நீக்க மீண்டும் முயலவும்.",
      idle: "14.5 வினாடிகள் வரை பதிவு செய்யலாம். பதிவேற்றுவதைத் தேர்ந்தெடுக்கும் வரை பதிவு இந்தச் சாதனத்தில் மட்டுமே இருக்கும்.",
      requesting: "மைக்ரோஃபோன் அனுமதி கோரி பதிவைத் தயாராக்குகிறது…",
      recording: "சாதனத்தில் பதிவு செய்கிறது. 14.5 வினாடிகளுக்குப் பிறகு தானாக நிற்கும்.",
      clip: "பதிவு தயார். தொடரும் முன் செயலாக்க அறிவிப்பைப் படித்து இந்தப் பதிவேற்றத்திற்கு ஒப்புக்கொள்ளவும்.",
      loading: "பதிவை எழுத்தாக்குகிறது…",
      review: "திருத்தக்கூடிய வரைவில் உரை சேர்க்கப்பட்டது. கம்பானியனுக்கு எதுவும் அனுப்பப்படவில்லை.",
      empty: "உரை அடையாளம் காணப்படவில்லை. தட்டச்சு செய்யவும் அல்லது புதிய பதிவை எடுக்கவும்.",
      "not-configured": "எழுத்தாக்கம் அமைக்கப்படவில்லை. செய்தியைத் தட்டச்சு செய்யவும்.",
      denied: "அனுமதி அல்லது தற்போதைய அமர்வு ஒப்புதல் இல்லை. செய்தியைத் தட்டச்சு செய்யலாம்.",
      invalid:
        "பதிவைப் பயன்படுத்த முடியவில்லை அல்லது அளவு வரம்பை மீறியது. குறுகிய புதிய பதிவு எடுக்கவும் அல்லது தட்டச்சு செய்யவும்.",
      "rate-limited":
        "எழுத்தாக்கம் பிஸியாக உள்ளது. தானாக மீண்டும் முயலாது. தட்டச்சு செய்யவும் அல்லது பின்னர் புதிய பதிவு எடுக்கவும்.",
      unknown:
        "பதிவை முடிக்க முடியவில்லை அல்லது முடிவு உறுதியில்லை. தானாக மீண்டும் முயலாது. தட்டச்சு செய்யவும் அல்லது புதிய பதிவு எடுக்கவும்.",
    },
  },
};
