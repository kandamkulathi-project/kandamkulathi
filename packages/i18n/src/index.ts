export const locales = ["en", "ml", "ta"] as const;
export type Locale = (typeof locales)[number];
export { formatDate, formatMoney, foundation } from "./foundation";
export const localeNames: Record<Locale, string> = { en: "English", ml: "മലയാളം", ta: "தமிழ்" };
// Development labels only. Company/physician review is required for final translations.
export const messages = {
  en: {
    title: "Kandamkulathi",
    welcome: "Development workspace",
    status: "Implementation in progress",
    notice: "Team development preview. Customer services are not available yet.",
    language: "Language",
  },
  ml: {
    title: "കണ്ടംകുളത്തി",
    welcome: "വികസന പ്രവർത്തനസ്ഥലം",
    status: "നിർമ്മാണം പുരോഗമിക്കുന്നു",
    notice: "ടീമിന്റെ വികസന പ്രിവ്യൂ. ഉപഭോക്തൃ സേവനങ്ങൾ ഇതുവരെ ലഭ്യമല്ല.",
    language: "ഭാഷ",
  },
  ta: {
    title: "கண்டம்குளத்தி",
    welcome: "மேம்பாட்டுப் பணியிடம்",
    status: "உருவாக்கம் நடைபெறுகிறது",
    notice: "குழுவின் மேம்பாட்டு முன்னோட்டம். வாடிக்கையாளர் சேவைகள் இன்னும் கிடைக்கவில்லை.",
    language: "மொழி",
  },
} satisfies Record<Locale, Record<string, string>>;
