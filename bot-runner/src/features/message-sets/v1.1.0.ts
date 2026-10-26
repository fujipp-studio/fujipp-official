import {
  MessageFlags,
  SlashCommandBuilder,
  type Interaction,
} from "discord.js";
import type {
  FeatureContext,
  FeatureDisposer,
  FeatureModule,
} from "../../types.js";
import { replyFeatureError } from "../errors.js";
import { PresentationValidationError, renderTemplate } from "../presentation.js";

export interface MessageSet {
  name: string;
  presentationSlot: string;
}

export function readMessageSets(value: unknown): MessageSet[] {
  if (!Array.isArray(value) || value.length > 20)
    throw new Error("Message Sets must contain at most 20 SETs");
  const names = new Set<string>(),
    slots = new Set<string>();
  return value.map((row) => {
    const name = typeof row?.name === "string" ? row.name.trim() : "";
    const presentationSlot =
      typeof row?.presentationSlot === "string" ? row.presentationSlot : "";
    if (
      !name ||
      name.length > 100 ||
      !/^set_(?:[1-9]|1\d|20)$/.test(presentationSlot) ||
      names.has(name.toLowerCase()) ||
      slots.has(presentationSlot)
    ) {
      throw new Error(
        "SET names and presentation slots must be valid and unique",
      );
    }
    names.add(name.toLowerCase());
    slots.add(presentationSlot);
    return { name, presentationSlot };
  });
}

function commandName(value: unknown): string {
  const name = typeof value === "string" ? value.trim() : "ec";
  if (!/^[a-z0-9_-]{1,32}$/.test(name))
    throw new Error("Invalid Message Sets command name");
  return name;
}

export const messageSetsFeatureV11: FeatureModule = {
  runtimeKey: "message-sets",
  version: "1.1.0",
  intents: ["Guilds"],
  supportsHotReload: true,
  async activate(context) {
    let sets = readMessageSets(context.config.MESSAGE_SETS ?? []);
    let name = commandName(context.config.MESSAGE_SETS_COMMAND_NAME);
    let presentationContext: FeatureContext = context;
    let stopped = false;
    let registered: { id: string; name: string } | undefined =
      typeof context.runtimeState.commandId === "string" &&
      typeof context.runtimeState.commandName === "string"
        ? {
            id: context.runtimeState.commandId,
            name: context.runtimeState.commandName,
          }
        : undefined;
    let registrationQueue = Promise.resolve();
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    const register = (nextName: string): Promise<void> => {
      registrationQueue = registrationQueue
        .catch(() => undefined)
        .then(async () => {
          if (stopped) return;
          const commands = context.client.application?.commands;
          if (!commands) throw new Error("Discord application is unavailable");
          const existing = (await commands.fetch()).find(
            (command) => command.name === nextName,
          );
          if (existing && existing.id !== registered?.id) {
            throw new Error(
              `Command /${nextName} is already owned by another feature`,
            );
          }
          // Create the replacement before removing the command owned by this feature.
          const command = await commands.create(
            new SlashCommandBuilder()
              .setName(nextName)
              .setDescription("ส่งข้อความจาก SET ที่ออกแบบไว้บนเว็บไซต์")
              .addSubcommand((command) => command
                .setName("send")
                .setDescription("ส่งข้อความจาก SET")
                .addStringOption((option) => option.setName("set").setDescription("เลือกชื่อ SET").setRequired(true).setAutocomplete(true).setMaxLength(100)))
              .addSubcommand((command) => command
                .setName("update")
                .setDescription("อัปเดตข้อความเดิมของบอทในห้องนี้จาก SET")
                .addStringOption((option) => option.setName("message_id").setDescription("ID ข้อความของบอทในห้องนี้").setRequired(true).setMinLength(17).setMaxLength(20))
                .addStringOption((option) => option.setName("set").setDescription("เลือกชื่อ SET").setRequired(true).setAutocomplete(true).setMaxLength(100)))
              .toJSON(),
          );
          const previous = registered;
          if (previous && previous.name !== nextName) {
            await commands.delete(previous.id).catch((error: unknown) => {
              if ((error as { code?: number })?.code !== 10063) throw error; // Already removed command.
            });
          }
          registered = { id: command.id, name: nextName };
          await context.saveRuntimeState({
            ...context.runtimeState,
            commandId: command.id,
            commandName: nextName,
          });
        });
      return registrationQueue;
    };
    const handle = async (interaction: Interaction) => {
      if (
        (!interaction.isAutocomplete() && !interaction.isChatInputCommand()) ||
        interaction.commandName !== name
      )
        return;
      if (
        !interaction.inGuild() ||
        (context.guildId && interaction.guildId !== context.guildId)
      )
        return;
      if (interaction.isAutocomplete()) {
        const search = interaction.options.getFocused().toLowerCase();
        await interaction.respond(
          sets
            .filter((set) => set.name.toLowerCase().includes(search))
            .map((set) => ({ name: set.name, value: set.name })),
        );
        return;
      }
      const action = interaction.options.getSubcommand();
      if (!context.permissions.canUse(interaction, `${name}/${action}`, false)) {
        await replyFeatureError(interaction, "message-sets", "คุณไม่มีสิทธิ์ใช้คำสั่งนี้", { code: "COMMAND_PERMISSION_DENIED" });
        return;
      }
      const selected = interaction.options
        .getString("set", true)
        .trim()
        .toLowerCase();
      const set = sets.find((item) => item.name.toLowerCase() === selected);
      if (!set) {
        await replyFeatureError(interaction, "message-sets", "ไม่พบ SET นี้ กรุณาเลือกจากรายการล่าสุด", { code: "MESSAGE_SET_NOT_FOUND" });
        return;
      }
      const payload = renderTemplate(
        presentationContext,
        set.presentationSlot,
        {
          set_name: set.name,
          user: `<@${interaction.user.id}>`,
          user_name: interaction.user.displayName,
          channel: `<#${interaction.channelId}>`,
          guild_name: interaction.guild?.name ?? "",
        },
      );
      const channel = interaction.channel;
      if (!channel?.isSendable()) {
        throw new Error(
          "The command channel is unavailable or cannot receive messages",
        );
      }
      // Keep interaction attribution private; the SET is an ordinary bot message.
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      if (action === "update") {
        const messageId = interaction.options.getString("message_id", true).trim();
        if (!/^[0-9]{17,20}$/.test(messageId)) throw new Error("Invalid message ID");
        const message = await channel.messages.fetch(messageId);
        if (message.author.id !== context.client.user?.id || message.webhookId)
          throw new Error("Only messages sent by this bot can be updated");
        const componentsV2 = payload.flags === MessageFlags.IsComponentsV2;
        if (message.flags.has(MessageFlags.IsComponentsV2) && !componentsV2) {
          await replyFeatureError(interaction, "message-sets", "ข้อความ Components V2 ต้องเลือก SET แบบ Components V2", { code: "COMPONENTS_V2_REQUIRED" });
          return;
        }
        await message.edit({ content: null, embeds: [], components: [], attachments: [], ...payload });
      } else {
        await channel.send(payload);
      }
      await interaction
        .editReply({ content: action === "update" ? "อัปเดตข้อความจาก SET แล้ว" : "ส่ง SET แล้ว", allowedMentions: { parse: [] } })
        .catch((error) =>
          context
            .reportFeatureError("MESSAGE_SET_ACK_FAILED", error, { recoverable: true })
            .catch(() => undefined),
        );
    };
    const onInteraction = (interaction: Interaction) => {
      void handle(interaction)
        .catch(async (error) => {
          if (
            interaction.isChatInputCommand() &&
            interaction.commandName === name
          ) {
            const content = error instanceof PresentationValidationError
              ? `ส่งหรืออัปเดต SET ไม่สำเร็จ: ${error.message}`
              : "ส่งหรืออัปเดต SET ไม่สำเร็จ กรุณาตรวจสอบ message ID ในห้องนี้ ข้อความต้องเป็นของบอทตัวนี้ และตรวจสอบดีไซน์และสิทธิ์ของบอท";
            await replyFeatureError(interaction, "message-sets", content, { code: "MESSAGE_SET_SEND_FAILED" });
          }
          // A failed message must not remove the command listener on the next bootstrap.
          // Acknowledge the user before waiting for the diagnostic API.
          await context
            .reportFeatureError("MESSAGE_SET_SEND_FAILED", error, { recoverable: true })
            .catch(() => undefined);
        })
        .catch(() => undefined);
    };
    const onReady = () => {
      if (!stopped)
        void register(name).catch(async (error) => {
          await context
            .reportFeatureError("MESSAGE_SET_COMMAND_FAILED", error)
            .catch(() => undefined);
          if (!stopped) retryTimer = setTimeout(onReady, 30_000);
        });
    };
    context.client.on("interactionCreate", onInteraction);
    context.client.once("clientReady", onReady);
    const dispose: FeatureDisposer = async () => {
      stopped = true;
      clearTimeout(retryTimer);
      context.client.off("interactionCreate", onInteraction);
      context.client.off("clientReady", onReady);
      await registrationQueue.catch(() => undefined);
    };
    dispose.update = async (feature) => {
      const nextSets = readMessageSets(feature.config.MESSAGE_SETS ?? []);
      const nextName = commandName(feature.config.MESSAGE_SETS_COMMAND_NAME);
      if (nextName !== name && context.client.isReady())
        await register(nextName);
      sets = nextSets;
      name = nextName;
      presentationContext = {
        ...context,
        config: feature.config,
        presentations: feature.presentations,
      };
    };
    if (context.client.isReady()) {
      try {
        await register(name);
      } catch (error) {
        await dispose();
        throw error;
      }
    }
    return dispose;
  },
};
