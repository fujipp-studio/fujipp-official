import { fork, type ChildProcess } from "node:child_process";
import type { RuntimeApi } from "./api-client.js";
import { makeFingerprint, makeRestartFingerprint } from "./bot-manager.js";
import type { RuntimeBot } from "./types.js";
import type { SupervisorRpcResponse, SupervisorToWorker, WorkerToSupervisor } from "./worker-protocol.js";

// Every exposed RuntimeApi method needs an explicit supervisor decision.
// Keep this exhaustive so new feature APIs cannot silently miss the worker bridge.
const ALLOWED_RPC_METHODS = {
  reportStatus: true,
  saveFeatureState: true,
  walletBalance: true,
  walletVoucher: true,
  paymentVoucher: true,
  createPromptPay: true,
  verifySlip: true,
  adjustWallet: true,
  walletHistory: true,
  walletMonthlySummary: true,
  walletLeaderboard: true,
  beginRobuxPayout: true,
  claimRobuxPayout: true,
  finishRobuxPayout: true,
  refundRobuxPayout: true,
  recoverableRobuxPayouts: true,
  addMemberSpending: true,
  setMemberSpending: true,
  getMemberSpending: true,
  removeMemberSpending: true,
  memberSpendingLeaderboard: true,
  memberSpendingTotals: true,
  beginRoleShopPurchase: true,
  claimRoleShopPurchase: true,
  completeRoleShopPurchase: true,
  refundRoleShopPurchase: true,
  recoverableRoleShopPurchases: true,
  ticketList: true,
  ticketSave: true,
  ticketArchive: true,
  ticketNextNumber: true,
} satisfies Record<keyof RuntimeApi, true>;

interface WorkerState { child: ChildProcess; fingerprint: string; restartFingerprint: string; stopping: boolean; crashes: number[]; }

export class ProcessBotManager {
  private readonly workers = new Map<string, WorkerState>();
  private desired = new Map<string, RuntimeBot>();

  private readonly workerMemoryMb: number;

  public constructor(private readonly api: RuntimeApi, env: NodeJS.ProcessEnv = process.env, private readonly childFactory: typeof fork = fork) {
    const configured = Number(env.BOT_WORKER_MAX_OLD_SPACE_MB ?? "256");
    if (!Number.isInteger(configured) || configured < 128 || configured > 1024) {
      throw new Error("BOT_WORKER_MAX_OLD_SPACE_MB must be an integer between 128 and 1024");
    }
    this.workerMemoryMb = configured;
  }

  public async reconcile(bots: RuntimeBot[]): Promise<void> {
    this.desired = new Map(bots.map((bot) => [bot.id, bot]));
    for (const id of this.workers.keys()) if (!this.desired.has(id)) await this.stop(id);
    for (const bot of bots) {
      const fingerprint = makeFingerprint(bot);
      const current = this.workers.get(bot.id);
      if (current?.fingerprint === fingerprint) continue;
      if (current && current.restartFingerprint === makeRestartFingerprint(bot) && current.child.connected) {
        current.child.send({ type: "update", bot } satisfies SupervisorToWorker);
        continue;
      }
      if (current) await this.stop(bot.id);
      this.start(bot, fingerprint, current?.crashes ?? []);
    }
  }

  public retryUpdates(): void {
    for (const [botId, state] of this.workers) {
      const bot = this.desired.get(botId);
      if (bot && state.child.connected && state.fingerprint !== makeFingerprint(bot)
        && state.restartFingerprint === makeRestartFingerprint(bot)) {
        state.child.send({ type: "update", bot } satisfies SupervisorToWorker);
      }
    }
  }

  public async shutdown(): Promise<void> {
    this.desired.clear();
    await Promise.all([...this.workers.keys()].map((id) => this.stop(id)));
  }

  private start(bot: RuntimeBot, fingerprint: string, crashes: number[]): void {
    const child = this.childFactory(new URL("./worker-entry.js", import.meta.url), [], {
      stdio: ["ignore", "inherit", "inherit", "ipc"],
      env: workerEnvironment(process.env, bot.id),
      execArgv: [`--max-old-space-size=${this.workerMemoryMb}`],
    });
    const state: WorkerState = { child, fingerprint, restartFingerprint: makeRestartFingerprint(bot), stopping: false, crashes };
    this.workers.set(bot.id, state);
    child.on("message", (message: WorkerToSupervisor) => void this.handleMessage(bot.id, state, message));
    child.once("exit", (code, signal) => void this.handleExit(bot.id, state, code, signal));
    child.send({ type: "start", bot } satisfies SupervisorToWorker);
  }

  private async handleMessage(botId: string, state: WorkerState, message: WorkerToSupervisor): Promise<void> {
    if (message.type === "updated") {
      const desired = this.desired.get(botId);
      if (this.workers.get(botId) === state && desired && message.fingerprint === makeFingerprint(desired)) state.fingerprint = message.fingerprint;
      return;
    }
    if (message.type !== "rpc") return;
    if (!Object.hasOwn(ALLOWED_RPC_METHODS, message.method)) {
      return this.respond(state.child, { type: "rpc-error", requestId: message.requestId, error: "RPC method is not allowed" });
    }
    // A stopping worker still needs its own replies to drain activation and
    // disposal work. Never route those replies to a replacement worker.
    if (!state.child.connected || (!state.stopping && this.workers.get(botId) !== state)) {
      return this.respond(state.child, { type: "rpc-error", requestId: message.requestId, error: "RPC worker is no longer active" });
    }
    if (!rpcBelongsToBot(botId, message.method, message.args)) {
      return this.respond(state.child, { type: "rpc-error", requestId: message.requestId, error: "RPC bot scope mismatch" });
    }
    try {
      const method = (this.api as unknown as Record<string, (...args: unknown[]) => Promise<unknown>>)[message.method];
      if (!method) throw new Error("Runtime API method is unavailable");
      const result = await method.apply(this.api, message.args);
      this.respond(state.child, { type: "rpc-result", requestId: message.requestId, result });
    } catch (error) {
      this.respond(state.child, { type: "rpc-error", requestId: message.requestId, error: error instanceof Error ? error.message.slice(0, 2000) : "Runtime API failed" });
    }
  }

  private respond(child: ChildProcess | undefined, message: SupervisorRpcResponse): void {
    if (child?.connected) child.send(message);
  }

  private async handleExit(botId: string, state: WorkerState, code: number | null, signal: NodeJS.Signals | null): Promise<void> {
    if (this.workers.get(botId) !== state) return;
    this.workers.delete(botId);
    if (state.stopping || !this.desired.has(botId)) return;
    const now = Date.now();
    const crashes = [...state.crashes.filter((time) => now - time < 300_000), now];
    await this.api.reportStatus({ botId, status: "CRASHED", errorMessage: `Bot worker exited (${signal ?? code ?? "unknown"})` }).catch(() => undefined);
    if (crashes.length >= 5) {
      console.error(`Bot worker crash loop stopped: ${botId}`);
      return;
    }
    const bot = this.desired.get(botId);
    if (bot) setTimeout(() => { if (this.desired.has(botId) && !this.workers.has(botId)) this.start(bot, makeFingerprint(bot), crashes); }, Math.min(30_000, 1_000 * 2 ** (crashes.length - 1)));
  }

  private async stop(botId: string): Promise<void> {
    const state = this.workers.get(botId);
    if (!state) return;
    state.stopping = true;
    this.workers.delete(botId);
    if (!state.child.connected) return;
    state.child.send({ type: "shutdown" } satisfies SupervisorToWorker);
    await new Promise<void>((resolve) => {
      const timer = setTimeout(() => { state.child.kill("SIGKILL"); resolve(); }, 10_000);
      state.child.once("exit", () => { clearTimeout(timer); resolve(); });
    });
  }
}

export function rpcBelongsToBot(botId: string, method: string, args: unknown[]): boolean {
  if (method === "reportStatus" || method === "saveFeatureState") {
    const input = args[0] as { botId?: unknown } | undefined;
    return input?.botId === botId;
  }
  return args[0] === botId;
}

export function workerEnvironment(env: NodeJS.ProcessEnv, botId: string): NodeJS.ProcessEnv {
  const safe: NodeJS.ProcessEnv = { ...env, BOT_WORKER_ID: botId };
  delete safe.RUNNER_API_TOKEN;
  delete safe.RUNNER_API_PREVIOUS_TOKEN;
  delete safe.NODE_OPTIONS;
  return safe;
}
