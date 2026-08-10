export interface RunnerConfig {
  backendUrl: string;
  apiToken: string;
  pollIntervalMs: number;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): RunnerConfig {
  const backendUrl = required(env, "BACKEND_API_URL");
  const apiToken = required(env, "RUNNER_API_TOKEN");
  if (apiToken.length < 32) throw new Error("RUNNER_API_TOKEN must contain at least 32 characters");
  const pollIntervalMs = Number(env.RUNTIME_POLL_INTERVAL_MS ?? "30000");
  if (!Number.isInteger(pollIntervalMs) || pollIntervalMs < 5000) {
    throw new Error("RUNTIME_POLL_INTERVAL_MS must be an integer of at least 5000");
  }
  return { backendUrl, apiToken, pollIntervalMs };
}

function required(env: NodeJS.ProcessEnv, key: string): string {
  const value = env[key]?.trim();
  if (!value) throw new Error(`${key} is required`);
  return value;
}
