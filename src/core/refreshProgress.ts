import type { LanguageCode } from "./types";
import { t } from "../i18n";

export type RefreshProgressPhase =
  "detecting" | "connecting" | "calling" | "parsing" | "updating";

export const SLOW_REFRESH_HINT_SECONDS = 3;

export function getRefreshProgressPhase(
  elapsedSeconds: number,
): RefreshProgressPhase {
  if (elapsedSeconds <= 0) return "detecting";
  if (elapsedSeconds < 3) return "connecting";
  if (elapsedSeconds < 7) return "calling";
  if (elapsedSeconds < 10) return "parsing";
  return "updating";
}

export function shouldShowSlowRefreshHint(elapsedSeconds: number): boolean {
  return elapsedSeconds >= SLOW_REFRESH_HINT_SECONDS;
}

export function getRefreshProgressText(
  phase: RefreshProgressPhase,
  elapsedSeconds: number,
  lang: LanguageCode,
): string {
  return t(`refresh.phase.${phase}`, lang, { seconds: elapsedSeconds });
}
