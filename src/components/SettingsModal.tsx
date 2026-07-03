import { useEffect, useState, useCallback } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import type { AppConfig, LanguageCode, Theme } from "../core/types";
import type { SourceCandidate, SourceMode } from "../core/sources/types";
import { detectCodexSources, testCodexSource } from "../core/bridge";
import { isRefreshLocked } from "../core/refreshLock";
import { testCandidateConnection } from "../core/sources";
import { redactPath } from "../core/privacy";
import { t } from "../i18n";

interface SettingsModalProps {
  config: AppConfig;
  lang: LanguageCode;
  onCancel: () => void;
  onSave: (config: AppConfig) => Promise<void> | void;
}

const LANGUAGES: LanguageCode[] = ["zh-CN", "en", "ja", "zh-TW"];
const THEMES: Theme[] = ["dark", "light"];
const COMING_SOON_FEATURES = new Set(["autoStart", "alwaysOnTop"]);
const SOURCE_MODES: SourceMode[] = ["auto", "manual", "mock"];

export function SettingsModal({
  config,
  lang,
  onCancel,
  onSave,
}: SettingsModalProps) {
  const [draft, setDraft] = useState<AppConfig>(config);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isDetecting, setIsDetecting] = useState(false);
  const [candidates, setCandidates] = useState<SourceCandidate[]>(
    config.detectedSourceCache ?? [],
  );
  const [recommended, setRecommended] = useState<string | null>(null);
  const [showFullPath, setShowFullPath] = useState(false);
  const [testMessage, setTestMessage] = useState<{
    kind: "success" | "error";
    text: string;
  } | null>(null);

  useEffect(() => {
    setDraft(config);
    setCandidates(config.detectedSourceCache ?? []);
  }, [config]);

  useEffect(() => {
    document.body.classList.add("modal-open");
    return () => {
      document.body.classList.remove("modal-open");
    };
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", draft.theme);
    return () => {
      document.documentElement.setAttribute("data-theme", config.theme);
    };
  }, [draft.theme, config.theme]);

  const updateDraft = <K extends keyof AppConfig>(
    key: K,
    value: AppConfig[K],
  ) => {
    setDraft((current) => ({ ...current, [key]: value }));
    setTestMessage(null);
  };

  const runDetect = useCallback(async () => {
    setIsDetecting(true);
    try {
      const result = await detectCodexSources();
      setCandidates(result.candidates);
      setRecommended(result.recommended);
      updateDraft("detectedSourceCache", result.candidates);
      if (result.recommended && !draft.selectedSourceId) {
        updateDraft("selectedSourceId", result.recommended);
      }
    } finally {
      setIsDetecting(false);
    }
  }, [draft.selectedSourceId]);

  useEffect(() => {
    if (draft.sourceMode === "auto" && candidates.length === 0) {
      void runDetect();
    }
  }, [draft.sourceMode, candidates.length, runDetect]);

  const handleSave = async () => {
    const normalized: AppConfig = {
      ...draft,
      refreshIntervalSeconds: Math.max(
        60,
        Math.floor(Number(draft.refreshIntervalSeconds) || 60),
      ),
      detectedSourceCache: candidates,
    };

    setIsSaving(true);
    try {
      await onSave(normalized);
    } finally {
      setIsSaving(false);
    }
  };

  const handleBrowseScript = async () => {
    try {
      const selected = await open({
        multiple: false,
        filters: [{ name: "Python", extensions: ["py"] }],
      });
      if (typeof selected === "string") {
        updateDraft("codexUsagePath", selected);
      }
    } catch {
      // 对话框不可用时静默失败
    }
  };

  const handleTestConnection = async () => {
    if (isRefreshLocked()) return;
    setIsTesting(true);
    setTestMessage(null);
    try {
      const result = await testCodexSource({
        pythonCommand: draft.pythonCommand,
        codexUsagePath: draft.codexUsagePath,
      });
      if (result.ok) {
        setTestMessage({
          kind: "success",
          text: t("settings.testSuccess", lang),
        });
      } else {
        setTestMessage({
          kind: "error",
          text: t(`settings.testError.${result.status}`, lang),
        });
      }
    } finally {
      setIsTesting(false);
    }
  };

  const handleTestCandidate = async (candidate: SourceCandidate) => {
    if (isRefreshLocked()) return;
    setIsTesting(true);
    setTestMessage(null);
    try {
      const result = await testCandidateConnection(candidate, draft);
      setTestMessage({
        kind: result.ok ? "success" : "error",
        text: result.ok
          ? t("settings.testSuccess", lang)
          : t("settings.testError.probe_failed", lang),
      });
    } finally {
      setIsTesting(false);
    }
  };

  const showRedacted = draft.redactPathsInUi !== false;
  const maskPath = showRedacted && !showFullPath;
  const scriptDisplay = maskPath
    ? redactPath(draft.codexUsagePath)
    : draft.codexUsagePath;

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
            ×
          </button>
        </header>

        <div className="settings-modal-body">
          <div className="settings-form">
            <fieldset className="settings-fieldset">
              <legend>{t("settings.sourceSection", lang)}</legend>
              <div className="settings-options settings-source-modes">
                {SOURCE_MODES.map((mode) => (
                  <label key={mode} className="settings-option">
                    <input
                      type="radio"
                      name="sourceMode"
                      value={mode}
                      checked={(draft.sourceMode ?? "auto") === mode}
                      onChange={() => updateDraft("sourceMode", mode)}
                    />
                    <span>
                      {t(`settings.sourceMode.${mode}`, lang)}
                      {mode === "auto" && (
                        <span className="settings-badge">
                          {t("settings.recommended", lang)}
                        </span>
                      )}
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>

            {draft.sourceMode === "auto" && (
              <div className="settings-source-auto">
                <div className="settings-detect-row">
                  <button
                    className="btn"
                    type="button"
                    onClick={runDetect}
                    disabled={isDetecting || isSaving}
                  >
                    {isDetecting
                      ? t("settings.detecting", lang)
                      : t("settings.redetect", lang)}
                  </button>
                </div>
                {candidates.length === 0 ? (
                  <p className="settings-hint">{t("settings.noCandidates", lang)}</p>
                ) : (
                  <ul className="settings-candidate-list">
                    {candidates.map((c) => (
                      <li
                        key={c.id}
                        className={`settings-candidate${
                          draft.selectedSourceId === c.id
                            ? " settings-candidate-selected"
                            : ""
                        }`}
                      >
                        <label className="settings-candidate-main">
                          <input
                            type="radio"
                            name="selectedSource"
                            checked={draft.selectedSourceId === c.id}
                            onChange={() => updateDraft("selectedSourceId", c.id)}
                          />
                          <span>
                            <strong>{c.label}</strong>
                            <span className="settings-candidate-meta">
                              {t("settings.confidence", lang, {
                                n: c.confidence,
                              })}{" "}
                              · {c.riskLevel}
                              {recommended === c.id
                                ? ` · ${t("settings.recommendedPick", lang)}`
                                : ""}
                            </span>
                            <span className="settings-candidate-reason">
                              {c.reason}
                            </span>
                          </span>
                        </label>
                        <button
                          className="btn btn-small"
                          type="button"
                          disabled={isTesting}
                          onClick={() => handleTestCandidate(c)}
                        >
                          {t("settings.testConnection", lang)}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {draft.sourceMode === "mock" && (
              <p className="settings-hint">{t("settings.mockHint", lang)}</p>
            )}

            {draft.sourceMode === "manual" && (
              <>
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
                  <div className="settings-path-row">
                    <input
                      value={scriptDisplay}
                      readOnly={maskPath}
                      onChange={(event) =>
                        updateDraft("codexUsagePath", event.target.value)
                      }
                      placeholder="C:\\path\\to\\codex_usage.py"
                    />
                    <button
                      className="btn"
                      type="button"
                      onClick={handleBrowseScript}
                    >
                      {t("settings.browseFile", lang)}
                    </button>
                  </div>
                  {draft.codexUsagePath.trim() && showRedacted && (
                    <div className="settings-path-actions">
                      <button
                        className="btn btn-small"
                        type="button"
                        onClick={() => setShowFullPath((v) => !v)}
                      >
                        {showFullPath
                          ? t("settings.hideFullPath", lang)
                          : t("settings.showFullPath", lang)}
                      </button>
                    </div>
                  )}
                </label>

                <div className="settings-test-row">
                  <button
                    className="btn"
                    type="button"
                    onClick={handleTestConnection}
                    disabled={isTesting || isSaving}
                  >
                    {isTesting
                      ? t("settings.testing", lang)
                      : t("settings.testConnection", lang)}
                  </button>
                </div>
              </>
            )}

            {testMessage && (
              <p
                className={`settings-test-message settings-test-message-${testMessage.kind}`}
                role="status"
              >
                {testMessage.text}
              </p>
            )}

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
                      Math.max(
                        60,
                        Math.floor(Number(event.target.value) || 60),
                      ),
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
                {THEMES.map((theme) => {
                  const isComingSoon = COMING_SOON_FEATURES.has(theme);
                  return (
                    <label
                      key={theme}
                      className={`settings-option${isComingSoon ? " settings-option-disabled" : ""}`}
                    >
                      <input
                        type="radio"
                        name="theme"
                        value={theme}
                        checked={draft.theme === theme}
                        disabled={isComingSoon}
                        onChange={() => updateDraft("theme", theme)}
                      />
                      <span>
                        {t(`settings.theme.${theme}`, lang)}
                        {isComingSoon && (
                          <span className="settings-coming-soon">
                            {t("settings.comingSoon", lang)}
                          </span>
                        )}
                      </span>
                    </label>
                  );
                })}
              </div>
            </fieldset>

            <div className="settings-toggles">
              <label
                className={`settings-toggle${COMING_SOON_FEATURES.has("autoStart") ? " settings-option-disabled" : ""}`}
              >
                <input
                  type="checkbox"
                  checked={draft.autoStart}
                  disabled={COMING_SOON_FEATURES.has("autoStart")}
                  onChange={(event) =>
                    updateDraft("autoStart", event.target.checked)
                  }
                />
                <span>
                  {t("settings.autoStart", lang)}
                  {COMING_SOON_FEATURES.has("autoStart") && (
                    <span className="settings-coming-soon">
                      {t("settings.comingSoon", lang)}
                    </span>
                  )}
                </span>
              </label>
              <label
                className={`settings-toggle${COMING_SOON_FEATURES.has("alwaysOnTop") ? " settings-option-disabled" : ""}`}
              >
                <input
                  type="checkbox"
                  checked={draft.alwaysOnTop}
                  disabled={COMING_SOON_FEATURES.has("alwaysOnTop")}
                  onChange={(event) =>
                    updateDraft("alwaysOnTop", event.target.checked)
                  }
                />
                <span>
                  {t("settings.alwaysOnTop", lang)}
                  {COMING_SOON_FEATURES.has("alwaysOnTop") && (
                    <span className="settings-coming-soon">
                      {t("settings.comingSoon", lang)}
                    </span>
                  )}
                </span>
              </label>
              <label className="settings-toggle">
                <input
                  type="checkbox"
                  checked={draft.redactPathsInUi !== false}
                  onChange={(event) =>
                    updateDraft("redactPathsInUi", event.target.checked)
                  }
                />
                <span>{t("settings.redactPaths", lang)}</span>
              </label>
              <label className="settings-toggle">
                <input
                  type="checkbox"
                  checked={draft.performanceMode === true}
                  onChange={(event) =>
                    updateDraft("performanceMode", event.target.checked)
                  }
                />
                <span>{t("settings.performanceMode", lang)}</span>
              </label>
            </div>
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
