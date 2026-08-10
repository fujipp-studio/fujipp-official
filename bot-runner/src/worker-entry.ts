import { BotManager } from "./bot-manager.js";
import { writeFileSync } from "node:fs";
import type { RuntimeApi } from "./api-client.js";
import type { SupervisorRpcResponse, SupervisorToWorker, WorkerToSupervisor } from "./worker-protocol.js";

try {
  // Prefer this disposable bot worker over the supervisor if the Linux cgroup
  // must choose a process during an out-of-memory event.
  writeFileSync("/proc/self/oom_score_adj", "500");
} catch { /* Non-Linux development host or restricted kernel; memory limit still applies. */ }

let requestId = 0;
const pending = new Map<number, { resolve(value: unknown): void; reject(error: Error): void }>();

const api = new Proxy({}, {
  get(_target, property) {
    if (typeof property !== "string") return undefined;
    return (...args: unknown[]) => new Promise((resolve, reject) => {
      const id = ++requestId;
      pending.set(id, { resolve, reject });
      send({ type: "rpc", requestId: id, method: property, args });
    });
  },
}) as RuntimeApi;

const manager = new BotManager(api);
let started = false;

process.on("message", (message: SupervisorToWorker | SupervisorRpcResponse) => {
  if (message.type === "rpc-result" || message.type === "rpc-error") {
    const call = pending.get(message.requestId);
    if (!call) return;
    pending.delete(message.requestId);
    if (message.type === "rpc-result") call.resolve(message.result);
    else call.reject(new Error(message.error));
    return;
  }
  if (message.type === "start" && !started) {
    started = true;
    void manager.reconcile([message.bot]).then(() => send({ type: "ready" }));
  }
  if (message.type === "shutdown") void manager.shutdown().finally(() => process.exit(0));
});

process.on("disconnect", () => void manager.shutdown().finally(() => process.exit(0)));
process.on("SIGTERM", () => void manager.shutdown().finally(() => process.exit(0)));

function send(message: WorkerToSupervisor): void {
  if (process.connected) process.send?.(message);
}
