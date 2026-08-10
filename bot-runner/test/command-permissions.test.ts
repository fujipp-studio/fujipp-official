import assert from "node:assert/strict";
import test from "node:test";
import type { ChatInputCommandInteraction } from "discord.js";
import { createCommandPermissionGate } from "../src/command-permissions.js";

function interaction(userId: string, roleIds: string[], administrator = false) {
  return {
    user: { id: userId },
    commandName: "spending",
    member: { roles: roleIds },
    memberPermissions: { has: () => administrator },
  } as unknown as ChatInputCommandInteraction;
}

test("keeps the feature default when no permission rule exists", () => {
  const gate = createCommandPermissionGate({ COMMAND_PERMISSION_RULES: [] });
  assert.equal(gate.canUse(interaction("100000000000000", []), "spending/add", false), false);
});

test("allows configured users or roles and always allows administrators", () => {
  const gate = createCommandPermissionGate({ COMMAND_PERMISSION_RULES: [{
    command: "spending/add",
    roleIds: ["200000000000000"],
    userIds: ["300000000000000"],
  }] });
  assert.equal(gate.canUse(interaction("100000000000000", ["200000000000000"]), "spending/add", false), true);
  assert.equal(gate.canUse(interaction("300000000000000", []), "spending/add", false), true);
  assert.equal(gate.canUse(interaction("100000000000000", []), "spending/add", true), false);
  assert.equal(gate.canUse(interaction("100000000000000", [], true), "spending/add", false), true);
});
