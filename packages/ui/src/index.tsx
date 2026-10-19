import { type Locale, localeNames, locales } from "@kandamkulathi/i18n";
export function LanguageSelect({
  locale,
  onChange,
}: {
  locale: Locale;
  onChange: (value: Locale) => void;
}) {
  return (
    <label>
      Language / ഭാഷ / மொழி{" "}
      <select
        value={locale}
        onChange={(event) => {
          const selected = locales.find((value) => value === event.target.value);
          if (selected) onChange(selected);
        }}
      >
        {locales.map((value) => (
          <option key={value} value={value}>
            {localeNames[value]}
          </option>
        ))}
      </select>
    </label>
  );
}
