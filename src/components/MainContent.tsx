import { memo } from "react";
import type { AppState, AppConfig, LanguageCode } from "../core/types";
import type { ResolvedSource } from "../core/sources/types";
import { OverviewCards } from "./OverviewCards";
import { CreditTimeline } from "./CreditTimeline";
import { LiquidGauge } from "./LiquidGauge";
import { RecommendationCard } from "./RecommendationCard";
import { DebugPanel } from "./DebugPanel";

interface MainContentProps {
  state: AppState;
  config: AppConfig;
  lang: LanguageCode;
  resolvedSource: ResolvedSource | null;
  displayPath: (path: string) => string;
}

export const MainContent = memo(function MainContent({
  state,
  config,
  lang,
  resolvedSource,
  displayPath,
}: MainContentProps) {
  return (
    <main className="app-main">
      <OverviewCards state={state} lang={lang} />
      <CreditTimeline credits={state.resetCredits} lang={lang} />
      <LiquidGauge
        sessionWindow={state.sessionWindow}
        weeklyWindow={state.weeklyWindow}
        lang={lang}
      />
      <RecommendationCard recommendations={state.recommendation} lang={lang} />
      <DebugPanel
        state={state}
        config={config}
        lang={lang}
        resolvedSource={resolvedSource}
        displayPath={displayPath}
      />
    </main>
  );
});
