import {
  ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, MessageFlags,
  ModalBuilder, LabelBuilder, PermissionFlagsBits, SlashCommandBuilder, StringSelectMenuBuilder,
  TextInputBuilder, TextInputStyle, escapeMarkdown,
  type Interaction, type TextChannel, type MessageCreateOptions,
  type ModalSubmitInteraction, type StringSelectMenuInteraction, type ButtonInteraction,
  type ChatInputCommandInteraction,
} from "discord.js";
import type { FeatureContext, FeatureModule } from "../../types.js";
import { renderTemplate } from "../presentation.js";
import { ticketTranscript } from "./history.js";
import { replyFeatureError } from "../errors.js";
import { readTicketConfig, readTicketTopic, ticketDue, ticketTopic, type TicketCategory, type TicketState } from "./config.js";

type TicketInteraction = ChatInputCommandInteraction | ModalSubmitInteraction | StringSelectMenuInteraction | ButtonInteraction;

export const ticketFeature: FeatureModule = {
  runtimeKey: "ticket",
  version: "1.0.0",
  intents: ["Guilds"],
  async activate(context) {
    if (!context.guildId) throw new Error("Ticket requires a configured Discord server");
    const config = readTicketConfig(context.config);
    const prefix = `ticket:${context.installationId}:`;
    let stopped = false;
    let queue: Promise<void> = Promise.resolve();
    let registration: Promise<void> = Promise.resolve();
    let commandId: string | undefined;
    let runtimeState = { ...context.runtimeState };
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let sweeping = false;
    const pending = new Set<Promise<unknown>>();
    const exporting = new Set<string>();
    const historyButton = () => new ButtonBuilder().setCustomId(`${prefix}history`).setLabel("อ่านประวัติแชท").setStyle(ButtonStyle.Secondary);
    const report = (code: string, error: unknown) => context.reportFeatureError(code, error, { recoverable: true }).catch(() => undefined);
    const track = (operation: Promise<unknown>) => {
      pending.add(operation);
      void operation.finally(() => pending.delete(operation)).catch(() => undefined);
    };
    const serialize = <T>(work: () => Promise<T>): Promise<T> => {
      const next = queue.then(work);
      queue = next.then(() => undefined, () => undefined);
      return next;
    };
    const guild = () => context.client.guilds.fetch(context.guildId!);
    const categoryFor = (key: string) => {
      const row = config.categories.find((item) => item.key === key);
      if (!row) throw new Error("หัวข้อนี้เปลี่ยนแล้ว กรุณาเลือกหัวข้อจากแผงล่าสุด");
      return row;
    };
    const close = async (channel: TextChannel, state: TicketState, actor: string) => {
      if (state.status === "CLOSED") return;
      // Persist intent first so a restart resumes an interrupted permission change.
      state = { ...state, status: "CLOSING" };
      await channel.setTopic(ticketTopic(context.installationId, state));
      await channel.permissionOverwrites.edit(state.ownerId, {
        SendMessages: false, AddReactions: false, CreatePublicThreads: false,
        CreatePrivateThreads: false, SendMessagesInThreads: false,
      });
      await channel.send({ content: `🔒 ปิดตั๋วแล้ว · ${actor}\nเก็บห้องและประวัติไว้ให้อ่านย้อนหลัง`, allowedMentions: { parse: [] },
        ...(config.discordHistoryEnabled ? { components: [new ActionRowBuilder<ButtonBuilder>().addComponents(historyButton())] } : {}) });
      await channel.setTopic(ticketTopic(context.installationId, { ...state, status: "CLOSED" }));
    };
    const canClose = async (interaction: TicketInteraction, state: TicketState) => {
      if (interaction.user.id === state.ownerId) return true;
      const member = await (await guild()).members.fetch({ user: interaction.user.id, force: true });
      return member.permissions.has(PermissionFlagsBits.Administrator)
        || state.supportRoleIds.some((id) => member.roles.cache.has(id));
    };
    const open = async (interaction: TicketInteraction, category: TicketCategory, answers: Array<{ label: string; value: string }>) => {
      const server = await guild();
      const channels = await server.channels.fetch();
      const existing = channels.find((channel) => {
        if (channel?.type !== ChannelType.GuildText) return false;
        const state = readTicketTopic(context.installationId, channel.topic);
        return state?.ownerId === interaction.user.id && state.categoryKey === category.key && state.status !== "CLOSED";
      });
      if (existing) {
        await interaction.editReply({ content: `คุณมีตั๋วในหัวข้อนี้อยู่แล้ว: <#${existing.id}>`, allowedMentions: { parse: [] } });
        return;
      }
      const parent = channels.get(category.categoryId);
      if (!parent || parent.type !== ChannelType.GuildCategory) throw new Error("ไม่พบหมวดห้อง Discord ของหัวข้อนี้ กรุณาแจ้งผู้ดูแล");
      const me = server.members.me ?? await server.members.fetchMe();
      if (category.supportRoleIds.includes(server.id)) throw new Error("ทีมดูแลต้องไม่ใช้ Role @everyone");
      for (const roleId of category.supportRoleIds) {
        const role = await server.roles.fetch(roleId);
        if (!role || role.id === server.roles.everyone.id) throw new Error(`ไม่พบ Role ทีมดูแล: ${roleId}`);
      }
      if (!parent.permissionsFor(me).has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ManageChannels, PermissionFlagsBits.ManageRoles]))
        throw new Error("บอทต้องมี View Channel, Manage Channels และ Manage Roles ในหมวดที่เลือก");
      const state: TicketState = {
        ownerId: interaction.user.id, categoryKey: category.key, openedAt: Date.now(),
        autoCloseMinutes: category.autoCloseMinutes, autoCloseMode: category.autoCloseMode,
        supportRoleIds: category.supportRoleIds, status: "OPEN",
      };
      const read = [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory];
      const write = [...read, PermissionFlagsBits.SendMessages, PermissionFlagsBits.AttachFiles, PermissionFlagsBits.EmbedLinks];
      const channel = await server.channels.create({
        name: `ticket-${category.key}-${interaction.user.id.slice(-6)}`,
        type: ChannelType.GuildText, parent: parent.id,
        topic: ticketTopic(context.installationId, state),
        permissionOverwrites: [
          { id: server.id, deny: [PermissionFlagsBits.ViewChannel] },
          { id: me.id, allow: [...write, PermissionFlagsBits.ManageChannels, PermissionFlagsBits.ManageRoles] },
          { id: interaction.user.id, allow: write, deny: [PermissionFlagsBits.CreatePublicThreads, PermissionFlagsBits.CreatePrivateThreads] },
          ...category.supportRoleIds.map((id) => ({ id, allow: write })),
        ],
        reason: `Ticket ${category.key} opened by ${interaction.user.id}`,
      });
      try {
        for (const answer of answers) await channel.send({
          flags: MessageFlags.IsComponentsV2,
          components: [{ type: 17, components: [
            { type: 10, content: `**${escapeMarkdown(answer.label)}**\n${escapeMarkdown(answer.value || "—")}` },
          ] }], allowedMentions: { parse: [] },
        });
        const payload = renderTemplate(context, "opened", {
          user: `<@${interaction.user.id}>`, user_name: escapeMarkdown(interaction.user.displayName),
          category: escapeMarkdown(category.label), channel: `<#${channel.id}>`,
          auto_close: category.autoCloseMinutes === 0 ? "ปิดอัตโนมัติ: ไม่เปิดใช้งาน"
            : `${category.autoCloseMinutes} นาที ${category.autoCloseMode === "IDLE" ? "หลังไม่มีข้อความใหม่" : "หลังเปิดตั๋ว"}`,
        });
        await channel.send(withRow(payload, new ActionRowBuilder<ButtonBuilder>().addComponents(
          ...(config.discordHistoryEnabled ? [historyButton()] : []),
          new ButtonBuilder().setCustomId(`${prefix}close`).setLabel("ปิดตั๋ว").setStyle(ButtonStyle.Danger),
        )));
      } catch (error) {
        await report("TICKET_WELCOME_FAILED", error);
        await interaction.editReply({ content: `สร้างตั๋วแล้ว: <#${channel.id}> แต่ส่งรายละเอียดไม่ครบ กรุณาแจ้งทีมดูแล ใช้ /${config.command} close เพื่อปิดตั๋ว`, allowedMentions: { parse: [] } });
        return;
      }
      await interaction.editReply({ content: `เปิดตั๋วแล้ว: <#${channel.id}>`, allowedMentions: { parse: [] } });
    };
    const handle = async (interaction: TicketInteraction) => {
      if (interaction.guildId !== context.guildId || stopped) return;
      if (interaction.isChatInputCommand()) {
        if (interaction.commandName !== config.command || interaction.commandId !== commandId) return;
        if (interaction.options.getSubcommand() === "panel") {
          if (!context.permissions.canUse(interaction, `${config.command}/panel`, false))
            throw new Error("เฉพาะผู้ดูแลหรือผู้ที่ได้รับสิทธิ์เท่านั้นที่ส่งแผง Ticket ได้");
          await interaction.deferReply({ flags: MessageFlags.Ephemeral });
          const channel = await (await guild()).channels.fetch(interaction.channelId);
          if (!channel?.isSendable() || channel.isDMBased()) throw new Error("ไม่พบห้องสำหรับส่งแผง Ticket");
          const menu = new StringSelectMenuBuilder().setCustomId(`${prefix}select`).setPlaceholder("เลือกหัวข้อเพื่อเปิดตั๋ว")
            .addOptions(config.categories.map((row) => ({ label: row.label, value: row.key, ...(row.description ? { description: row.description } : {}) })));
          await channel.send(withRow(renderTemplate(context, "panel", {}), new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu)));
          await interaction.editReply("ส่งแผง Ticket แล้ว");
          return;
        }
      } else {
        if (!interaction.customId.startsWith(prefix)) return;
        if ((interaction.isButton() || interaction.isStringSelectMenu()) && interaction.message.author.id !== context.client.user?.id) return;
        if (interaction.isStringSelectMenu()) {
          if (interaction.customId !== `${prefix}select`) return;
          const category = categoryFor(interaction.values[0] ?? "");
          if (category.formEnabled) {
            const modal = new ModalBuilder().setCustomId(`${prefix}form:${category.key}`).setTitle(category.formTitle);
            for (const field of category.fields) modal.addLabelComponents(new LabelBuilder().setLabel(field.label).setTextInputComponent(
              new TextInputBuilder().setCustomId(field.key)
                .setStyle(field.style === "PARAGRAPH" ? TextInputStyle.Paragraph : TextInputStyle.Short)
                .setRequired(field.required).setMaxLength(1000)
                .setPlaceholder(field.placeholder || field.label),
            ));
            await interaction.showModal(modal);
          } else {
            await interaction.deferReply({ flags: MessageFlags.Ephemeral });
            await serialize(() => open(interaction, category, []));
          }
          return;
        }
        if (interaction.isModalSubmit()) {
          if (!interaction.customId.startsWith(`${prefix}form:`)) return;
          const category = categoryFor(interaction.customId.slice(`${prefix}form:`.length));
          if (!category.formEnabled) throw new Error("แบบฟอร์มเปลี่ยนแล้ว กรุณาเลือกหัวข้ออีกครั้ง");
          const answers = category.fields.map((field) => {
            const value = interaction.fields.getTextInputValue(field.key);
            if (value.length > 1000 || (field.required && !value.trim())) throw new Error("กรุณากรอกข้อมูลที่จำเป็นให้ครบ (ไม่เกิน 1,000 ตัวอักษรต่อช่อง)");
            return { label: field.label, value };
          });
          await interaction.deferReply({ flags: MessageFlags.Ephemeral });
          await serialize(() => open(interaction, category, answers));
          return;
        }
        if (![`${prefix}close`, `${prefix}confirm-close`, `${prefix}history`].includes(interaction.customId)) return;
      }
      const confirming = interaction.isButton() && interaction.customId === `${prefix}confirm-close`;
      if (confirming) await interaction.deferUpdate();
      else await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const channel = await (await guild()).channels.fetch(interaction.channelId!);
      if (!channel || channel.type !== ChannelType.GuildText) throw new Error("คำสั่งนี้ใช้ได้เฉพาะในห้อง Ticket");
      const state = readTicketTopic(context.installationId, channel.topic);
      if (!state) throw new Error("ห้องนี้ไม่ใช่ตั๋วของ Feature นี้");
      const readingHistory = interaction.isChatInputCommand() ? interaction.options.getSubcommand() === "history" : interaction.isButton() && interaction.customId === `${prefix}history`;
      if (readingHistory) {
        if (!config.discordHistoryEnabled) throw new Error("ปิดการอ่านประวัติใน Discord ไว้ สามารถเปิดตัวเลือกนี้บนหน้าเว็บจัดการบอท");
        const member = await (await guild()).members.fetch({ user: interaction.user.id, force: true });
        if (!channel.permissionsFor(member).has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory]) || !await canClose(interaction, state))
          throw new Error("คุณไม่มีสิทธิ์อ่านประวัติของตั๋วนี้");
        const me = (await guild()).members.me ?? await (await guild()).members.fetchMe();
        if (!channel.permissionsFor(me).has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory]))
          throw new Error("บอทต้องมี View Channel และ Read Message History เพื่ออ่านแชท");
        if (exporting.has(channel.id)) throw new Error("กำลังสร้างประวัติของห้องนี้ กรุณารอสักครู่");
        exporting.add(channel.id);
        try {
          const transcript = await ticketTranscript(channel, () => stopped);
          await interaction.editReply({ content: `ประวัติแชท ${transcript.count} ข้อความ${transcript.truncated ? " (ไฟล์บางส่วน อ่านประวัติก่อนหน้าบนเว็บไซต์)" : ""}`,
            files: [{ attachment: transcript.attachment, name: `ticket-${channel.id}.txt` }], allowedMentions: { parse: [] }, components: [] });
        } finally { exporting.delete(channel.id); }
        return;
      }
      if (!await canClose(interaction, state)) throw new Error("เฉพาะผู้เปิดตั๋ว ทีมดูแล หรือ Administrator เท่านั้นที่ปิดตั๋วได้");
      if (state.status === "CLOSED") {
        await interaction.editReply({ content: "ตั๋วนี้ปิดแล้ว", components: [] });
        return;
      }
      if (!confirming) {
        await interaction.editReply({ content: "ยืนยันปิดตั๋วนี้? หลังปิด ผู้เปิดตั๋วจะอ่านประวัติได้แต่ส่งข้อความไม่ได้",
          components: [new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder().setCustomId(`${prefix}confirm-close`).setLabel("ยืนยันปิดตั๋ว").setStyle(ButtonStyle.Danger))] });
        return;
      }
      await serialize(async () => {
        const fresh = await channel.fetch(true);
        const current = readTicketTopic(context.installationId, fresh.topic);
        if (!current) throw new Error("ไม่พบตั๋ว");
        await close(fresh, current, `<@${interaction.user.id}>`);
      });
      await interaction.editReply({ content: "ปิดตั๋วแล้ว", components: [] });
    };
    const sweep = async () => {
      if (stopped || sweeping) return;
      sweeping = true;
      try {
        await serialize(async () => {
          const channels = await (await guild()).channels.fetch();
          for (const channel of channels.values()) {
            if (stopped) break;
            if (channel?.type !== ChannelType.GuildText) continue;
            const state = readTicketTopic(context.installationId, channel.topic);
            if (!state || state.status === "CLOSED") continue;
            try {
              if (state.status === "CLOSING") { await close(channel, state, "ดำเนินการปิดตั๋วต่อหลังรีสตาร์ต"); continue; }
              if (!state.autoCloseMinutes) continue;
              let activity = state.openedAt;
              if (state.autoCloseMode === "IDLE") {
                const messages = await channel.messages.fetch({ limit: 1, cache: false });
                activity = messages.first()?.createdTimestamp ?? activity;
              }
              if (ticketDue(state, activity, Date.now())) await close(channel, state, "หมดเวลาที่กำหนดโดยอัตโนมัติ");
            } catch (error) { await report("TICKET_AUTO_CLOSE_FAILED", error); }
          }
        });
      } catch (error) { await report("TICKET_SCAN_FAILED", error); }
      finally { sweeping = false; }
    };
    const register = async () => {
      const commands = context.client.application?.commands;
      if (!commands) throw new Error("Discord application unavailable");
      const existing = (await commands.fetch()).find((item) => item.name === config.command);
      if (existing && existing.id !== runtimeState.commandId) throw new Error(`Command /${config.command} is owned by another feature`);
      const definition = new SlashCommandBuilder().setName(config.command).setDescription("ระบบ Ticket")
        .setDMPermission(false)
        .addSubcommand((sub) => sub.setName("panel").setDescription("ส่งแผงเลือกหัวข้อเปิดตั๋ว"))
        .addSubcommand((sub) => sub.setName("close").setDescription("ขอปิดตั๋วในห้องนี้"));
      if (config.discordHistoryEnabled) definition.addSubcommand((sub) => sub.setName("history").setDescription("อ่านและดาวน์โหลดประวัติแชทตั๋วนี้"));
      const command = await commands.create(definition.toJSON());
      const old = runtimeState.previousCommandId ?? runtimeState.commandId;
      const next: Record<string, unknown> = { ...runtimeState, commandId: command.id };
      if (typeof old === "string" && old !== command.id) next.previousCommandId = old;
      try { await context.saveRuntimeState(next); }
      catch (error) { if (!existing) await commands.delete(command.id).catch(() => undefined); throw error; }
      runtimeState = next;
      if (typeof old === "string" && old !== command.id) await commands.delete(old).catch((error: unknown) => {
        if ((error as { code?: number })?.code !== 10063) throw error;
      });
      if (runtimeState.previousCommandId) {
        delete runtimeState.previousCommandId;
        await context.saveRuntimeState(runtimeState);
      }
      commandId = command.id;
      await sweep();
    };
    const onReady = () => {
      if (stopped) return;
      registration = register().catch(async (error: unknown) => {
        await report("TICKET_COMMAND_FAILED", error);
        if (!stopped) retryTimer = setTimeout(onReady, 30_000);
      });
    };
    const onInteraction = (interaction: Interaction) => {
      if (!interaction.isChatInputCommand() && !interaction.isStringSelectMenu() && !interaction.isModalSubmit() && !interaction.isButton()) return;
      // Ignore unrelated interactions before handling errors or acknowledgements.
      if (interaction.isChatInputCommand() ? interaction.commandName !== config.command || interaction.commandId !== commandId : !interaction.customId.startsWith(prefix)) return;
      track(handle(interaction).catch(async (error: unknown) => {
        await replyFeatureError(interaction, "ticket", error).catch(() => undefined);
        await report("TICKET_INTERACTION_FAILED", error);
      }));
    };
    const timer = setInterval(() => { if (context.client.isReady()) track(sweep()); }, 60_000);
    context.client.on("interactionCreate", onInteraction);
    context.client.once("clientReady", onReady);
    if (context.client.isReady()) onReady();
    return async () => {
      stopped = true;
      clearInterval(timer); clearTimeout(retryTimer);
      context.client.off("interactionCreate", onInteraction);
      context.client.off("clientReady", onReady);
      await registration;
      await Promise.allSettled(pending);
      await queue;
    };
  },
};

function withRow(payload: Record<string, unknown>, row: ActionRowBuilder<ButtonBuilder | StringSelectMenuBuilder>): MessageCreateOptions {
  return { ...payload, components: [...(Array.isArray(payload.components) ? payload.components : []), row], allowedMentions: { parse: [] } } as MessageCreateOptions;
}
