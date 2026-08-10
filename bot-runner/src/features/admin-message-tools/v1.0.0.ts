import {
  ActionRowBuilder,
  ChannelType,
  type ChatInputCommandInteraction,
  type GuildTextBasedChannel,
  type Interaction,
  MessageFlags,
  ModalBuilder,
  type ModalSubmitInteraction,
  PermissionFlagsBits,
  SlashCommandBuilder,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";
import type { FeatureContext, FeatureModule } from "../../types.js";

const PENDING_TTL_MS = 10 * 60 * 1_000;
const DM_MODAL_PREFIX = "admin-message-tools:dm:";
const SEND_MODAL_PREFIX = "admin-message-tools:send:";
const EDIT_MODAL_PREFIX = "admin-message-tools:edit:";
const MESSAGE_CHANNEL_TYPES = [
  ChannelType.GuildText,
  ChannelType.GuildAnnouncement,
  ChannelType.PublicThread,
  ChannelType.PrivateThread,
  ChannelType.AnnouncementThread,
] as const;

interface PendingSend {
  channelId: string;
  guildId: string;
  attachment: { url: string; name: string } | null;
  expiresAt: number;
}

export const adminMessageToolsFeature: FeatureModule = {
  runtimeKey: "admin-message-tools",
  version: "1.0.0",
  intents: ["Guilds"],
  async activate(context) {
    const pendingSends = new Map<string, PendingSend>();
    let cleanupTimer: NodeJS.Timeout | undefined;
    let stopped = false;

    const replyError = async (interaction: ChatInputCommandInteraction | ModalSubmitInteraction, error: unknown) => {
      const content = `ทำรายการไม่สำเร็จ: ${errorMessage(error)}`;
      if (interaction.deferred || interaction.replied) await interaction.editReply(content).catch(() => undefined);
      else await interaction.reply({ content, flags: MessageFlags.Ephemeral }).catch(() => undefined);
    };

    const handleDm = async (interaction: ChatInputCommandInteraction) => {
      if (!isAllowedGuild(context, interaction) || interaction.commandName !== "dm") return;
      if (!context.permissions.canUse(interaction, "dm", hasPermission(interaction, PermissionFlagsBits.Administrator))) {
        await ephemeral(interaction, "คุณไม่มีสิทธิ์ใช้คำสั่งนี้");
        return;
      }
      if (!configBoolean(context.config.ADMIN_TOOLS_DM_ENABLED, true)) {
        await ephemeral(interaction, "ผู้ดูแลบอทปิดการส่ง DM ไว้");
        return;
      }
      const target = interaction.options.getUser("user", true);
      if (target.bot) {
        await ephemeral(interaction, "ไม่สามารถส่ง DM ไปยังบัญชีบอทได้");
        return;
      }
      await interaction.showModal(new ModalBuilder()
        .setCustomId(`${DM_MODAL_PREFIX}${target.id}`)
        .setTitle(truncate(`ส่ง DM ถึง ${target.username}`, 45))
        .addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId("content")
            .setLabel("ข้อความที่ต้องการส่ง")
            .setPlaceholder("สูงสุด 2,000 ตัวอักษร")
            .setStyle(TextInputStyle.Paragraph)
            .setMaxLength(2_000)
            .setRequired(true),
        )));
    };

    const handleMessage = async (interaction: ChatInputCommandInteraction) => {
      if (!isAllowedGuild(context, interaction) || interaction.commandName !== "message") return;
      const action = interaction.options.getSubcommand();
      if (!context.permissions.canUse(interaction, `message/${action}`, hasPermission(interaction, PermissionFlagsBits.ManageMessages))) {
        await ephemeral(interaction, "คุณไม่มีสิทธิ์ใช้คำสั่งนี้");
        return;
      }
      if (action === "edit" && !configBoolean(context.config.ADMIN_TOOLS_EDIT_ENABLED, true)) {
        await ephemeral(interaction, "ผู้ดูแลบอทปิดการแก้ไขข้อความไว้");
        return;
      }
      if (action !== "edit" && !configBoolean(context.config.ADMIN_TOOLS_SEND_ENABLED, true)) {
        await ephemeral(interaction, "ผู้ดูแลบอทปิดการส่งข้อความไว้");
        return;
      }
      if (action === "send") {
        const channel = interaction.options.getChannel("channel", true, MESSAGE_CHANNEL_TYPES);
        if (!belongsToGuild(channel, interaction.guildId)) {
          await ephemeral(interaction, "เลือกได้เฉพาะห้องในเซิร์ฟเวอร์นี้");
          return;
        }
        const attachment = interaction.options.getAttachment("file");
        pendingSends.set(interaction.id, {
          channelId: channel.id,
          guildId: interaction.guildId,
          attachment: attachment ? { url: attachment.url, name: attachment.name } : null,
          expiresAt: Date.now() + PENDING_TTL_MS,
        });
        await interaction.showModal(messageModal(`${SEND_MODAL_PREFIX}${interaction.id}`, "ส่งข้อความ", "ข้อความที่ต้องการส่ง"));
        return;
      }

      if (action === "sendfile") {
        if (!configBoolean(context.config.ADMIN_TOOLS_FILES_ENABLED, true)) {
          await ephemeral(interaction, "ผู้ดูแลบอทปิดการส่งไฟล์ไว้");
          return;
        }
        const channel = interaction.options.getChannel("channel", true, MESSAGE_CHANNEL_TYPES);
        if (!belongsToGuild(channel, interaction.guildId) || !isSendable(channel)) {
          await ephemeral(interaction, "ห้องนี้ไม่รองรับการส่งไฟล์");
          return;
        }
        const attachment = interaction.options.getAttachment("file", true);
        const caption = interaction.options.getString("caption")?.trim() || undefined;
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const sent = await channel.send({
          ...(caption ? { content: caption } : {}),
          files: [{ attachment: attachment.url, name: attachment.name }],
        });
        await interaction.editReply(receipt(context, "ส่งไฟล์", `<#${channel.id}>`, sent.url));
        return;
      }

      const messageId = interaction.options.getString("message-id", true).trim();
      if (!/^\d{15,30}$/.test(messageId) || !interaction.channel || !interaction.channel.isTextBased()) {
        await ephemeral(interaction, "Message ID ไม่ถูกต้อง หรือห้องปัจจุบันไม่รองรับข้อความ");
        return;
      }
      const message = await interaction.channel.messages.fetch(messageId).catch(() => null);
      if (!message) {
        await ephemeral(interaction, "ไม่พบข้อความนี้ในห้องปัจจุบัน");
        return;
      }
      if (message.author.id !== context.client.user?.id) {
        await ephemeral(interaction, "แก้ไขได้เฉพาะข้อความที่บอทนี้เป็นผู้ส่ง");
        return;
      }
      await interaction.showModal(messageModal(
        `${EDIT_MODAL_PREFIX}${message.id}`,
        "แก้ไขข้อความ",
        "ข้อความใหม่",
        message.content,
      ));
    };

    const handleModal = async (interaction: ModalSubmitInteraction) => {
      if (!isAllowedGuild(context, interaction)) return;
      if (interaction.customId.startsWith(DM_MODAL_PREFIX)) {
        if (!context.permissions.canUse(interaction, "dm", hasPermission(interaction, PermissionFlagsBits.Administrator))) {
          await ephemeral(interaction, "สิทธิ์ผู้ดูแลเซิร์ฟเวอร์ของคุณไม่เพียงพอ");
          return;
        }
        const targetId = interaction.customId.slice(DM_MODAL_PREFIX.length);
        const content = requiredContent(interaction);
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const target = await context.client.users.fetch(targetId).catch(() => null);
        if (!target || target.bot) {
          await interaction.editReply("ไม่พบผู้ใช้ปลายทาง หรือปลายทางเป็นบัญชีบอท");
          return;
        }
        await target.send({ content });
        await interaction.editReply(`ส่ง DM ถึง <@${target.id}> เรียบร้อย`);
        return;
      }

      if (interaction.customId.startsWith(SEND_MODAL_PREFIX)) {
        if (!context.permissions.canUse(interaction, "message/send", hasPermission(interaction, PermissionFlagsBits.ManageMessages))) {
          await ephemeral(interaction, "สิทธิ์จัดการข้อความของคุณไม่เพียงพอ");
          return;
        }
        const token = interaction.customId.slice(SEND_MODAL_PREFIX.length);
        const pending = pendingSends.get(token);
        pendingSends.delete(token);
        if (!pending || pending.expiresAt < Date.now() || pending.guildId !== interaction.guildId) {
          await ephemeral(interaction, "คำขอนี้หมดอายุแล้ว กรุณาเริ่มใหม่");
          return;
        }
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const channel = await context.client.channels.fetch(pending.channelId).catch(() => null);
        if (!isSendable(channel) || channel.guildId !== interaction.guildId) {
          await interaction.editReply("ไม่พบห้องปลายทาง หรือบอทไม่มีสิทธิ์ส่งข้อความ");
          return;
        }
        const sent = await channel.send({
          content: requiredContent(interaction),
          ...(pending.attachment ? { files: [{ attachment: pending.attachment.url, name: pending.attachment.name }] } : {}),
        });
        await interaction.editReply(receipt(context, "ส่งข้อความ", `<#${channel.id}>`, sent.url));
        return;
      }

      if (interaction.customId.startsWith(EDIT_MODAL_PREFIX)) {
        if (!context.permissions.canUse(interaction, "message/edit", hasPermission(interaction, PermissionFlagsBits.ManageMessages))) {
          await ephemeral(interaction, "สิทธิ์จัดการข้อความของคุณไม่เพียงพอ");
          return;
        }
        const messageId = interaction.customId.slice(EDIT_MODAL_PREFIX.length);
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const channel = interaction.channel;
        const message = channel?.isTextBased() ? await channel.messages.fetch(messageId).catch(() => null) : null;
        if (!message || message.author.id !== context.client.user?.id) {
          await interaction.editReply("ไม่พบข้อความ หรือข้อความนี้ไม่ได้ส่งโดยบอทนี้");
          return;
        }
        await message.edit({ content: requiredContent(interaction) });
        await interaction.editReply(receipt(context, "แก้ไขข้อความ", `<#${message.channelId}>`, message.url));
      }
    };

    const onInteraction = (interaction: Interaction) => {
      const task = interaction.isChatInputCommand()
        ? (interaction.commandName === "dm" ? handleDm(interaction) : handleMessage(interaction))
        : interaction.isModalSubmit() ? handleModal(interaction) : null;
      if (task) void task.catch((error) => replyError(interaction as ChatInputCommandInteraction | ModalSubmitInteraction, error));
    };

    context.client.on("interactionCreate", onInteraction);
    context.client.once("clientReady", () => {
      if (stopped) return;
      void registerCommands(context).catch((error) => {
        console.error(`Admin Message Tools startup failed for bot ${context.botId}: ${errorMessage(error)}`);
        void context.reportFeatureError("COMMAND_REGISTRATION_FAILED", error);
      });
    });
    cleanupTimer = setInterval(() => {
      const now = Date.now();
      for (const [token, pending] of pendingSends) if (pending.expiresAt < now) pendingSends.delete(token);
    }, 60_000);
    cleanupTimer.unref();

    return () => {
      stopped = true;
      context.client.off("interactionCreate", onInteraction);
      if (cleanupTimer) clearInterval(cleanupTimer);
      pendingSends.clear();
    };
  },
};

async function registerCommands(context: FeatureContext): Promise<void> {
  if (!context.guildId) throw new Error("Discord guild ID is not configured");
  const guild = await context.client.guilds.fetch(context.guildId);
  await guild.commands.create(new SlashCommandBuilder()
    .setName("dm")
    .setDescription("ส่งข้อความส่วนตัวถึงสมาชิกผ่านบอท")
    .addUserOption((option) => option.setName("user").setDescription("สมาชิกที่ต้องการส่ง DM").setRequired(true))
    .toJSON());
  await guild.commands.create(new SlashCommandBuilder()
    .setName("message")
    .setDescription("ส่งไฟล์ ส่งข้อความ หรือแก้ไขข้อความของบอท")
    .addSubcommand((subcommand) => subcommand.setName("send").setDescription("ส่งข้อความไปยังห้องที่เลือก")
      .addChannelOption((option) => option.setName("channel").setDescription("ห้องปลายทาง").addChannelTypes(...MESSAGE_CHANNEL_TYPES).setRequired(true))
      .addAttachmentOption((option) => option.setName("file").setDescription("ไฟล์แนบ (ไม่บังคับ)")))
    .addSubcommand((subcommand) => subcommand.setName("sendfile").setDescription("ส่งไฟล์ไปยังห้องที่เลือก")
      .addChannelOption((option) => option.setName("channel").setDescription("ห้องปลายทาง").addChannelTypes(...MESSAGE_CHANNEL_TYPES).setRequired(true))
      .addAttachmentOption((option) => option.setName("file").setDescription("ไฟล์ที่ต้องการส่ง").setRequired(true))
      .addStringOption((option) => option.setName("caption").setDescription("ข้อความประกอบไฟล์").setMaxLength(2_000)))
    .addSubcommand((subcommand) => subcommand.setName("edit").setDescription("แก้ไขข้อความที่บอทส่งในห้องปัจจุบัน")
      .addStringOption((option) => option.setName("message-id").setDescription("Message ID ที่ต้องการแก้ไข").setRequired(true)))
    .toJSON());
}

function messageModal(customId: string, title: string, label: string, initial = ""): ModalBuilder {
  const input = new TextInputBuilder().setCustomId("content").setLabel(label).setStyle(TextInputStyle.Paragraph)
    .setMaxLength(2_000).setRequired(true);
  if (initial) input.setValue(initial.slice(0, 2_000));
  return new ModalBuilder().setCustomId(customId).setTitle(title)
    .addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(input));
}

function requiredContent(interaction: ModalSubmitInteraction): string {
  const content = interaction.fields.getTextInputValue("content").trim();
  if (!content) throw new Error("กรุณากรอกข้อความก่อนส่ง");
  return content.slice(0, 2_000);
}

function isAllowedGuild(context: FeatureContext, interaction: ChatInputCommandInteraction | ModalSubmitInteraction): interaction is typeof interaction & { guildId: string } {
  return interaction.inGuild() && (!context.guildId || interaction.guildId === context.guildId);
}

function hasPermission(interaction: ChatInputCommandInteraction | ModalSubmitInteraction, permission: bigint): boolean {
  return interaction.memberPermissions?.has(permission) === true;
}

function isSendable(channel: unknown): channel is GuildTextBasedChannel {
  return !!channel && typeof channel === "object" && "isTextBased" in channel
    && typeof channel.isTextBased === "function" && channel.isTextBased()
    && "send" in channel && typeof channel.send === "function" && "guildId" in channel;
}

function belongsToGuild(channel: unknown, guildId: string): boolean {
  // Resolved interaction channel data can be an API object without guildId;
  // Discord only resolves channel options from the interaction's own guild.
  return !channel || typeof channel !== "object" || !("guildId" in channel) || channel.guildId === guildId;
}

async function ephemeral(interaction: ChatInputCommandInteraction | ModalSubmitInteraction, content: string): Promise<void> {
  await interaction.reply({ content, flags: MessageFlags.Ephemeral });
}

function truncate(value: string, maxLength: number): string {
  return value.length <= maxLength ? value : `${value.slice(0, maxLength - 1)}…`;
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    if (/Cannot send messages to this user/i.test(error.message)) return "ส่ง DM ไม่ได้ ผู้รับอาจปิด DM หรือบล็อกบอทไว้";
    return error.message.slice(0, 300);
  }
  return "เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ";
}

function configBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function receipt(context:FeatureContext,action:string,target:string,messageUrl:string):never {
  const values={action,target,message_url:messageUrl};
  const raw=context.presentations.delivery_receipt;
  if(raw&&typeof raw==="object"&&!Array.isArray(raw)&&Array.isArray((raw as Record<string,unknown>).embeds)){
    return {embeds:deepReceipt((raw as Record<string,unknown>).embeds,values)} as never;
  }
  return {content:`${action}สำเร็จ: ${messageUrl}`} as never;
}
function deepReceipt(value:unknown,values:Record<string,string>):unknown {if(typeof value==="string")return value.replace(/\{\{([a-z0-9_]+)}}/gi,(_,key:string)=>values[key]??"");if(Array.isArray(value))return value.map(item=>deepReceipt(item,values));if(value&&typeof value==="object")return Object.fromEntries(Object.entries(value).map(([key,item])=>[key,deepReceipt(item,values)]));return value;}
