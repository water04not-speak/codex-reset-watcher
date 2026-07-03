import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const script = join(root, "examples", "mock-codex-usage.py");
const commands = ["all", "resets", "online-usage", "local-usage"];

function hasCredits(data) {
  return (
    Array.isArray(data?.resets) ||
    Array.isArray(data?.credits) ||
    Array.isArray(data?.reset_credits?.credits)
  );
}

function hasRateLimits(data) {
  const rl = data?.rate_limits ?? data?.rate_limit;
  if (!rl || typeof rl !== "object") return false;
  return Boolean(rl.primary || rl.primary_window || rl.secondary || rl.secondary_window);
}

function hasUsage(data) {
  const usage = data?.usage;
  return (
    usage &&
    typeof usage === "object" &&
    typeof usage.today_tokens === "number" &&
    typeof usage.thirty_day_tokens === "number" &&
    typeof usage.top_model === "string"
  );
}

let failed = false;

for (const command of commands) {
  const result = spawnSync("python", [script, command, "--json"], {
    encoding: "utf8",
  });

  if (result.status !== 0) {
    console.error(`[FAIL] ${command}: exit code ${result.status}`);
    if (result.stderr) console.error(result.stderr.trim());
    failed = true;
    continue;
  }

  let data;
  try {
    data = JSON.parse(result.stdout);
  } catch (error) {
    console.error(`[FAIL] ${command}: invalid JSON (${error.message})`);
    failed = true;
    continue;
  }

  if (command === "all") {
    if (!hasCredits(data) || !hasRateLimits(data) || !hasUsage(data)) {
      console.error(`[FAIL] ${command}: missing credits, rate limits, or usage fields`);
      failed = true;
      continue;
    }
  }

  if (command === "resets" && !hasCredits(data)) {
    console.error(`[FAIL] ${command}: missing reset credits`);
    failed = true;
    continue;
  }

  if (command === "online-usage" && !hasRateLimits(data)) {
    console.error(`[FAIL] ${command}: missing rate limit windows`);
    failed = true;
    continue;
  }

  if (command === "local-usage" && !hasUsage(data)) {
    console.error(`[FAIL] ${command}: missing usage summary`);
    failed = true;
    continue;
  }

  console.log(`[OK] ${command}`);
}

process.exit(failed ? 1 : 0);
