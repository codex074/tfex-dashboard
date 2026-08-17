import { useTranslation } from "react-i18next";
import { persistLanguage, type SupportedLanguage } from "../i18n";

export function LanguageSwitcher() {
  const { i18n, t } = useTranslation();

  const switchTo = (lang: SupportedLanguage) => {
    persistLanguage(lang);
    void i18n.changeLanguage(lang);
  };

  const current = i18n.language.startsWith("th") ? "th" : "en";
  const isTh = current === "th";

  return (
    <div
      className="relative flex h-9 w-24 items-center rounded-full border border-hairline bg-surface-soft p-1"
      role="group"
      aria-label="Language"
    >
      <span
        aria-hidden="true"
        className={`absolute bottom-1 top-1 left-1 w-[calc(50%-4px)] rounded-full bg-gradient-to-r from-ink-deep to-primary-deep shadow-sm transition-transform duration-200 ease-out ${
          isTh ? "translate-x-0" : "translate-x-full"
        }`}
      />
      <button
        type="button"
        onClick={() => switchTo("th")}
        className={`relative z-10 flex h-full w-1/2 shrink-0 items-center justify-center rounded-full text-xs font-bold leading-none transition-colors ${
          isTh ? "text-canvas" : "text-ink hover:text-ink-deep"
        }`}
        aria-label={t("language.thai")}
        aria-pressed={isTh}
      >
        ไทย
      </button>
      <button
        type="button"
        onClick={() => switchTo("en")}
        className={`relative z-10 flex h-full w-1/2 shrink-0 items-center justify-center rounded-full text-xs font-bold leading-none transition-colors ${
          !isTh ? "text-canvas" : "text-ink hover:text-ink-deep"
        }`}
        aria-label={t("language.english")}
        aria-pressed={!isTh}
      >
        EN
      </button>
    </div>
  );
}