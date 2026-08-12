import assert from "node:assert/strict";
import test from "node:test";
import { runRoleRemoval } from "../src/features/wallet-topup/role-actions.js";

test("temporary role removal retries once after a Discord failure", async () => {
  let calls = 0;
  await runRoleRemoval(async () => {
    calls += 1;
    if (calls === 1) throw new Error("temporary Discord failure");
  });

  assert.equal(calls, 2);
});

test("temporary role removal surfaces the final Discord failure", async () => {
  let calls = 0;
  await assert.rejects(
    runRoleRemoval(async () => {
      calls += 1;
      throw new Error("missing permissions");
    }),
    /missing permissions/,
  );
  assert.equal(calls, 2);
});
