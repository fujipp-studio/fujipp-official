import assert from "node:assert/strict";
import test from "node:test";
import { EventEmitter } from "node:events";
import type { fork } from "node:child_process";
import type { RuntimeApi } from "../src/api-client.js";
import type { RuntimeBot } from "../src/types.js";
import { ProcessBotManager, rpcBelongsToBot, workerEnvironment } from "../src/process-bot-manager.js";

test("worker environment never receives runner credentials", () => {
  const environment = workerEnvironment({ RUNNER_API_TOKEN: "current", RUNNER_API_PREVIOUS_TOKEN: "old", SAFE: "yes" }, "bot-a");
  assert.equal(environment.RUNNER_API_TOKEN, undefined);
  assert.equal(environment.RUNNER_API_PREVIOUS_TOKEN, undefined);
  assert.equal(environment.BOT_WORKER_ID, "bot-a");
  assert.equal(environment.SAFE, "yes");
});

test("supervisor rejects RPC calls for another bot", () => {
  assert.equal(rpcBelongsToBot("bot-a", "walletBalance", ["bot-a", "member"]), true);
  assert.equal(rpcBelongsToBot("bot-a", "walletBalance", ["bot-b", "member"]), false);
  assert.equal(rpcBelongsToBot("bot-a", "paymentVoucher", ["bot-a", {}]), true);
  assert.equal(rpcBelongsToBot("bot-a", "paymentVoucher", ["bot-b", {}]), false);
  assert.equal(rpcBelongsToBot("bot-a", "reportStatus", [{ botId: "bot-a", status: "RUNNING" }]), true);
  assert.equal(rpcBelongsToBot("bot-a", "reportStatus", [{ botId: "bot-b", status: "RUNNING" }]), false);
});

class SupervisorTestChild extends EventEmitter {
  connected = true;
  sent: any[] = [];
  onShutdown?: () => void;
  send(message: any) {
    this.sent.push(message);
    if (message.type === 'shutdown') {
      if (this.onShutdown) this.onShutdown();
      else queueMicrotask(() => this.finish());
    }
    return true;
  }
  finish() { if (this.connected) { this.connected = false; this.emit('exit', 0, null); } }
  kill() { this.finish(); return true; }
}
const flushRpc = async () => { for (let i = 0; i < 4; i++) await new Promise(resolve => setImmediate(resolve)); };
function supervisorFixture() {
  const calls: Array<{ method: string; args: unknown[] }> = [];
  const children: SupervisorTestChild[] = [];
  const api = Object.fromEntries(['ticketList','ticketSave','ticketArchive','reportStatus'].map(method =>
    [method, async (...args: unknown[]) => { calls.push({ method, args }); return method === 'ticketList' ? [] : undefined; }])) as unknown as RuntimeApi;
  const factory = (() => { const child = new SupervisorTestChild(); children.push(child); return child; }) as unknown as typeof fork;
  const manager = new ProcessBotManager(api, {}, factory);
  const bot: RuntimeBot = { id: 'bot-a', name: 'Ticket bot', discordToken: 'token', discordApplicationId: null, discordGuildId: null, restartRevision: 0,
    runtimeSubscription: { id: 'runtime', currentPeriodEnd: '2099-01-01T00:00:00Z', autoRenew: false }, features: [] };
  return { calls, children, manager, bot };
}

test('supervisor forwards all Ticket registry and archive methods for the owning bot', async t => {
  const f = supervisorFixture(); t.after(() => f.manager.shutdown());
  await f.manager.reconcile([f.bot]);
  const child = f.children[0]!;
  const requests = [
    { method: 'ticketList', args: ['bot-a','installation'] },
    { method: 'ticketSave', args: ['bot-a','installation','channel','name',{ status: 'OPEN' }] },
    { method: 'ticketArchive', args: ['bot-a','installation','channel',[]] },
  ];
  for (const [index, request] of requests.entries()) child.emit('message', { type: 'rpc', requestId: index + 1, ...request });
  await flushRpc();
  assert.deepEqual(f.calls, requests);
  assert.deepEqual(child.sent.filter(message => message.type === 'rpc-result').map(message => message.requestId), [1,2,3]);
});

test('Ticket RPC calls cannot cross bot scope or invoke private supervisor methods', async t => {
  const f = supervisorFixture(); t.after(() => f.manager.shutdown());
  await f.manager.reconcile([f.bot]);
  const child = f.children[0]!;
  for (const [index, method] of ['ticketList','ticketSave','ticketArchive'].entries())
    child.emit('message', { type: 'rpc', requestId: index, method, args: ['bot-b','installation'] });
  for (const [index, method] of ['bootstrap','constructor','__proto__'].entries())
    child.emit('message', { type: 'rpc', requestId: 10 + index, method, args: ['bot-a'] });
  await flushRpc();
  assert.equal(f.calls.length, 0);
  const errors = child.sent.filter(message => message.type === 'rpc-error');
  assert.equal(errors.length, 6);
  assert.equal(errors.filter(message => message.error === 'RPC bot scope mismatch').length, 3);
  assert.equal(errors.filter(message => message.error === 'RPC method is not allowed').length, 3);
});

test('configuration-triggered restarts drain RPC replies back to the stopping worker', async t => {
  const f = supervisorFixture(); t.after(() => f.manager.shutdown());
  await f.manager.reconcile([f.bot]);
  const child = f.children[0]!;
  child.onShutdown = () => child.emit('message', { type: 'rpc', requestId: 77, method: 'reportStatus', args: [{ botId: 'bot-a', status: 'STOPPED' }] });
  const restarting = f.manager.reconcile([{ ...f.bot, restartRevision: 1 }]);
  try {
    await flushRpc();
    assert.equal(f.calls.some(call => call.method === 'reportStatus'), true);
    assert.equal(child.sent.some(message => message.type === 'rpc-result' && message.requestId === 77), true);
  } finally { child.finish(); await restarting; }
  assert.equal(f.children.length, 2);
  assert.equal(f.children[1]!.sent.some(message => message.requestId === 77), false);
  child.emit('message', { type: 'rpc', requestId: 78, method: 'ticketSave', args: ['bot-a','installation','channel','name',{}] });
  await flushRpc();
  assert.equal(f.calls.some(call => call.method === 'ticketSave'), false);
  assert.equal(f.children[1]!.sent.some(message => message.requestId === 78), false);
});
