interface RecommendationCardProps {
  recommendations: string[];
}

export function RecommendationCard({
  recommendations,
}: RecommendationCardProps) {
  if (recommendations.length === 0) {
    return (
      <div className="card">
        <div className="card-title">💡 智能建议</div>
        <div className="recommendation-list">
          <div className="recommendation-item type-success">
            <div className="recommendation-icon">✅</div>
            <div className="recommendation-text">
              一切正常，暂无需要注意的事项。
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="card-title">💡 智能建议</div>
      <div className="recommendation-list">
        {recommendations.map((rec, index) => {
          const isError = rec.includes("失败") || rec.includes("错误");
          const type = isError ? "type-error" : "type-warning";
          const icon = isError ? "⚠️" : "💡";

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
