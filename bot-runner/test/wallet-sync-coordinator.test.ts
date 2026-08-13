import assert from "node:assert/strict";
import test from "node:test";
import { LatestSyncCoordinator } from "../src/features/wallet-topup/sync-coordinator.js";

test("concurrent sync requests serialize and coalesce into one latest rerun", async () => {
  let active = 0, maxActive = 0, runs = 0;
  let releaseFirst!: () => void;
  const first = new Promise<void>((resolve) => { releaseFirst = resolve; });
  const coordinator = new LatestSyncCoordinator(async () => {
    runs += 1; active += 1; maxActive = Math.max(maxActive, active);
    if (runs === 1) await first;
    active -= 1;
    return runs;
  });
  const requests = [coordinator.request(), coordinator.request(), coordinator.request()];
  releaseFirst();
  assert.deepEqual(await Promise.all(requests), [2, 2, 2]);
  assert.equal(runs, 2);
  assert.equal(maxActive, 1);
});
