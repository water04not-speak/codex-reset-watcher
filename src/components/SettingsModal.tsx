import { useEffect, useState } from "react";
import type { AppConfig, LanguageCode, Theme } from "../core/types";
import { t } from "../i18n";

interface SettingsModalProps {
  config: AppConfig;
  lang: LanguageCode;
  onCancel: () => void;
  onSave: (config: AppConfig) => Promise<void> | void;
}

const LANGUAGES: LanguageCode[] = ["zh-CN", "en", "ja", "zh-TW"];
const THEMES: Theme[] = ["dark", "light"];

export function SettingsModal({
  config,
  lang,
  onCancel,
  onSave,
}: SettingsModalProps) {
  const [draft, setDraft] = useState<AppConfig>(config);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setDraft(config);
  }, [config]);

  const updateDraft = <K extends keyof AppConfig>(
    key: K,
    value: AppConfig[K],
  ) => {
    setDraft((current) => ({ ...current, [key]: value }));
  };

  const handleSave = async () => {
    const normalized: AppConfig = {
      ...draft,
      refreshIntervalSeconds: Math.max(
        60,
        Math.floor(Number(draft.refreshIntervalSeconds) || 60),
      ),
    };

    setIsSaving(true);
    try {
      await onSave(normalized);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="modal-overlay" role="presentation" onClick={onCancel}>
      <section
        className="settings-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="settings-modal-header">
          <div>
            <h2 id="settings-title">{t("settings.title", lang)}</h2>
            <p>{t("settings.subtitle", lang)}</p>
          </div>
          <button
            className="settings-close"
            type="button"
            onClick={onCancel}
            aria-label={t("btn.cancel", lang)}
          >
            x
          </button>
        </header>

        <div className="settings-form">
          <label className="settings-field">
            <span>{t("settings.pythonPath", lang)}</span>
            <input
              value={draft.pythonCommand}
              onChange={(event) =>
                updateDraft("pythonCommand", event.target.value)
              }
              placeholder="python"
            />
          </label>

          <label className="settings-field">
            <span>{t("settings.scriptPath", lang)}</span>
            <input
              value={draft.codexUsagePath}
              onChange={(event) =>
                updateDraft("codexUsagePath", event.target.value)
              }
              placeholder="C:\\path\\to\\codex_usage.py"
            />
          </label>

          <label className="settings-field settings-number-field">
            <span>{t("settings.refreshInterval", lang)}</span>
            <div className="settings-number-row">
              <input
                type="number"
                min={60}
                value={draft.refreshIntervalSeconds}
                onChange={(event) =>
                  updateDraft(
                    "refreshIntervalSeconds",
                    Math.max(60, Math.floor(Number(event.target.value) || 60)),
                  )
                }
              />
              <span>{t("settings.seconds", lang)}</span>
            </div>
          </label>

          <fieldset className="settings-fieldset">
            <legend>{t("settings.language", lang)}</legend>
            <div className="settings-options">
              {LANGUAGES.map((language) => (
                <label key={language} className="settings-option">
                  <input
                    type="radio"
                    name="language"
                    value={language}
                    checked={draft.language === language}
                    onChange={() => updateDraft("language", language)}
                  />
                  <span>{language}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset className="settings-fieldset">
            <legend>{t("settings.theme", lang)}</legend>
            <div className="settings-options">
              {THEMES.map((theme) => (
                <label key={theme} className="settings-option">
                  <input
                    type="radio"
                    name="theme"
                    value={theme}
                    checked={draft.theme === theme}
                    onChange={() => updateDraft("theme", theme)}
                  />
                  <span>{t(`settings.theme.${theme}`, lang)}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <div className="settings-toggles">
            <label className="settings-toggle">
              <input
                type="checkbox"
                checked={draft.autoStart}
                onChange={(event) =>
                  updateDraft("autoStart", event.target.checked)
                }
              />
              <span>{t("settings.autoStart", lang)}</span>
            </label>
            <label className="settings-toggle">
              <input
                type="checkbox"
                checked={draft.alwaysOnTop}
                onChange={(event) =>
                  updateDraft("alwaysOnTop", event.target.checked)
                }
              />
              <span>{t("settings.alwaysOnTop", lang)}</span>
            </label>
          </div>
        </div>

        <footer className="settings-actions">
          <button
            className="btn"
            type="button"
            onClick={onCancel}
            disabled={isSaving}
          >
            {t("btn.cancel", lang)}
          </button>
          <button
            className="btn btn-primary"
            type="button"
            onClick={handleSave}
            disabled={isSaving}
          >
            {isSaving ? t("settings.saving", lang) : t("btn.save", lang)}
          </button>
        </footer>
      </section>
    </div>
  );
}
