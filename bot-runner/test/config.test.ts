import assert from "node:assert/strict";
import test from "node:test";
import { loadConfig } from "../src/config.js";

test("loads the runner configuration", () => {
  assert.deepEqual(loadConfig({
    BACKEND_API_URL: "http://backend:8080",
    RUNNER_API_TOKEN: "secret",
    RUNTIME_POLL_INTERVAL_MS: "10000",
  }), {
    backendUrl: "http://backend:8080",
    apiToken: "secret",
    pollIntervalMs: 10000,
  });
});

test("rejects a dangerously short polling interval", () => {
  assert.throws(() => loadConfig({
    BACKEND_API_URL: "http://backend:8080",
    RUNNER_API_TOKEN: "secret",
    RUNTIME_POLL_INTERVAL_MS: "1000",
  }), /at least 5000/);
});
