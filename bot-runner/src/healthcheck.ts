import { isHealthy } from "./runtime-health.js";

const interval = Number(process.env.RUNTIME_POLL_INTERVAL_MS ?? "30000");
process.exitCode = isHealthy(undefined, Math.max(90_000, interval * 3)) ? 0 : 1;
