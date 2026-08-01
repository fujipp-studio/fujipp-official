import { Client, Options } from "discord.js";
import { createHash } from "node:crypto";
import { RuntimeApiClient } from "./api-client.js";
import { getFeature } from "./feature-registry.js";
import type { RuntimeBot } from "./types.js";

interface RunningBot {
  client: Client;
  fingerprint: string;
  disposers: Array<() => void>;
}

export class BotManager {
  private readonly running = new Map<string, RunningBot>();

  public constructor(private readonly api: RuntimeApiClient) {}

  public async reconcile(desired: RuntimeBot[]): Promise<void> {
    const desiredIds = new Set(desired.map((bot) => bot.id));
    for (const id of this.running.keys()) {
      if (!desiredIds.has(id)) await this.stop(id, "STOPPED");
    }
    for (const bot of desired) {
      const fingerprint = makeFingerprint(bot);
      const current = this.running.get(bot.id);
      if (current?.fingerprint === fingerprint) continue;
      if (current) await this.stop(bot.id, "STOPPED");
      await this.start(bot, fingerprint);
    }
  }

  public async shutdown(): Promise<void> {
    await Promise.all([...this.running.keys()].map((id) => this.stop(id, "STOPPED")));
  }

  private async start(bot: RuntimeBot, fingerprint: string): Promise<void> {
    const resolved = bot.features.map((feature) => ({
      feature,
      module: getFeature(feature.runtimeKey),
    }));
    const intents = new Set(resolved.flatMap(({ module }) => module?.intents ?? []));
    const client = new Client({
      intents: [...intents],
      makeCache: Options.cacheWithLimits({
        MessageManager: 0,
        ReactionManager: 0,
        PresenceManager: 0,
        GuildMemberManager: { maxSize: 200 },
      }),
      sweepers: { messages: { interval: 300, lifetime: 300 } },
    });
    const disposers: Array<() => void> = [];
    this.running.set(bot.id, { client, fingerprint, disposers });

    try {
      for (const { feature, module } of resolved) {
        if (!module) {
          await this.api.reportStatus({
            botId: bot.id,
            installationId: feature.installationId,
            status: "ERROR",
            errorCode: "FEATURE_NOT_BUNDLED",
            errorMessage: `Runtime module ${feature.runtimeKey} is not bundled`,
          });
          continue;
        }
        const dispose = await module.activate({
          botId: bot.id,
          client,
          config: Object.freeze(feature.config),
          secrets: Object.freeze(feature.secrets),
          presentations: Object.freeze(feature.presentations),
        });
        disposers.push(dispose);
      }
      await client.login(bot.discordToken);
      await this.api.reportStatus({ botId: bot.id, status: "RUNNING" });
      await Promise.all(resolved.filter(({ module }) => module).map(({ feature }) =>
        this.api.reportStatus({
          botId: bot.id,
          installationId: feature.installationId,
          status: "ACTIVE",
        }),
      ));
      console.info(`Bot started: ${bot.name} (${bot.id})`);
    } catch (error) {
      await this.disposeClient(client, disposers);
      this.running.delete(bot.id);
      await this.api.reportStatus({
        botId: bot.id,
        status: "CRASHED",
        errorMessage: errorMessage(error),
      }).catch(() => undefined);
      console.error(`Bot failed: ${bot.name} (${bot.id}): ${errorMessage(error)}`);
    }
  }

  private async stop(botId: string, status: string): Promise<void> {
    const running = this.running.get(botId);
    if (!running) return;
    this.running.delete(botId);
    await this.disposeClient(running.client, running.disposers);
    await this.api.reportStatus({ botId, status }).catch(() => undefined);
  }

  private async disposeClient(client: Client, disposers: Array<() => void>): Promise<void> {
    for (const dispose of disposers.reverse()) {
      try { dispose(); } catch { /* continue cleanup */ }
    }
    client.destroy();
  }
}

function makeFingerprint(bot: RuntimeBot): string {
  return createHash("sha256")
    .update(bot.discordToken)
    .update(JSON.stringify(bot.features))
    .digest("hex");
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message.slice(0, 2000) : "Unknown runtime error";
}
