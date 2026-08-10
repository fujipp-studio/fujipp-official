import {
  ChannelType,
  type ChatInputCommandInteraction,
  type GuildTextBasedChannel,
  type Interaction,
  type Message,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from "discord.js";
import type { FeatureContext, FeatureModule } from "../../types.js";

const DEFAULT_COMMAND_NAME = "review";
const DEFAULT_CHANNEL_TEMPLATE = "꒰💯꒱┆review 〻{count}";
const COMMAND_NAME_PATTERN = /^[a-z0-9_-]{1,32}$/;
const RENAME_INTERVAL_MS = 5 * 60 * 1_000;

interface ReviewState {
  channelId: string;
  count: number;
  lastReplyId: string | null;
  initialized: boolean;
}

export const reviewCreditFeature: FeatureModule = {
  runtimeKey: "review-credit",
  version: "1.0.0",
  intents: ["Guilds", "GuildMessages"],
  async activate(context) {
    const channelId = requiredSnowflake(context.config.REVIEW_CHANNEL_ID, "REVIEW_CHANNEL_ID");
    const commandName = readCommandName(context.config.REVIEW_COMMAND_NAME);
    const channelTemplate = readTemplate(context.config.REVIEW_CHANNEL_NAME_TEMPLATE);
    const reactions = readStringList(context.config.REVIEW_REACTIONS, 10, 100);
    const replies = readStringList(context.config.REVIEW_REPLY_MESSAGES, 20, 2_000);
    const deleteOldReply = readBoolean(context.config.REVIEW_DELETE_OLD_REPLY, true);
    const roleId = optionalSnowflake(context.config.REVIEW_ROLE_ID, "REVIEW_ROLE_ID");
    let state = readState(context.runtimeState, channelId);
    let queue = Promise.resolve();
    let renameTimer: NodeJS.Timeout | undefined;
    let lastRenameAt = 0;
    let registeredCommandId: string | undefined;
    let stopped = false;

    const saveState = async () => {
      await context.saveRuntimeState({ ...state });
    };

    const resolveChannel = async (): Promise<GuildTextBasedChannel> => {
      const channel = await context.client.channels.fetch(channelId);
      if (!channel || (channel.type !== ChannelType.GuildText && channel.type !== ChannelType.GuildAnnouncement)) {
        throw new Error("Configured review channel is not a guild text channel");
      }
      return channel;
    };

    const renameNow = async (channel: GuildTextBasedChannel) => {
      const target = channelTemplate.replaceAll("{count}", String(state.count));
      if (channel.name === target) return;
      await channel.setName(target, "Review Credit counter update");
      lastRenameAt = Date.now();
    };

    const scheduleRename = (channel: GuildTextBasedChannel) => {
      const remaining = RENAME_INTERVAL_MS - (Date.now() - lastRenameAt);
      if (remaining <= 0) {
        void renameNow(channel).catch(logError(context, "channel rename"));
        return;
      }
      if (renameTimer) return;
      renameTimer = setTimeout(() => {
        renameTimer = undefined;
        void renameNow(channel).catch(logError(context, "channel rename"));
      }, remaining);
      renameTimer.unref();
    };

    const applyReactions = async (message: Message) => {
      await Promise.allSettled(reactions.map((emoji) => message.react(emoji)));
    };

    const assignRole = async (message: Message) => {
      if (!roleId || !message.guild) return;
      const member = message.member ?? await message.guild.members.fetch(message.author.id);
      if (!member.roles.cache.has(roleId)) await member.roles.add(roleId, "Review Credit");
    };

    const sendReply = async (message: Message, channel: GuildTextBasedChannel) => {
      if (replies.length === 0) return;
      if (deleteOldReply && state.lastReplyId) {
        const previous = await channel.messages.fetch(state.lastReplyId).catch(() => null);
        if (previous && previous.author.id === context.client.user?.id) {
          await previous.delete().catch(() => undefined);
        }
      }
      const content = replies[Math.floor(Math.random() * replies.length)];
      if (!content) return;
      const reply = await message.reply({ content }).catch(() => channel.send({ content }));
      state.lastReplyId = reply.id;
    };

    const processReview = async (message: Message) => {
      if (message.author.bot || message.channelId !== channelId) return;
      const channel = await resolveChannel();
      state.count += 1;
      await applyReactions(message);
      await assignRole(message).catch(logError(context, "role assignment"));
      await sendReply(message, channel).catch(logError(context, "reply"));
      await saveState();
      scheduleRename(channel);
    };

    const enqueueReview = (message: Message) => {
      queue = queue.then(() => processReview(message)).catch(logError(context, "message processing"));
    };

    const recount = async (channel: GuildTextBasedChannel, interaction?: ChatInputCommandInteraction) => {
      let count = 0;
      let before: string | undefined;
      let batches = 0;
      for (;;) {
        const messages = await channel.messages.fetch({ limit: 100, ...(before ? { before } : {}) });
        if (messages.size === 0) break;
        count += messages.filter((message) => !message.author.bot).size;
        batches += 1;
        if (interaction && batches % 5 === 0) {
          await interaction.editReply(`กำลังนับข้อความรีวิว... ${count} ข้อความ`);
        }
        if (messages.size < 100) break;
        before = messages.last()?.id;
        if (!before) break;
      }
      state = { ...state, channelId, count, initialized: true };
      await saveState();
      await renameNow(channel);
      return count;
    };

    const refreshLatest = async (channel: GuildTextBasedChannel) => {
      const messages = await channel.messages.fetch({ limit: 100 });
      const latest = messages.find((message) => !message.author.bot);
      if (!latest) return false;
      await applyReactions(latest);
      await sendReply(latest, channel);
      await saveState();
      await renameNow(channel);
      return true;
    };

    const handleCommand = async (interaction: ChatInputCommandInteraction) => {
      if (interaction.commandName !== commandName || !interaction.inGuild()) return;
      if (context.guildId && interaction.guildId !== context.guildId) return;
      if (!context.permissions.canUse(interaction, `${commandName}/${interaction.options.getSubcommand()}`, false)) {
        await interaction.reply({ content: "คุณไม่มีสิทธิ์ใช้คำสั่งนี้", flags: MessageFlags.Ephemeral });
        return;
      }
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const channel = await resolveChannel();
      if (interaction.options.getSubcommand() === "recount") {
        const count = await recount(channel, interaction);
        await interaction.editReply(`นับและบันทึกรีวิวใหม่เรียบร้อย: ${count} ข้อความ`);
      } else {
        const found = await refreshLatest(channel);
        await interaction.editReply(found ? "รีเฟรชรีวิวล่าสุดเรียบร้อย" : "ไม่พบข้อความรีวิวของสมาชิก");
      }
    };

    const onInteraction = (interaction: Interaction) => {
      if (!interaction.isChatInputCommand()) return;
      void handleCommand(interaction).catch(async (error) => {
        console.error(`Review Credit command failed for bot ${context.botId}:`, error);
        const content = `ทำรายการไม่สำเร็จ: ${errorMessage(error)}`;
        if (interaction.deferred || interaction.replied) await interaction.editReply(content).catch(() => undefined);
        else await interaction.reply({ content, flags: MessageFlags.Ephemeral }).catch(() => undefined);
      });
    };

    const onReady = async () => {
      if (stopped) return;
      const command = await context.client.application?.commands.create(
        new SlashCommandBuilder()
          .setName(commandName)
          .setDescription("จัดการระบบนับเครดิตรีวิว")
          .addSubcommand((subcommand) => subcommand.setName("recount").setDescription("นับข้อความรีวิวใหม่ทั้งหมด"))
          .addSubcommand((subcommand) => subcommand.setName("refresh").setDescription("รีเฟรช reaction และคำตอบของรีวิวล่าสุด"))
          .toJSON(),
      );
      registeredCommandId = command?.id;
      const channel = await resolveChannel();
      if (!state.initialized) await recount(channel);
      else scheduleRename(channel);
      console.info(`Review Credit active: bot ${context.botId}, channel ${channelId}, count ${state.count}`);
    };

    context.client.on("messageCreate", enqueueReview);
    context.client.on("interactionCreate", onInteraction);
    context.client.once("clientReady", () => void onReady().catch(logError(context, "startup")));

    return async () => {
      stopped = true;
      context.client.off("messageCreate", enqueueReview);
      context.client.off("interactionCreate", onInteraction);
      if (renameTimer) clearTimeout(renameTimer);
      await queue;
      // Keep the global command across ordinary Runner restarts to avoid Discord
      // propagation gaps. A later command reconciler owns removal on uninstall.
      void registeredCommandId;
    };
  },
};

function readState(value: Readonly<Record<string, unknown>>, channelId: string): ReviewState {
  return {
    channelId,
    count: value.channelId === channelId && Number.isSafeInteger(value.count) ? Number(value.count) : 0,
    lastReplyId: value.channelId === channelId && typeof value.lastReplyId === "string" ? value.lastReplyId : null,
    initialized: value.channelId === channelId && value.initialized === true,
  };
}

function readCommandName(value: unknown): string {
  const name = typeof value === "string" ? value.trim().toLowerCase() : DEFAULT_COMMAND_NAME;
  if (!COMMAND_NAME_PATTERN.test(name)) throw new Error("REVIEW_COMMAND_NAME is invalid");
  return name;
}

function readTemplate(value: unknown): string {
  const template = typeof value === "string" ? value.trim() : DEFAULT_CHANNEL_TEMPLATE;
  if (!template.includes("{count}") || template.length > 90) {
    throw new Error("REVIEW_CHANNEL_NAME_TEMPLATE must contain {count} and use at most 90 characters");
  }
  return template;
}

function readStringList(value: unknown, maxItems: number, maxLength: number): string[] {
  const list = Array.isArray(value) ? value : typeof value === "string" ? [value] : [];
  const strings = list.map((item) => typeof item === "string" ? item.trim() : "").filter(Boolean);
  if (strings.length > maxItems || strings.some((item) => item.length > maxLength)) {
    throw new Error("Review Credit string-list configuration exceeds its limit");
  }
  return strings;
}

function requiredSnowflake(value: unknown, key: string): string {
  const snowflake = optionalSnowflake(value, key);
  if (!snowflake) throw new Error(`${key} is required`);
  return snowflake;
}

function optionalSnowflake(value: unknown, key: string): string | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "string" || !/^\d{15,30}$/.test(value)) throw new Error(`${key} is invalid`);
  return value;
}

function readBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function logError(context: FeatureContext, operation: string): (error: unknown) => void {
  return (error) => console.error(`Review Credit ${operation} failed for bot ${context.botId}: ${errorMessage(error)}`);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message.slice(0, 300) : "Unknown error";
}
