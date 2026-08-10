import { Client, Options } from "discord.js";
import { createHash } from "node:crypto";
import type { RuntimeApi } from "./api-client.js";
import { getFeature } from "./feature-registry.js";
import { createCommandPermissionGate } from "./command-permissions.js";
import type { FeatureModule, RuntimeBot } from "./types.js";

type ClientFactory = (options: ConstructorParameters<typeof Client>[0]) => Client;
type FeatureResolver = (runtimeKey: string, version: string) => FeatureModule | undefined;

interface RunningBot {
  client: Client;
  fingerprint: string;
  disposers: Array<() => void | Promise<void>>;
}

export class BotManager {
  private readonly running = new Map<string, RunningBot>();

  public constructor(
    private readonly api: RuntimeApi,
    private readonly clientFactory: ClientFactory = (options) => new Client(options),
    private readonly featureResolver: FeatureResolver = getFeature,
  ) {}

  public async reconcile(desired: RuntimeBot[]): Promise<void> {
    const desiredIds = new Set(desired.map((bot) => bot.id));
    for (const id of this.running.keys()) {
      if (!desiredIds.has(id)) await this.stop(id, "STOPPED");
    }
    for (const bot of desired) {
      try {
        const fingerprint = makeFingerprint(bot);
        const current = this.running.get(bot.id);
        if (current?.fingerprint === fingerprint) {
          await this.reportBotProfile(bot.id, current.client).catch((error) => {
            console.warn(`Unable to refresh bot profile ${bot.id}: ${errorMessage(error)}`);
          });
          continue;
        }
        if (current) await this.stop(bot.id, "STOPPED");
        await this.start(bot, fingerprint);
      } catch (error) {
        console.error(`Bot reconcile failed: ${bot.name} (${bot.id}): ${errorMessage(error)}`);
      }
    }
  }

  public async shutdown(): Promise<void> {
    await Promise.all([...this.running.keys()].map((id) => this.stop(id, "STOPPED")));
  }

  private async start(bot: RuntimeBot, fingerprint: string): Promise<void> {
    const resolved = bot.features.map((feature) => ({
      feature,
      module: this.featureResolver(feature.runtimeKey, feature.version),
    }));
    const intents = new Set(resolved.flatMap(({ module }) => module?.intents ?? []));
    const client = this.clientFactory({
      intents: [...intents],
      makeCache: Options.cacheWithLimits({
        MessageManager: 0,
        ReactionManager: 0,
        PresenceManager: 0,
        GuildMemberManager: { maxSize: 200 },
      }),
      sweepers: { messages: { interval: 300, lifetime: 300 } },
    });
    const disposers: Array<() => void | Promise<void>> = [];
    const permissionFeature = bot.features.find((feature) => feature.code === "bot-permissions");
    const permissions = createCommandPermissionGate(permissionFeature?.config);
    const activatedFeatures: RuntimeBot["features"] = [];
    this.running.set(bot.id, { client, fingerprint, disposers });
    this.attachClientSafety(bot, client);

    try {
      for (const { feature, module } of resolved) {
        if (!module) {
          await this.api.reportStatus({
            botId: bot.id,
            installationId: feature.installationId,
            status: "ERROR",
            errorCode: "FEATURE_VERSION_NOT_BUNDLED",
            errorMessage: `Runtime module ${feature.runtimeKey}@${feature.version} is not bundled`,
          });
          continue;
        }
        try {
          const dispose = await module.activate({
            botId: bot.id,
            installationId: feature.installationId,
            guildId: bot.discordGuildId,
            client,
            config: Object.freeze(feature.config),
            secrets: Object.freeze(feature.secrets),
            presentations: Object.freeze(feature.presentations),
            runtimeState: Object.freeze(feature.runtimeState),
            runtimeSubscription: Object.freeze(bot.runtimeSubscription),
            installedFeatureCodes: new Set(bot.features.map((item) => item.code)),
            permissions,
            reportFeatureError: async (errorCode, error) => {
              await this.api.reportStatus({
                botId: bot.id, installationId: feature.installationId, status: "ERROR",
                errorCode, errorMessage: errorMessage(error),
              }).catch(() => undefined);
            },
            saveRuntimeState: (state) => this.api.saveFeatureState({ botId: bot.id, installationId: feature.installationId, state }),
            wallet: {
              balance: (memberDiscordId) => this.api.walletBalance(bot.id, memberDiscordId), voucher: (input) => this.api.walletVoucher(bot.id, input),
              createPromptPay: (memberDiscordId, amountSatang) => this.api.createPromptPay(bot.id, memberDiscordId, amountSatang), verifySlip: (input) => this.api.verifySlip(bot.id, input),
              adjust: (input) => this.api.adjustWallet(bot.id, input), history: (memberDiscordId,limit) => this.api.walletHistory(bot.id,memberDiscordId,limit),
              monthlySummary: (memberDiscordId) => this.api.walletMonthlySummary(bot.id,memberDiscordId), leaderboard: (limit) => this.api.walletLeaderboard(bot.id,limit),
            },
            robux: {
              begin: (input) => this.api.beginRobuxPayout(bot.id,input), claim: (jobId) => this.api.claimRobuxPayout(bot.id,jobId),
              outcome: (jobId,input) => this.api.finishRobuxPayout(bot.id,jobId,input), refund: (jobId,input) => this.api.refundRobuxPayout(bot.id,jobId,input), recoverable: () => this.api.recoverableRobuxPayouts(bot.id),
            },
            memberSpending: {
              add: (memberDiscordId,deltaSatang) => this.api.addMemberSpending(bot.id,memberDiscordId,deltaSatang), set: (memberDiscordId,input) => this.api.setMemberSpending(bot.id,memberDiscordId,input),
              get: (memberDiscordId) => this.api.getMemberSpending(bot.id,memberDiscordId), remove: (memberDiscordId) => this.api.removeMemberSpending(bot.id,memberDiscordId),
              leaderboard: (limit) => this.api.memberSpendingLeaderboard(bot.id,limit), totals: () => this.api.memberSpendingTotals(bot.id),
            },
          });
          disposers.push(dispose);
          activatedFeatures.push(feature);
        } catch (error) {
          console.error(`Feature activation failed: ${feature.code} on bot ${bot.id}: ${errorMessage(error)}`);
          await this.api.reportStatus({
            botId: bot.id, installationId: feature.installationId, status: "ERROR",
            errorCode: "FEATURE_ACTIVATION_FAILED", errorMessage: errorMessage(error),
          }).catch(() => undefined);
        }
      }
      await client.login(bot.discordToken);
      await this.reportBotProfile(bot.id, client).catch((error) => {
        console.warn(`Unable to report started bot profile ${bot.id}: ${errorMessage(error)}`);
      });
      await Promise.allSettled(activatedFeatures.map((feature) =>
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

  private async reportBotProfile(botId: string, client: Client): Promise<void> {
    await this.api.reportStatus({
      botId,
      status: "RUNNING",
      ...(client.user?.username ? { discordUsername: client.user.username } : {}),
      ...(client.user ? { discordAvatarUrl: client.user.displayAvatarURL({ extension: "png", size: 256 }) } : {}),
    });
  }

  private attachClientSafety(bot: RuntimeBot, client: Client): void {
    client.on("error", (error) => {
      console.error(`Discord client error: ${bot.name} (${bot.id}): ${errorMessage(error)}`);
      void this.api.reportStatus({ botId: bot.id, status: "RUNNING", errorMessage: errorMessage(error) }).catch(() => undefined);
    });
    client.on("shardError", (error) => {
      console.error(`Discord shard error: ${bot.name} (${bot.id}): ${errorMessage(error)}`);
      void this.api.reportStatus({ botId: bot.id, status: "RUNNING", errorMessage: errorMessage(error) }).catch(() => undefined);
    });
    client.on("warn", (message) => console.warn(`Discord warning: ${bot.name} (${bot.id}): ${message}`));
    client.on("invalidated", () => {
      console.error(`Discord session invalidated: ${bot.name} (${bot.id})`);
      const running = this.running.get(bot.id);
      if (running) running.fingerprint = `invalidated:${Date.now()}`;
      void this.api.reportStatus({ botId: bot.id, status: "CRASHED", errorMessage: "Discord session invalidated" }).catch(() => undefined);
    });
  }

  private async disposeClient(client: Client, disposers: Array<() => void | Promise<void>>): Promise<void> {
    for (const dispose of disposers.reverse()) {
      try { await dispose(); } catch { /* continue cleanup */ }
    }
    client.destroy();
  }
}

export function makeFingerprint(bot: RuntimeBot): string {
  const features = bot.features.map(({ runtimeState: _runtimeState, ...feature }) => feature);
  return createHash("sha256")
    .update(bot.discordToken)
    .update(bot.name)
    .update(bot.discordApplicationId ?? "")
    .update(bot.discordGuildId ?? "")
    .update(String(bot.restartRevision))
    .update(JSON.stringify(features))
    .digest("hex");
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message.slice(0, 2000) : "Unknown runtime error";
}
