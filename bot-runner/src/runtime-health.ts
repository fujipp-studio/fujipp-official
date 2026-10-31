import { readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";

export const healthFile = "/tmp/fujipp-runner-health.json";

export function clearHealth(file = healthFile): void {
  rmSync(file, { force: true });
  rmSync(`${file}.next`, { force: true });
}

export function markHealthy(file = healthFile, now = Date.now()): void {
  writeFileSync(`${file}.next`, JSON.stringify({ pid: process.pid, checkedAt: now }), { mode: 0o600 });
  renameSync(`${file}.next`, file);
}

export function isHealthy(file = healthFile, maxAgeMs = 90_000, now = Date.now()): boolean {
  try {
    const value = JSON.parse(readFileSync(file, "utf8")) as { pid: number; checkedAt: number };
    if (!Number.isSafeInteger(value.pid) || value.pid <= 0 || !Number.isFinite(value.checkedAt)
      || !Number.isFinite(maxAgeMs) || maxAgeMs <= 0 || now < value.checkedAt
      || now - value.checkedAt > maxAgeMs) return false;
    process.kill(value.pid, 0);
    return true;
  } catch { return false; }
}
