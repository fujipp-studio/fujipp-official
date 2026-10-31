import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { clearHealth, isHealthy, markHealthy } from "../src/runtime-health.js";

test("health requires a fresh successful sync owned by a running supervisor", () => {
  const directory = mkdtempSync(join(tmpdir(), "runner-health-"));
  const file = join(directory, "health.json");
  try {
    assert.equal(isHealthy(file), false);
    markHealthy(file, 1000);
    assert.equal(isHealthy(file, 90_000, 2000), true);
    assert.equal(isHealthy(file, 90_000, 92_000), false);
    assert.equal(isHealthy(file, 90_000, 500), false);
    assert.equal(isHealthy(file, Number.NaN, 2000), false);
    const state = JSON.parse(readFileSync(file, "utf8"));
    assert.equal(state.pid, process.pid);
    writeFileSync(file, "not-json");
    assert.equal(isHealthy(file), false);
    writeFileSync(file, JSON.stringify({ pid: -1, checkedAt: 1000 }));
    assert.equal(isHealthy(file, 90_000, 2000), false);
    markHealthy(file);
    clearHealth(file);
    assert.equal(isHealthy(file), false);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
