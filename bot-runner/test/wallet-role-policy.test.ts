import assert from "node:assert/strict";
import test from "node:test";
import { topSpenderRolePolicy } from "../src/features/wallet-topup/role-policy.js";

test("top spender roles never reuse the temporary slip role", () => {
  const policy = topSpenderRolePolicy("slip", "slip", "top-10", [
    { thresholdSatang: 10_000, roleId: "slip" },
    { thresholdSatang: 20_000, roleId: "milestone" },
  ]);

  assert.equal(policy.top1, "");
  assert.equal(policy.top10, "top-10");
  assert.deepEqual(policy.milestones, [{ thresholdSatang: 20_000, roleId: "milestone" }]);
  assert.deepEqual(policy.managed, ["top-10", "milestone"]);
});

test("top spender managed roles are unique", () => {
  const policy = topSpenderRolePolicy("slip", "ranking", "ranking", [
    { thresholdSatang: 10_000, roleId: "ranking" },
  ]);

  assert.deepEqual(policy.managed, ["ranking"]);
});
