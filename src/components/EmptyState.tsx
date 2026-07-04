import type { LanguageCode } from "../core/types";
import { t } from "../i18n";

interface EmptyStateProps {
  lang: LanguageCode;
  variant?: "setup" | "detectFailed";
  onOpenSettings: () => void;
  onUseMock?: () => void;
  onSwitchManual?: () => void;
  onRedetect?: () => void;
  onViewDataSourceDocs?: () => void;
}

export function EmptyState({
  lang,
  variant = "setup",
  onOpenSettings,
  onUseMock,
  onSwitchManual,
  onRedetect,
  onViewDataSourceDocs,
}: EmptyStateProps) {
  if (variant === "detectFailed") {
    return (
      <div className="empty-state empty-state-failure">
        <div className="empty-state-icon" aria-hidden="true">
          🔌
        </div>
        <h2 className="empty-state-title">{t("source.detectFailed", lang)}</h2>
        <p className="empty-state-text">{t("source.detectFailedHint", lang)}</p>
        <div className="empty-state-actions">
          {onRedetect && (
            <button
              className="btn btn-primary"
              type="button"
              onClick={onRedetect}
            >
              {t("source.redetect", lang)}
            </button>
          )}
          {onViewDataSourceDocs && (
            <button
              className="btn"
              type="button"
              onClick={onViewDataSourceDocs}
            >
              {t("source.viewDataSourceDocs", lang)}
            </button>
          )}
          {onSwitchManual && (
            <button className="btn" type="button" onClick={onSwitchManual}>
              {t("source.manualConfigAdvanced", lang)}
            </button>
          )}
          {onUseMock && (
            <button className="btn" type="button" onClick={onUseMock}>
              {t("source.useMockAdvanced", lang)}
            </button>
          )}
        </div>
        <p className="empty-state-mock">{t("source.mockNotRealQuota", lang)}</p>
      </div>
    );
  }

  const steps = [
    t("empty.step1", lang),
    t("empty.step2", lang),
    t("empty.step3", lang),
  ];

  return (
    <div className="empty-state empty-state-guided">
      <div className="empty-state-icon" aria-hidden="true">
        📋
      </div>
      <h2 className="empty-state-title">{t("empty.title", lang)}</h2>
      <p className="empty-state-text">{t("empty.subtitle", lang)}</p>
      <ol className="empty-state-steps">
        {steps.map((step, index) => (
          <li key={index}>{step}</li>
        ))}
      </ol>
      <p className="empty-state-mock">{t("empty.mockHint", lang)}</p>
      <button className="btn btn-primary" type="button" onClick={onOpenSettings}>
        {t("empty.openSettings", lang)}
      </button>
    </div>
  );
}
