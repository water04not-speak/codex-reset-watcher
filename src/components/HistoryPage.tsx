import { memo, useMemo } from "react";
import type {
  LanguageCode,
  QuotaHistorySnapshot,
  UsageTrendAnalysis,
} from "../core/types";
import { realSnapshotsOnly } from "../core/history";
import { formatDateTime, t } from "../i18n";

interface HistoryPageProps {
  snapshots: QuotaHistorySnapshot[];
  trend: UsageTrendAnalysis;
  lang: LanguageCode;
  onExport: (format: "csv" | "json") => void;
  onClear: () => void;
}

function formatMetric(value: number | null, lang: LanguageCode): string {
  if (value === null) return t("history.insufficient", lang);
  return new Intl.NumberFormat(lang, { maximumFractionDigits: 1 }).format(
    value,
  );
}

function TrendChart({
  snapshots,
  field,
  lang,
  label,
}: {
  snapshots: QuotaHistorySnapshot[];
  field: "fiveHourWindow" | "sevenDayWindow";
  lang: LanguageCode;
  label: string;
}) {
  const points = useMemo(() => {
    const values = snapshots
      .slice(-40)
      .map((snapshot) => ({
        at: snapshot.capturedAt,
        value: snapshot[field]?.remaining,
      }))
      .filter(
        (point): point is { at: string; value: number } =>
          point.value !== null && point.value !== undefined,
      );
    if (values.length < 2) return { values, polyline: "" };
    return {
      values,
      polyline: values
        .map((point, index) => {
          const x = (index / (values.length - 1)) * 100;
          const y = 100 - Math.max(0, Math.min(100, point.value));
          return `${x},${y}`;
        })
        .join(" "),
    };
  }, [snapshots, field]);

  return (
    <figure className="trend-chart">
      <figcaption>{label}</figcaption>
      {points.values.length < 2 ? (
        <p className="history-empty">{t("history.insufficient", lang)}</p>
      ) : (
        <>
          <svg
            viewBox="0 0 100 100"
            role="img"
            aria-label={`${label}: ${t("history.chartDescription", lang)}`}
            preserveAspectRatio="none"
          >
            <line x1="0" y1="25" x2="100" y2="25" />
            <line x1="0" y1="50" x2="100" y2="50" />
            <line x1="0" y1="75" x2="100" y2="75" />
            <polyline points={points.polyline} />
          </svg>
          <div className="trend-chart-legend">
            <span>{formatDateTime(points.values[0].at, lang)}</span>
            <span>
              {formatMetric(
                points.values[points.values.length - 1]?.value ?? null,
                lang,
              )}
              %
            </span>
          </div>
        </>
      )}
    </figure>
  );
}

export const HistoryPage = memo(function HistoryPage({
  snapshots,
  trend,
  lang,
  onExport,
  onClear,
}: HistoryPageProps) {
  const trendSnapshots = useMemo(
    () => realSnapshotsOnly(snapshots),
    [snapshots],
  );
  const hasDemoSnapshots = snapshots.some((snapshot) => snapshot.isDemo);
  return (
    <main className="app-main history-page">
      <header className="history-header">
        <div>
          <h2>{t("history.title", lang)}</h2>
          <p>
            {trend.status === "ready"
              ? t("history.basis", lang, {
                  count: trend.snapshotCount,
                  hours: Math.max(1, Math.round(trend.spanHours)),
                })
              : t("history.insufficientDetail", lang)}
          </p>
        </div>
        <div className="history-actions">
          <button className="btn" type="button" onClick={() => onExport("csv")}>
            {t("history.exportCsv", lang)}
          </button>
          <button
            className="btn"
            type="button"
            onClick={() => onExport("json")}
          >
            {t("history.exportJson", lang)}
          </button>
          <button className="btn btn-danger" type="button" onClick={onClear}>
            {t("history.clear", lang)}
          </button>
        </div>
      </header>

      <section
        className="history-metrics"
        aria-label={t("history.metrics", lang)}
      >
        <article>
          <span>{t("history.usage24", lang)}</span>
          <strong>{formatMetric(trend.fiveHour.usage24Hours, lang)}</strong>
        </article>
        <article>
          <span>{t("history.usage7", lang)}</span>
          <strong>{formatMetric(trend.sevenDay.usage7Days, lang)}</strong>
        </article>
        <article>
          <span>{t("history.avgHourly", lang)}</span>
          <strong>{formatMetric(trend.fiveHour.averagePerHour, lang)}</strong>
        </article>
        <article>
          <span>{t("history.lastUsage", lang)}</span>
          <strong>
            {trend.lastUsageAt
              ? formatDateTime(trend.lastUsageAt, lang)
              : t("history.insufficient", lang)}
          </strong>
        </article>
      </section>

      <p className="history-disclaimer">{t("history.localEstimate", lang)}</p>

      <section className="history-charts">
        <TrendChart
          snapshots={trendSnapshots}
          field="fiveHourWindow"
          label={t("history.fiveHourTrend", lang)}
          lang={lang}
        />
        <TrendChart
          snapshots={trendSnapshots}
          field="sevenDayWindow"
          label={t("history.sevenDayTrend", lang)}
          lang={lang}
        />
      </section>

      <section className="history-grid">
        <article className="history-card">
          <h3>{t("history.depletion", lang)}</h3>
          <dl>
            <div>
              <dt>{t("history.estimate5", lang)}</dt>
              <dd>
                {trend.fiveHour.estimatedExhaustedAt
                  ? formatDateTime(trend.fiveHour.estimatedExhaustedAt, lang)
                  : t("history.insufficient", lang)}
              </dd>
            </div>
            <div>
              <dt>{t("history.estimate7", lang)}</dt>
              <dd>
                {trend.sevenDay.estimatedExhaustedAt
                  ? formatDateTime(trend.sevenDay.estimatedExhaustedAt, lang)
                  : t("history.insufficient", lang)}
              </dd>
            </div>
          </dl>
        </article>

        <article className="history-card">
          <h3>{t("history.creditTimeline", lang)}</h3>
          {trend.creditRisks.length === 0 ? (
            <p>{t("history.noCreditRisk", lang)}</p>
          ) : (
            <ul>
              {trend.creditRisks.map((risk) => (
                <li key={risk.id}>
                  <strong>{risk.level === "urgent" ? "!" : "△"}</strong>{" "}
                  {formatDateTime(risk.expiresAt, lang)} ·{" "}
                  {Math.ceil(risk.hoursRemaining)}h
                </li>
              ))}
            </ul>
          )}
        </article>
      </section>

      <section className="history-card history-recent">
        <h3>{t("history.recent", lang)}</h3>
        {snapshots.length === 0 ? (
          <p>{t("history.none", lang)}</p>
        ) : (
          <div className="history-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{t("history.capturedAt", lang)}</th>
                  <th>{t("history.source", lang)}</th>
                  <th>{t("history.health", lang)}</th>
                  <th>{t("history.fiveRemaining", lang)}</th>
                  <th>{t("history.sevenRemaining", lang)}</th>
                </tr>
              </thead>
              <tbody>
                {snapshots
                  .slice(-12)
                  .reverse()
                  .map((snapshot, index) => (
                    <tr
                      key={`${snapshot.capturedAt}:${snapshot.sourceType}:${index}`}
                    >
                      <td>{formatDateTime(snapshot.capturedAt, lang)}</td>
                      <td>{snapshot.sourceType}</td>
                      <td>{t(`tray.status.${snapshot.sourceHealth}`, lang)}</td>
                      <td>
                        {formatMetric(
                          snapshot.fiveHourWindow?.remaining ?? null,
                          lang,
                        )}
                      </td>
                      <td>
                        {formatMetric(
                          snapshot.sevenDayWindow?.remaining ?? null,
                          lang,
                        )}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
        {hasDemoSnapshots && <p>{t("history.demoExcluded", lang)}</p>}
      </section>
    </main>
  );
});
