import {
  ChannelType,
  type ChatInputCommandInteraction,
  type Interaction,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from "discord.js";
import {
  entersState,
  getVoiceConnection,
  joinVoiceChannel,
  VoiceConnectionStatus,
  type VoiceConnection,
} from "@discordjs/voice";
import type { FeatureContext, FeatureModule } from "../../types.js";

const DEFAULT_COMMAND_NAME = "voice";
const COMMAND_NAME_PATTERN = /^[a-z0-9_-]{1,32}$/;

export const voiceKeeperFeature: FeatureModule = {
  runtimeKey: "voice-keeper",
  version: "1.0.0",
  intents: ["Guilds", "GuildVoiceStates"],
  async activate(context) {
    const commandName = readCommandName(context.config.COMMAND_NAME);
    const selfMute = readBoolean(context.config.SELF_MUTE, true);
    const selfDeaf = readBoolean(context.config.SELF_DEAF, true);
    let connection: VoiceConnection | undefined;
    let stopped = false;

    const connect = async (channelId: string): Promise<void> => {
      if (!context.guildId) throw new Error("Discord guild ID is not configured");
      const guild = await context.client.guilds.fetch(context.guildId);
      const channel = await guild.channels.fetch(channelId);
      if (!channel || (channel.type !== ChannelType.GuildVoice && channel.type !== ChannelType.GuildStageVoice)) {
        throw new Error("Voice channel was not found in the configured guild");
      }
      const me = guild.members.me ?? await guild.members.fetchMe();
      const permissions = channel.permissionsFor(me);
      if (!permissions.has(PermissionFlagsBits.ViewChannel) || !permissions.has(PermissionFlagsBits.Connect)) {
        throw new Error("Bot requires View Channel and Connect permissions");
      }

      getVoiceConnection(guild.id)?.destroy();
      connection = joinVoiceChannel({
        channelId: channel.id,
        guildId: guild.id,
        adapterCreator: guild.voiceAdapterCreator,
        selfMute,
        selfDeaf,
      });
      await entersState(connection, VoiceConnectionStatus.Ready, 20_000);
      console.info(`Voice keeper connected: bot ${context.botId}, channel ${channel.id}`);
    };

    const handleCommand = async (interaction: ChatInputCommandInteraction) => {
      if (!interaction.inGuild() || interaction.commandName !== commandName) return;
      if (context.guildId && interaction.guildId !== context.guildId) return;
      if (!context.permissions.canUse(interaction, `${commandName}/${interaction.options.getSubcommand()}`, false)) {
        await interaction.reply({ content: "คุณไม่มีสิทธิ์ใช้คำสั่งนี้", flags: MessageFlags.Ephemeral });
        return;
      }

      const action = interaction.options.getSubcommand();
      if (action === "leave") {
        getVoiceConnection(interaction.guildId)?.destroy();
        connection = undefined;
        await context.saveRuntimeState({ channelId: null });
        await interaction.reply({ content: "ออกจากห้องเสียงและปิดการเชื่อมต่ออัตโนมัติแล้ว", flags: MessageFlags.Ephemeral });
        return;
      }

      const channel = interaction.options.getChannel("channel", true, [
        ChannelType.GuildVoice,
        ChannelType.GuildStageVoice,
      ]);
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      try {
        await connect(channel.id);
        await context.saveRuntimeState({ channelId: channel.id });
        await interaction.editReply(`เชื่อมต่อ <#${channel.id}> แล้ว และจะกลับเข้าห้องนี้อัตโนมัติหลัง Restart`);
      } catch (error) {
        connection?.destroy();
        connection = undefined;
        await interaction.editReply(`เชื่อมต่อไม่สำเร็จ: ${errorMessage(error)}`);
      }
    };

    const onInteraction = (interaction: Interaction) => {
      if (!interaction.isChatInputCommand()) return;
      void handleCommand(interaction).catch((error) => {
        console.error(`Voice keeper command failed for bot ${context.botId}: ${errorMessage(error)}`);
      });
    };

    context.client.on("interactionCreate", onInteraction);
    context.client.once("clientReady", async () => {
      if (stopped || !context.guildId) return;
      try {
        const application = context.client.application;
        if (!application) throw new Error("Discord application is unavailable after client ready");
        await application.commands.create(
          new SlashCommandBuilder()
            .setName(commandName)
            .setDescription("จัดการการออนไลน์ในห้องเสียงตลอด 24 ชั่วโมง")
            .addSubcommand((subcommand) => subcommand
              .setName("join")
              .setDescription("เลือกห้องเสียงที่ต้องการให้บอทออนไลน์")
              .addChannelOption((option) => option
                .setName("channel")
                .setDescription("เลือกห้องเสียง")
                .addChannelTypes(ChannelType.GuildVoice, ChannelType.GuildStageVoice)
                .setRequired(true)))
            .addSubcommand((subcommand) => subcommand
              .setName("leave")
              .setDescription("ออกจากห้องเสียงและไม่กลับเข้าอัตโนมัติ"))
            .toJSON(),
        );

        const savedChannelId = context.runtimeState.channelId;
        if (typeof savedChannelId === "string" && savedChannelId.length > 0) {
          await connect(savedChannelId);
        }
      } catch (error) {
        console.error(`Voice keeper startup failed for bot ${context.botId}: ${errorMessage(error)}`);
      }
    });

    return async () => {
      stopped = true;
      context.client.off("interactionCreate", onInteraction);
      connection?.destroy();
      // Keep the global command across ordinary Runner restarts to avoid a
      // propagation gap. A command reconciler should own removal on uninstall.
    };
  },
};

function readCommandName(value: unknown): string {
  const commandName = typeof value === "string" ? value.trim().toLowerCase() : DEFAULT_COMMAND_NAME;
  if (!COMMAND_NAME_PATTERN.test(commandName)) {
    throw new Error("COMMAND_NAME must contain 1-32 lowercase letters, numbers, _ or -");
  }
  return commandName;
}

function readBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message.slice(0, 300) : "Unknown error";
}
