import assert from "node:assert/strict";
import test from "node:test";
import { EventEmitter } from "node:events";
import type { Client } from "discord.js";
import { BotManager } from "../src/bot-manager.js";
import type { RuntimeApiClient } from "../src/api-client.js";
import type { RuntimeBot } from "../src/types.js";

class FakeClient extends EventEmitter {
  public user = undefined;
  public loggedIn = false;
  public destroyed = false;
  async login() { this.loggedIn = true; return "token"; }
  destroy() { this.destroyed = true; }
}

function bot(id: string): RuntimeBot {
  return {
    id, name: `Bot ${id}`, discordApplicationId: null, discordGuildId: null,
    discordToken: `token-${id}`, restartRevision: 0,
    runtimeSubscription: { id: `runtime-${id}`, currentPeriodEnd: "2099-01-01T00:00:00Z", autoRenew: false },
    features: [{
      installationId: `install-${id}`, code: "broken-feature", version: "1.0.0",
      runtimeKey: "broken-feature", configRevision: 1, config: {}, secrets: {},
      presentations: {}, runtimeState: {},
    }],
  };
}

test("a feature activation failure does not stop its bot or the next bot", async () => {
  const statuses: Array<Record<string, unknown>> = [];
  const clients: FakeClient[] = [];
  const api = {
    reportStatus: async (status: Record<string, unknown>) => { statuses.push(status); },
  } as unknown as RuntimeApiClient;
  const manager = new BotManager(
    api,
    () => { const client = new FakeClient(); clients.push(client); return client as unknown as Client; },
    () => ({
      runtimeKey: "broken-feature", version: "1.0.0", intents: [],
      async activate() { throw new Error("broken activation"); },
    }),
  );

  await manager.reconcile([bot("a"), bot("b")]);

  assert.equal(clients.length, 2);
  assert.equal(clients.every((client) => client.loggedIn && !client.destroyed), true);
  assert.equal(statuses.filter((status) => status.status === "ERROR").length, 2);
  assert.equal(statuses.filter((status) => status.status === "RUNNING").length, 2);
  await manager.shutdown();
});
