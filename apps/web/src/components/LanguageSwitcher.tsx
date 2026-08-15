import { useTranslation } from "react-i18next";
import { persistLanguage, type SupportedLanguage } from "../i18n";

export function LanguageSwitcher() {
  const { i18n, t } = useTranslation();

  const switchTo = (lang: SupportedLanguage) => {
    persistLanguage(lang);
    void i18n.changeLanguage(lang);
  };

  const current = i18n.language.startsWith("th") ? "th" : "en";

  return (
    <div className="flex items-center gap-1 rounded-full border border-hairline bg-surface-soft p-1">
      <button
        type="button"
        onClick={() => switchTo("th")}
        className={`rounded-full px-3 py-1 text-sm font-bold transition-colors ${
          current === "th"
            ? "bg-ink-deep text-canvas"
            : "text-ink hover:bg-canvas"
        }`}
        aria-label={t("language.thai")}
      >
        ไทย
      </button>
      <button
        type="button"
        onClick={() => switchTo("en")}
        className={`rounded-full px-3 py-1 text-sm font-bold transition-colors ${
          current === "en"
            ? "bg-ink-deep text-canvas"
            : "text-ink hover:bg-canvas"
        }`}
        aria-label={t("language.english")}
      >
        EN
      </button>
    </div>
  );
}