import type { RuntimeBot } from "./types.js";

export type SupervisorToWorker =
  | { type: "start"; bot: RuntimeBot }
  | { type: "update"; bot: RuntimeBot }
  | { type: "shutdown" };

export type WorkerToSupervisor =
  | { type: "ready" }
  | { type: "updated"; fingerprint: string }
  | { type: "rpc"; requestId: number; method: string; args: unknown[] };

export type SupervisorRpcResponse =
  | { type: "rpc-result"; requestId: number; result: unknown }
  | { type: "rpc-error"; requestId: number; error: string };
