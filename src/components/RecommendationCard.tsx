import { memo, useMemo } from "react";
import type { LanguageCode } from "../core/types";
import { t } from "../i18n";
import { IconBulb } from "./Icons";

interface RecommendationCardProps {
  recommendations: string[];
  lang?: LanguageCode;
}

type RiskLevel = "normal" | "gold" | "alert";

function classifyRecommendation(rec: string, lang: LanguageCode): RiskLevel {
  if (rec === t("rec.fetchFailed", lang)) return "alert";
  if (rec === t("rec.allGood", lang)) return "normal";

  const sessionMarker = t("card.sessionWindow", lang);
  const weeklyMarker = t("card.weeklyWindow", lang);
  if (rec.includes(sessionMarker) || rec.includes(weeklyMarker)) {
    return "alert";
  }

  return "gold";
}

function getOverallLevel(
  recommendations: string[],
  lang: LanguageCode,
): RiskLevel {
  const levels = recommendations.map((r) => classifyRecommendation(r, lang));
  if (levels.includes("alert")) return "alert";
  if (levels.includes("gold")) return "gold";
  return "normal";
}

export const RecommendationCard = memo(function RecommendationCard({
  recommendations,
  lang = "zh-CN",
}: RecommendationCardProps) {
  const items = useMemo(
    () =>
      recommendations.length === 0 ? [t("rec.allGood", lang)] : recommendations,
    [recommendations, lang],
  );

  const level = useMemo(() => getOverallLevel(items, lang), [items, lang]);
  const prefix = t("rec.prefix", lang);

  return (
    <div className={`recommendation-bar level-${level}`} role="status">
      <div className="recommendation-bar-icon">
        <IconBulb />
      </div>
      <div className="recommendation-bar-content">
        <div className="recommendation-bar-items">
          {items.map((rec, index) => (
            <div key={index} className="recommendation-bar-text">
              <span className="recommendation-bar-prefix">{prefix}</span>
              {rec}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
});
