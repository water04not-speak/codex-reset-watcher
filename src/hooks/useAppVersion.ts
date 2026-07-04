import { useEffect, useState } from "react";
import { getVersion } from "@tauri-apps/api/app";

/** Build-time fallback from package.json (see vite.config.ts). */
function buildTimeVersion(): string {
  if (typeof __APP_VERSION__ === "string" && __APP_VERSION__.length > 0) {
    return __APP_VERSION__;
  }
  return "0.0.0";
}

/**
 * App version for UI display.
 * Prefers Tauri runtime version (matches the built host); falls back to package version.
 */
export function useAppVersion(): string {
  const [version, setVersion] = useState(buildTimeVersion);

  useEffect(() => {
    let cancelled = false;
    getVersion()
      .then((v) => {
        if (!cancelled && v) setVersion(v);
      })
      .catch(() => {
        // Non-Tauri / test environments keep the build-time version.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return version;
}
