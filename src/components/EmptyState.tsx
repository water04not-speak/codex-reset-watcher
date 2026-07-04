import type { LanguageCode } from "../core/types";
import { t } from "../i18n";

export type EmptyStateVariant =
  | "setup"
  | "detectFailed"
  | "needsLogin"
  | "authExpired"
  | "networkError";

interface EmptyStateProps {
  lang: LanguageCode;
  variant?: EmptyStateVariant;
  onOpenSettings: () => void;
  onUseMock?: () => void;
  onSwitchManual?: () => void;
  onRedetect?: () => void;
  onViewDataSourceDocs?: () => void;
}

function FailurePanel({
  lang,
  titleKey,
  hintKey,
  onUseMock,
  onSwitchManual,
  onRedetect,
  onViewDataSourceDocs,
}: {
  lang: LanguageCode;
  titleKey: string;
  hintKey: string;
  onUseMock?: () => void;
  onSwitchManual?: () => void;
  onRedetect?: () => void;
  onViewDataSourceDocs?: () => void;
}) {
  return (
    <div className="empty-state empty-state-failure">
      <div className="empty-state-icon" aria-hidden="true">
        🔌
      </div>
      <h2 className="empty-state-title">{t(titleKey, lang)}</h2>
      <p className="empty-state-text">{t(hintKey, lang)}</p>
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
          <button className="btn" type="button" onClick={onViewDataSourceDocs}>
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

export function EmptyState({
  lang,
  variant = "setup",
  onOpenSettings,
  onUseMock,
  onSwitchManual,
  onRedetect,
  onViewDataSourceDocs,
}: EmptyStateProps) {
  if (variant === "needsLogin") {
    return (
      <FailurePanel
        lang={lang}
        titleKey="source.needsLogin"
        hintKey="source.needsLoginHint"
        onUseMock={onUseMock}
        onSwitchManual={onSwitchManual}
        onRedetect={onRedetect}
        onViewDataSourceDocs={onViewDataSourceDocs}
      />
    );
  }

  if (variant === "authExpired") {
    return (
      <FailurePanel
        lang={lang}
        titleKey="source.authExpired"
        hintKey="source.authExpiredHint"
        onUseMock={onUseMock}
        onSwitchManual={onSwitchManual}
        onRedetect={onRedetect}
        onViewDataSourceDocs={onViewDataSourceDocs}
      />
    );
  }

  if (variant === "networkError") {
    return (
      <FailurePanel
        lang={lang}
        titleKey="source.networkError"
        hintKey="source.networkErrorHint"
        onUseMock={onUseMock}
        onSwitchManual={onSwitchManual}
        onRedetect={onRedetect}
        onViewDataSourceDocs={onViewDataSourceDocs}
      />
    );
  }

  if (variant === "detectFailed") {
    return (
      <FailurePanel
        lang={lang}
        titleKey="source.detectFailed"
        hintKey="source.detectFailedHint"
        onUseMock={onUseMock}
        onSwitchManual={onSwitchManual}
        onRedetect={onRedetect}
        onViewDataSourceDocs={onViewDataSourceDocs}
      />
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
