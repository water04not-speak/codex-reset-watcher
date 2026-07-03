import type { LanguageCode } from "../core/types";
import { t } from "../i18n";

interface RecommendationCardProps {
  recommendations: string[];
  lang?: LanguageCode;
}

export function RecommendationCard({
  recommendations,
  lang = "zh-CN",
}: RecommendationCardProps) {
  const fetchFailedText = t("rec.fetchFailed", lang);
  const allGoodText = t("rec.allGood", lang);

  if (recommendations.length === 0) {
    return (
      <div className="card">
        <div className="card-title">{t("card.recommendationTitle", lang)}</div>
        <div className="recommendation-list">
          <div className="recommendation-item type-success">
            <div className="recommendation-icon">✅</div>
            <div className="recommendation-text">{allGoodText}</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="card-title">{t("card.recommendationTitle", lang)}</div>
      <div className="recommendation-list">
        {recommendations.map((rec, index) => {
          const isError = rec === fetchFailedText;
          const isSuccess = rec === allGoodText;
          const type = isError
            ? "type-error"
            : isSuccess
              ? "type-success"
              : "type-warning";
          const icon = isError ? "⚠️" : isSuccess ? "✅" : "💡";

          return (
            <div key={index} className={`recommendation-item ${type}`}>
              <div className="recommendation-icon">{icon}</div>
              <div className="recommendation-text">{rec}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
