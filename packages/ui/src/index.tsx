import { foundation, type Locale, localeNames, locales } from "@kandamkulathi/i18n";
import type { ButtonHTMLAttributes, ReactNode } from "react";

export { CompanionShell } from "./CompanionShell";
export { DeviceCheck } from "./DeviceCheck";
export { useSession } from "./session";
export function LanguageSelect({
  locale,
  onChange,
}: {
  locale: Locale;
  onChange: (value: Locale) => void;
}) {
  return (
    <label>
      {foundation[locale].language}{" "}
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

export function Button(props: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button {...props} type={props.type ?? "button"} />;
}
export function Notice({ children, error = false }: { children: ReactNode; error?: boolean }) {
  return (
    <p role={error ? "alert" : "status"} aria-live={error ? "assertive" : "polite"}>
      {children}
    </p>
  );
}
export function Field({
  id,
  label,
  help,
  value,
  onChange,
  disabled = false,
}: {
  id: string;
  label: string;
  help: string;
  value: string;
  onChange(value: string): void;
  disabled?: boolean;
}) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <textarea
        id={id}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        aria-describedby={`${id}-help`}
        maxLength={4000}
      />
      <p id={`${id}-help`}>{help}</p>
    </div>
  );
}
