import { RuntimeApiClient } from "./api-client.js";
import { ProcessBotManager } from "./process-bot-manager.js";
import { loadConfig } from "./config.js";

const config = loadConfig();
const api = new RuntimeApiClient(config.backendUrl, config.apiToken);
const manager = new ProcessBotManager(api);
let stopping = false;
let syncing = false;

async function sync(): Promise<void> {
  if (stopping || syncing) return;
  syncing = true;
  try {
    const bootstrap = await api.bootstrap();
    if (bootstrap) await manager.reconcile(bootstrap.bots);
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
  } finally {
    syncing = false;
  }
}

async function shutdown(signal: string): Promise<void> {
  if (stopping) return;
  stopping = true;
  console.info(`Received ${signal}; stopping bots`);
  await manager.shutdown();
  process.exit(0);
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));

await sync();
setInterval(() => void sync(), config.pollIntervalMs);
