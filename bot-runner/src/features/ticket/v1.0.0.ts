import {
  ActionRowBuilder, ApplicationFlagsBitField, ButtonBuilder, ButtonStyle, ChannelType, ComponentType, MessageFlags,
  ModalBuilder, LabelBuilder, OverwriteType, PermissionFlagsBits, SlashCommandBuilder, StringSelectMenuBuilder, UserSelectMenuBuilder,
  TextInputBuilder, TextInputStyle, escapeMarkdown,
  type Interaction, type TextChannel, type MessageCreateOptions, type GuildBasedChannel,
  type ModalSubmitInteraction, type StringSelectMenuInteraction, type ButtonInteraction,
  type ChatInputCommandInteraction, type UserSelectMenuInteraction,
} from "discord.js";
import type { FeatureContext, FeatureModule } from "../../types.js";
import { renderTemplate } from "../presentation.js";
import { ticketOpeningMessages } from "./messages.js";
import { sendTicketOpeningMentions } from "./mentions.js";
import { ticketArchive, ticketTranscript } from "./history.js";
import { replyFeatureError } from "../errors.js";
import { readTicketConfig, readTicketTopic, ticketDue, ticketChannelName, ticketActionEnabled, type TicketAction, type TicketCategory, type TicketState } from "./config.js";

type TicketInteraction = ChatInputCommandInteraction | ModalSubmitInteraction | StringSelectMenuInteraction | UserSelectMenuInteraction | ButtonInteraction;

export const ticketFeature: FeatureModule = {
  runtimeKey: "ticket",
  version: "1.0.0",
  intents: ["Guilds"],
  async activate(context) {
    if (!context.guildId) throw new Error("Ticket requires a configured Discord server");
    const config = readTicketConfig(context.config);
    const prefix = `ticket:${context.installationId}:`;
    const enabled = (action: TicketAction, via: "COMMAND" | "BUTTON") => (action !== "history" || config.discordHistoryEnabled) && ticketActionEnabled(config.actions,action,via);
    const anyButtons = () => (["close","schedule","autoClose","addUser","history"] as const).some(action => enabled(action,"BUTTON"));
    const welcomeControls = () => {
      if (!anyButtons()) return undefined;
      const row = new ActionRowBuilder<ButtonBuilder>();
      if ((config.behavior.controlStyle ?? "MANAGE") === "MANAGE") return row.addComponents(new ButtonBuilder().setCustomId(`${prefix}manage`).setLabel("จัดการตั๋ว").setStyle(ButtonStyle.Secondary));
      if (enabled("close","BUTTON")) row.addComponents(new ButtonBuilder().setCustomId(`${prefix}close`).setLabel("ปิดตั๋ว").setStyle(ButtonStyle.Danger));
      if (enabled("schedule","BUTTON")) row.addComponents(new ButtonBuilder().setCustomId(`${prefix}set-timer`).setLabel("ตั้งเวลาปิด").setStyle(ButtonStyle.Secondary));
      if (enabled("autoClose","BUTTON")) row.addComponents(new ButtonBuilder().setCustomId(`${prefix}request-exemption`).setLabel("ยกเว้นปิดอัตโนมัติ").setStyle(ButtonStyle.Secondary));
      if (enabled("addUser","BUTTON")) row.addComponents(new ButtonBuilder().setCustomId(`${prefix}participants`).setLabel("เพิ่มสมาชิก").setStyle(ButtonStyle.Secondary));
      if (enabled("history","BUTTON")) row.addComponents(new ButtonBuilder().setCustomId(`${prefix}history`).setLabel("อ่านประวัติแชท").setStyle(ButtonStyle.Secondary));
      return row;
    };
    let stopped = false;
    let queue: Promise<void> = Promise.resolve();
    let registration: Promise<void> = Promise.resolve();
    let commandId: string | undefined;
    let runtimeState = { ...context.runtimeState };
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let sweeping = false;
    let ticketsLoaded = false;
    const pending = new Set<Promise<unknown>>();
    const exporting = new Set<string>();
    const tickets = new Map<string, { name: string; state: TicketState; archived: boolean }>();
    const historyButton = () => new ButtonBuilder().setCustomId(`${prefix}history`).setLabel("อ่านประวัติแชท").setStyle(ButtonStyle.Secondary);
    const report = (code: string, error: unknown) => context.reportFeatureError(code, error, { recoverable: true }).catch(() => undefined);
    const notifyCancellation = async (channel: TextChannel) => {
      if (config.cancellationNotice.enabled) await channel.send({content:config.cancellationNotice.message,allowedMentions:{parse:[]}})
        .catch(error => report("TICKET_CANCELLATION_NOTICE_FAILED",error));
    };
    const track = (operation: Promise<unknown>) => {
      pending.add(operation);
      void operation.finally(() => pending.delete(operation)).catch(() => undefined);
    };
    const serialize = <T>(work: () => Promise<T>): Promise<T> => {
      const next = queue.then(work);
      queue = next.then(() => undefined, () => undefined);
      return next;
    };
    const guild = () => Promise.resolve(context.client.guilds.cache?.get(context.guildId!) ?? context.client.guilds.fetch(context.guildId!));
    const categoryFor = (key: string) => {
      const row = config.categories.find((item) => item.key === key);
      if (!row) throw new Error("หัวข้อนี้เปลี่ยนแล้ว กรุณาเลือกหัวข้อจากแผงล่าสุด");
      return row;
    };
    const saveTicket = async (channelId: string, name: string, state: TicketState) => {
      await context.tickets.save(channelId, name, state);
      tickets.set(channelId, { name, state, archived: tickets.get(channelId)?.archived ?? false });
    };
    const resetTopicSelect = async (interaction: StringSelectMenuInteraction) => {
      const components = interaction.message.components.map(component => structuredClone(component.toJSON()));
      let changed = false;
      const reset = (value: unknown) => {
        if (!value || typeof value !== "object") return;
        const component = value as Record<string, unknown>;
        if (component.type === ComponentType.StringSelect && component.custom_id === interaction.customId) {
          // Give the refreshed menu a new identity so clients discard their selected value.
          component.custom_id = `${prefix}select:${interaction.id}`;
          component.placeholder = "เลือกหัวข้อเพื่อเปิดตั๋ว";
          if (Array.isArray(component.options)) for (const option of component.options) {
            if (option && typeof option === "object") (option as Record<string, unknown>).default = false;
          }
          changed = true;
        }
        if (Array.isArray(component.components)) component.components.forEach(reset);
      };
      components.forEach(reset);
      if (changed) await interaction.message.edit({ components, allowedMentions: { parse: [] } });
    };
    const syncTickets = async (channels: ReadonlyMap<string, GuildBasedChannel | null>) => {
      const entries = await context.tickets.list();
      const retained = new Set(entries.map(entry => entry.channelId));
      for (const [id,entry] of tickets) if (entry.state.status === "CLOSED" && !retained.has(id)) tickets.delete(id);
      for (const entry of entries) tickets.set(entry.channelId, entry);
      // Import old topic metadata before clearing it. Ordinary topics are untouched.
      for (const channel of channels.values()) {
        if (channel?.type !== ChannelType.GuildText) continue;
        const legacy = readTicketTopic(context.installationId, channel.topic);
        if (!legacy) continue;
        if (!tickets.has(channel.id)) await saveTicket(channel.id, channel.name, legacy);
        await channel.setTopic(null);
      }
      ticketsLoaded = true;
    };
    const close = async (channel: TextChannel, state: TicketState, actor: string) => {
      state = { ...state, status: "CLOSING" };
      await saveTicket(channel.id, channel.name, state);
      const me = await (await guild()).members.fetchMe({ force: true });
      if (!channel.permissionsFor(me)?.has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.ManageChannels, PermissionFlagsBits.ManageRoles]))
        throw new Error("บอทต้องมี View Channel, Read Message History, Manage Channels และ Manage Roles จึงจะเก็บประวัติและลบห้องได้");
      const application = await context.client.application!.fetch();
      if (!application.flags?.any([ApplicationFlagsBitField.Flags.GatewayMessageContent, ApplicationFlagsBitField.Flags.GatewayMessageContentLimited]))
        throw new Error("เปิด Message Content Intent ใน Discord Developer Portal ก่อน เพื่อเก็บแชทได้ครบ ระบบยังไม่ลบห้อง");
      await Promise.all([...new Set([state.ownerId, ...(state.participantIds ?? [])])].map(id => channel.permissionOverwrites.edit(id, {
        SendMessages: false, AddReactions: false, CreatePublicThreads: false,
        CreatePrivateThreads: false, SendMessagesInThreads: false,
      }, { type: OverwriteType.Member, reason: "Ticket closing" })));
      const messages = await ticketArchive(channel, () => stopped);
      await context.tickets.archive(channel.id, messages);
      tickets.get(channel.id)!.archived = true;
      await channel.delete(`Ticket closed: ${actor}`);
      await saveTicket(channel.id, channel.name, { ...state, status: "CLOSED" });
    };
    const canClose = async (interaction: TicketInteraction) => {
      const member = await (await guild()).members.fetch({ user: interaction.user.id, force: true });
      return member.permissions.has(PermissionFlagsBits.Administrator)
        || config.behavior.closeUserIds.includes(interaction.user.id)
        || config.behavior.closeRoleIds.some((id) => member.roles.cache.has(id));
    };
    const canRead = async (interaction: TicketInteraction, state: TicketState) => {
      if (interaction.user.id === state.ownerId || state.participantIds?.includes(interaction.user.id) || await canClose(interaction)) return true;
      const member = await (await guild()).members.fetch({ user: interaction.user.id, force: true });
      return state.supportRoleIds.some(id => member.roles.cache.has(id));
    };
    const participantPicker = (allowed: boolean, state: TicketState) => new ActionRowBuilder<UserSelectMenuBuilder>().addComponents(
      new UserSelectMenuBuilder().setCustomId(`${prefix}add-user`).setPlaceholder("เพิ่มสมาชิกเข้าร่วมตั๋ว")
        .setMinValues(1).setMaxValues(1).setDisabled(!allowed || state.status !== "OPEN" || (state.participantIds?.length ?? 0) >= 25),
    );
    const showControls = async (interaction: TicketInteraction, state: TicketState) => {
      const allowed = await canClose(interaction);
      const requestPending = state.exemption?.status === "PENDING";
      const controls = new ActionRowBuilder<ButtonBuilder>();
      if (enabled("close","BUTTON")) controls.addComponents(new ButtonBuilder().setCustomId(`${prefix}close`).setLabel("ปิดตั๋ว").setStyle(ButtonStyle.Danger).setDisabled(!allowed || state.status === "CLOSED"));
      if (enabled("schedule","BUTTON")) controls.addComponents(new ButtonBuilder().setCustomId(`${prefix}set-timer`).setLabel("ตั้งเวลาปิด").setStyle(ButtonStyle.Secondary).setDisabled(!allowed || state.status !== "OPEN"));
      if (enabled("autoClose","BUTTON")) controls.addComponents(new ButtonBuilder().setCustomId(`${prefix}request-exemption`).setLabel(allowed ? "ยกเลิกปิดอัตโนมัติ" : "ขอยกเว้นปิดอัตโนมัติ").setStyle(ButtonStyle.Secondary).setDisabled(state.status !== "OPEN" || !state.autoCloseMinutes || (!allowed && (interaction.user.id !== state.ownerId || requestPending))));
      if (enabled("history","BUTTON")) controls.addComponents(historyButton().setDisabled(!await canRead(interaction,state)));
      const decisions = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId(`${prefix}approve-exemption`).setLabel("อนุมัติยกเว้น").setStyle(ButtonStyle.Success).setDisabled(!allowed || state.status !== "OPEN"),
        new ButtonBuilder().setCustomId(`${prefix}deny-exemption`).setLabel("ปฏิเสธคำขอ").setStyle(ButtonStyle.Secondary).setDisabled(!allowed || state.status !== "OPEN"),
      );
      await interaction.editReply({content:`จัดการตั๋ว${state.ticketNumber === undefined ? "" : ` #${String(state.ticketNumber).padStart(5,"0")}`} · ${allowed ? "คุณมีสิทธิ์ปิดตั๋ว" : "คุณไม่มีสิทธิ์ปิดตั๋ว"}${requestPending ? "\nมีคำขอยกเว้นปิดอัตโนมัติรออนุมัติ" : ""}`,
        components:[...(controls.components.length?[controls]:[]),...(enabled("addUser","BUTTON")?[participantPicker(allowed,state)]:[]),...(requestPending && enabled("autoClose","BUTTON")?[decisions]:[])],allowedMentions:{parse:[]}});
    };
    const open = async (interaction: TicketInteraction, category: TicketCategory, answers: Array<{ label: string; value: string }>) => {
      const server = await guild();
      const startedAt = Date.now();
      const channels = server.channels.cache ?? await server.channels.fetch();
      if (!ticketsLoaded) await syncTickets(channels);
      const existing = [...tickets.entries()].filter(([id, entry]) => channels.has(id) && entry.state.ownerId === interaction.user.id && entry.state.status !== "CLOSED");
      if (existing.length >= config.behavior.maxOpenPerUser) {
        await interaction.editReply({ content: `คุณเปิดตั๋วค้างได้สูงสุด ${config.behavior.maxOpenPerUser} ตั๋ว: ${existing.map(([id]) => `<#${id}>`).join(" ")}`, allowedMentions: { parse: [] } });
        return;
      }
      const parent = channels.get(category.categoryId) ?? await server.channels.fetch(category.categoryId);
      if (!parent || parent.type !== ChannelType.GuildCategory) throw new Error("ไม่พบหมวดห้อง Discord ของหัวข้อนี้ กรุณาแจ้งผู้ดูแล");
      const me = server.members.me ?? await server.members.fetchMe();
      const teamRoles = [...new Set([...category.supportRoleIds, ...config.behavior.closeRoleIds])];
      if (teamRoles.includes(server.id)) throw new Error("ทีมดูแลต้องไม่ใช้ Role @everyone");
      await Promise.all(teamRoles.map(async roleId => {
        const role = server.roles.cache?.get(roleId) ?? await server.roles.fetch(roleId);
        if (!role || role.id === server.roles.everyone.id) throw new Error(`ไม่พบ Role ทีมดูแล: ${roleId}`);
      }));
      if (!parent.permissionsFor(me).has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ManageChannels, PermissionFlagsBits.ManageRoles]))
        throw new Error("บอทต้องมี View Channel, Manage Channels และ Manage Roles ในหมวดที่เลือก");
      const ticketNumber = await context.tickets.nextNumber();
      const numberText = String(ticketNumber).padStart(5,"0");
      const state: TicketState = {
        ticketNumber, ownerId: interaction.user.id, categoryKey: category.key, openedAt: Date.now(),
        autoCloseMinutes: category.autoCloseMinutes, autoCloseMode: category.autoCloseMode,
        supportRoleIds: category.supportRoleIds, status: "OPEN",
      };
      const read = [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory];
      const write = [...read, PermissionFlagsBits.SendMessages, PermissionFlagsBits.AttachFiles, PermissionFlagsBits.EmbedLinks];
      const channel = await server.channels.create({
        name: ticketChannelName(category.channelNameTemplate, category.key, interaction.user, numberText),
        type: ChannelType.GuildText, parent: parent.id,
        permissionOverwrites: [
          { id: server.id, deny: [PermissionFlagsBits.ViewChannel] },
          { id: me.id, allow: [...write, PermissionFlagsBits.ManageChannels, PermissionFlagsBits.ManageRoles] },
          { id: interaction.user.id, allow: write, deny: [PermissionFlagsBits.CreatePublicThreads, PermissionFlagsBits.CreatePrivateThreads] },
          ...teamRoles.map((id) => ({ id, allow: write })),
          ...config.behavior.closeUserIds.filter(id => id !== interaction.user.id && id !== me.id && id !== server.id && !teamRoles.includes(id)).map(id => ({ id, type: 1 as const, allow: write })),
        ],
        reason: `Ticket ${category.key} opened by ${interaction.user.id}`,
      });
      try { await saveTicket(channel.id, channel.name, state); }
      catch (error) { await channel.delete("Ticket registration failed").catch(() => undefined); throw error; }
      try {
        const payloads = ticketOpeningMessages(context, category, {
          id: numberText,
          user: `<@${interaction.user.id}>`, user_name: escapeMarkdown(interaction.user.displayName),
          category: escapeMarkdown(category.label), channel: `<#${channel.id}>`,
          auto_close: category.autoCloseMinutes === 0 ? "ปิดอัตโนมัติ: ไม่เปิดใช้งาน"
            : `${category.autoCloseMinutes} นาที ${category.autoCloseMode === "IDLE" ? "หลังไม่มีข้อความใหม่" : "หลังเปิดตั๋ว"}`,
        }, answers, welcomeControls());
        for (const payload of payloads) await channel.send(payload);
      } catch (error) {
        await report("TICKET_WELCOME_FAILED", error);
        await interaction.editReply({ content: `สร้างตั๋วแล้ว: <#${channel.id}> แต่ส่งรายละเอียดไม่ครบ กรุณาแจ้งทีมดูแล`, allowedMentions: { parse: [] } });
        return;
      }
      console.info(`Ticket opened: bot ${context.botId}, ${Date.now() - startedAt}ms`);
      let pingFailed = false;
      try { await sendTicketOpeningMentions(channel, category, interaction.user.id); }
      catch (error) { pingFailed = true; await report("TICKET_PING_FAILED", error); }
      await interaction.editReply({ content: `เปิดตั๋วแล้ว: <#${channel.id}>${pingFailed ? " แต่ส่ง Ping ไม่สำเร็จ กรุณาให้ผู้ดูแลตรวจผู้รับและสิทธิ์การแท็ก" : ""}`, allowedMentions: { parse: [] } });
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
            .addOptions(config.categories.map((row) => ({ label: row.label, value: row.key, ...(row.description ? { description: row.description } : {}), ...(row.emoji ? { emoji: row.emoji } : {}) })));
          await channel.send(withRow(renderTemplate(context, "panel", {}), new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu)));
          await interaction.editReply("ส่งแผง Ticket แล้ว");
          return;
        }
      } else {
        if (!interaction.customId.startsWith(prefix)) return;
        if ((interaction.isButton() || interaction.isStringSelectMenu() || interaction.isUserSelectMenu()) && interaction.message.author.id !== context.client.user?.id) return;
        if (interaction.isStringSelectMenu()) {
          if (!/^select(?::\d{15,30})?$/.test(interaction.customId.slice(prefix.length))) return;
          let category: TicketCategory;
          try {
            category = categoryFor(interaction.values[0] ?? "");
            if (category.formEnabled) {
              const modal = new ModalBuilder().setCustomId(`${prefix}form:${category.key}`).setTitle(category.formTitle);
              for (const field of category.fields) modal.addLabelComponents(new LabelBuilder().setLabel(field.label).setTextInputComponent(
                new TextInputBuilder().setCustomId(field.key)
                  .setStyle(field.style === "PARAGRAPH" ? TextInputStyle.Paragraph : TextInputStyle.Short)
                  .setRequired(field.required).setMaxLength(1000)
                  .setPlaceholder(field.placeholder || field.label),
              ));
              await interaction.showModal(modal);
            } else await interaction.deferReply({ flags: MessageFlags.Ephemeral });
          } finally {
            // Refresh separately after acknowledging: opening a modal cannot also update its message.
            track(resetTopicSelect(interaction).catch(error => report("TICKET_PANEL_RESET_FAILED", error)));
          }
          if (!category.formEnabled) await serialize(() => open(interaction, category, []));
          return;
        }
        if (interaction.isButton() && interaction.customId === `${prefix}set-timer`) {
          if (!enabled("schedule","BUTTON")) throw new Error("ปิดปุ่มตั้งเวลาไว้ในการตั้งค่า Ticket บนเว็บ");
          const state = tickets.get(interaction.channelId!)?.state;
          if (!state || state.status !== "OPEN") throw new Error("ตั้งเวลาได้เฉพาะตั๋วที่ยังเปิดอยู่");
          if (!await canClose(interaction)) { await interaction.deferReply({flags:MessageFlags.Ephemeral}); await showControls(interaction,state); return; }
          await interaction.showModal(new ModalBuilder().setCustomId(`${prefix}timer`).setTitle("ตั้งเวลาปิดตั๋วนี้").addLabelComponents(
            new LabelBuilder().setLabel("เวลาปิด (นาที) ตั้งได้ 1–43200").setTextInputComponent(new TextInputBuilder().setCustomId("minutes").setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(5).setValue(String(state.autoCloseMinutes || 60))),
            new LabelBuilder().setLabel("เริ่มนับเวลา").setStringSelectMenuComponent(new StringSelectMenuBuilder().setCustomId("mode").setMinValues(1).setMaxValues(1).addOptions(
              {label:"นับจากตอนตั้งเวลา",value:"FROM_NOW",default:true}, {label:"นับเมื่อไม่มีข้อความใหม่",value:"IDLE"},
            )),
          ));
          return;
        }
        if (interaction.isModalSubmit() && interaction.customId !== `${prefix}timer`) {
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
        if (![`${prefix}timer`, `${prefix}participants`, `${prefix}add-user`, `${prefix}manage`, `${prefix}request-exemption`, `${prefix}approve-exemption`, `${prefix}deny-exemption`, `${prefix}close`, `${prefix}confirm-close`, `${prefix}history`].includes(interaction.customId)) return;
      }
      const confirming = interaction.isButton() && interaction.customId === `${prefix}confirm-close`;
      if (confirming) await interaction.deferUpdate();
      else await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const channel = await (await guild()).channels.fetch(interaction.channelId!);
      if (!channel || channel.type !== ChannelType.GuildText) throw new Error("คำสั่งนี้ใช้ได้เฉพาะในห้อง Ticket");
      const state = tickets.get(channel.id)?.state;
      if (!state) throw new Error("ห้องนี้ไม่ใช่ตั๋วของ Feature นี้");
      const action = (interaction.isButton() || interaction.isUserSelectMenu()) ? interaction.customId.slice(prefix.length) : interaction.isChatInputCommand() ? interaction.options.getSubcommand() : interaction.isModalSubmit() && interaction.customId === `${prefix}timer` ? "auto-close" : "";
      const via = interaction.isChatInputCommand() ? "COMMAND" : "BUTTON";
      const actionKey: TicketAction | undefined = ["close","confirm-close"].includes(action) ? "close" : action === "auto-close" ? "schedule" : ["no-auto-close","request-exemption","approve-exemption","deny-exemption"].includes(action) ? "autoClose" : ["participants","add-user"].includes(action) ? "addUser" : action === "history" ? "history" : undefined;
      if (actionKey === "history" && !config.discordHistoryEnabled) throw new Error("ปิดการอ่านประวัติใน Discord ไว้ สามารถเปิดตัวเลือกนี้บนหน้าเว็บจัดการบอท");
      // Confirmation belongs to its preceding close command or button, even when only commands are enabled.
      if (actionKey && !(confirming ? enabled("close","COMMAND") || enabled("close","BUTTON") : enabled(actionKey,via))) throw new Error("ช่องทางคำสั่งหรือปุ่มนี้ถูกปิดไว้ในการตั้งค่า Ticket บนเว็บ");
      if (action === "auto-close") {
        await serialize(async () => {
          const current = tickets.get(channel.id)?.state;
          if (!current || current.status !== "OPEN") throw new Error("ตั้งเวลาได้เฉพาะตั๋วที่ยังเปิดอยู่");
          if (!await canClose(interaction)) throw new Error("เฉพาะผู้มีสิทธิ์ปิดตั๋วเท่านั้นที่ตั้งเวลาได้");
          const minutes = interaction.isModalSubmit() ? Number(interaction.fields.getTextInputValue("minutes")) : interaction.isChatInputCommand() ? interaction.options.getInteger("minutes",true) : NaN;
          const mode = interaction.isModalSubmit() ? interaction.fields.getStringSelectValues("mode")[0] : interaction.isChatInputCommand() ? interaction.options.getString("mode") ?? "FROM_NOW" : undefined;
          if (!Number.isInteger(minutes) || minutes < 1 || minutes > 43200 || !["FROM_NOW","IDLE"].includes(String(mode))) throw new Error("ตั้งเวลา 1–43200 นาที และเลือกจุดเริ่มนับเวลาให้ถูกต้อง");
          const next: TicketState = {...current,autoCloseMinutes:minutes,autoCloseMode:mode === "IDLE"?"IDLE":"OPENED",autoCloseStartAt:Date.now()};
          delete next.exemption;
          await saveTicket(channel.id,channel.name,next);
          const content = `ตั้งปิดตั๋วอัตโนมัติ ${minutes} นาที ${mode === "IDLE"?"เมื่อไม่มีข้อความใหม่":"นับจากตอนนี้"}แล้ว`;
          await interaction.editReply({content,components:[]});
          await channel.send({content,allowedMentions:{parse:[]}});
        });
        return;
      }
      if (!actionKey && action !== "manage") throw new Error("ไม่พบการทำงาน Ticket นี้");
      if (action === "participants") {
        await interaction.editReply({content:"เลือกสมาชิกที่จะเพิ่มเข้าร่วมตั๋ว",components:[participantPicker(await canClose(interaction),state)],allowedMentions:{parse:[]}});
        return;
      }
      if (action === "add-user") {
        await serialize(async () => {
          const current = tickets.get(channel.id)?.state;
          if (!current || current.status !== "OPEN") throw new Error("เพิ่มสมาชิกได้เฉพาะตั๋วที่ยังเปิดอยู่");
          if (!await canClose(interaction)) throw new Error("เฉพาะผู้มีสิทธิ์ปิดตั๋วเท่านั้นที่เพิ่มสมาชิกได้");
          const id = interaction.isUserSelectMenu() ? interaction.values[0] : interaction.isChatInputCommand() ? interaction.options.getUser("member",true).id : undefined;
          if (!id || !/^\d{15,30}$/.test(id)) throw new Error("กรุณาเลือกสมาชิกหนึ่งคนในเซิร์ฟเวอร์นี้");
          const member = await (await guild()).members.fetch({ user: id, force: true });
          if (member.user.bot) throw new Error("กรุณาเลือกสมาชิกที่ไม่ใช่บอท");
          if (id === current.ownerId) { await interaction.editReply({ content: "สมาชิกคนนี้เป็นผู้เปิดตั๋วอยู่แล้ว", components: [] }); return; }
          const participants = current.participantIds ?? [];
          const alreadyAdded = participants.includes(id);
          if (!alreadyAdded && participants.length >= 25) throw new Error("ตั๋วนี้เพิ่มผู้ร่วมได้สูงสุด 25 คน");
          if (!alreadyAdded) await saveTicket(channel.id,channel.name,{...current,participantIds:[...participants,id]});
          try {
            await channel.permissionOverwrites.edit(id,{
              ViewChannel:true,ReadMessageHistory:true,SendMessages:true,AttachFiles:true,EmbedLinks:true,
              CreatePublicThreads:false,CreatePrivateThreads:false,SendMessagesInThreads:false,
            },{type:OverwriteType.Member,reason:`Ticket participant added by ${interaction.user.id}`});
          } catch(error) {
            if (!alreadyAdded) await saveTicket(channel.id,channel.name,current).catch(e=>report("TICKET_PARTICIPANT_STATE_FAILED",e));
            throw error;
          }
          await interaction.editReply({content:`เพิ่ม <@${id}> เข้าร่วมตั๋วแล้ว สามารถอ่านและคุยได้ โดยไม่เพิ่มสิทธิ์ปิดตั๋ว`,components:[],allowedMentions:{parse:[]}});
          await channel.send({content:`เพิ่ม <@${id}> เข้าร่วมตั๋ว โดย <@${interaction.user.id}>`,allowedMentions:{parse:[]}});
        });
        return;
      }
      if (action === "manage") {
        if (!anyButtons()) throw new Error("ปิดปุ่ม Ticket ไว้ ใช้คำสั่งที่เปิดไว้หรือตั้งค่าบนเว็บ");
        await showControls(interaction,state); return;
      }
      if (["no-auto-close","request-exemption","approve-exemption","deny-exemption"].includes(action)) {
        await serialize(async () => {
          const current = tickets.get(channel.id)?.state;
          if (!current || current.status !== "OPEN" || !current.autoCloseMinutes) throw new Error("ตั๋วนี้ไม่ได้ตั้งเวลาปิดอัตโนมัติ หรือกำลังปิดแล้ว");
          if (action === "no-auto-close" || action === "request-exemption") {
            if (await canClose(interaction)) {
              const requested = current.exemption?.status === "PENDING" ? current.exemption : { requestedBy: interaction.user.id, requestedAt: Date.now() };
              await saveTicket(channel.id,channel.name,{...current,autoCloseMinutes:0,exemption:{...requested,status:"APPROVED",decidedBy:interaction.user.id,decidedAt:Date.now()}});
              await notifyCancellation(channel);
              await interaction.editReply({content:"ยกเลิกปิดอัตโนมัติให้ตั๋วนี้แล้ว ตั๋วจะเปิดไว้จนกว่าผู้มีสิทธิ์จะปิดเอง",components:[]});
              return;
            }
            if (interaction.user.id !== current.ownerId) throw new Error("เฉพาะผู้เปิดตั๋วส่งคำขอยกเว้นได้");
            if (current.exemption?.status === "PENDING") throw new Error("มีคำขอรออนุมัติอยู่แล้ว");
            await saveTicket(channel.id,channel.name,{...current,exemption:{requestedBy:interaction.user.id,requestedAt:Date.now(),status:"PENDING"}});
            await channel.send({content:enabled("autoClose","BUTTON")?"มีคำขอยกเว้นปิดตั๋วอัตโนมัติ ผู้ดูแลกดดูคำขอเพื่ออนุมัติหรือปฏิเสธ":`มีคำขอยกเว้นปิดตั๋วอัตโนมัติ ผู้ดูแลใช้ /${config.command} approve-exemption หรือ /${config.command} deny-exemption`,components:enabled("autoClose","BUTTON")?[new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder().setCustomId(`${prefix}manage`).setLabel("ดูคำขอ").setStyle(ButtonStyle.Secondary))]:[],allowedMentions:{parse:[]}});
            await interaction.editReply({content:"ส่งคำขอแล้ว ระหว่างรออนุมัติจะยังใช้เวลาปิดเดิม",components:[]});
          } else {
            if (!await canClose(interaction)) throw new Error("เฉพาะผู้มีสิทธิ์ปิดตั๋วเท่านั้นที่ตัดสินคำขอได้");
            if (current.exemption?.status !== "PENDING") throw new Error("ไม่มีคำขอรออนุมัติ");
            const approved = action === "approve-exemption";
            await saveTicket(channel.id,channel.name,{...current,...(approved?{autoCloseMinutes:0}:{}),exemption:{...current.exemption,status:approved?"APPROVED":"DENIED",decidedBy:interaction.user.id,decidedAt:Date.now()}});
            if (approved) await notifyCancellation(channel);
            else await channel.send({content:"คำขอยกเว้นถูกปฏิเสธ ตั๋วนี้ยังใช้เวลาปิดเดิม",allowedMentions:{parse:[]}});
            await interaction.editReply({content:approved?"ยกเว้นปิดอัตโนมัติให้ตั๋วนี้แล้ว":"ปฏิเสธคำขอแล้ว",components:[]});
          }
        });
        return;
      }
      const readingHistory = interaction.isChatInputCommand() ? interaction.options.getSubcommand() === "history" : interaction.isButton() && interaction.customId === `${prefix}history`;
      if (readingHistory) {
        if (!config.discordHistoryEnabled) throw new Error("ปิดการอ่านประวัติใน Discord ไว้ สามารถเปิดตัวเลือกนี้บนหน้าเว็บจัดการบอท");
        const member = await (await guild()).members.fetch({ user: interaction.user.id, force: true });
        if (!channel.permissionsFor(member).has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory]) || !await canRead(interaction, state))
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
      if (!await canClose(interaction)) {
        if (interaction.isButton() && !confirming) { await showControls(interaction,state); return; }
        throw new Error("เฉพาะ Administrator หรือ Role/User ที่ได้รับสิทธิ์ปิดตั๋วบนเว็บเท่านั้น");
      }
      if (!confirming && config.behavior.confirmClose) {
        await interaction.editReply({ content: "ยืนยันปิดตั๋วนี้? ระบบจะเก็บประวัติบนเว็บแล้วลบห้อง Discord",
          components: [new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder().setCustomId(`${prefix}confirm-close`).setLabel("ยืนยันปิดตั๋ว").setStyle(ButtonStyle.Danger))] });
        return;
      }
      await interaction.editReply({ content: "กำลังเก็บประวัติและลบห้อง Ticket…", components: [] });
      await serialize(async () => {
        const fresh = await channel.fetch(true);
        const current = tickets.get(fresh.id)?.state;
        if (!current) throw new Error("ไม่พบตั๋ว");
        await close(fresh, current, interaction.user.id);
      });
    };
    const sweep = async () => {
      if (stopped || sweeping) return;
      sweeping = true;
      try {
        await serialize(async () => {
          const channels = await (await guild()).channels.fetch();
          await syncTickets(channels);
          for (const [channelId, entry] of tickets) {
            if (stopped) break;
            const state = entry.state;
            if (state.status === "CLOSED") continue;
            const channel = channels.get(channelId);
            if (!channel) {
              if (state.status === "CLOSING" && entry.archived) await saveTicket(channelId, entry.name, { ...state, status: "CLOSED" });
              continue;
            }
            if (channel.type !== ChannelType.GuildText) continue;
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
        .addSubcommand((sub) => sub.setName("panel").setDescription("ส่งแผงเลือกหัวข้อเปิดตั๋ว"));
      if (enabled("close","COMMAND")) definition.addSubcommand(sub => sub.setName("close").setDescription("ขอปิดตั๋วในห้องนี้"));
      if (enabled("addUser","COMMAND")) definition.addSubcommand(sub => sub.setName("add-user").setDescription("เพิ่มสมาชิกเข้าร่วมตั๋วนี้").addUserOption(option => option.setName("member").setDescription("สมาชิกที่จะเพิ่มเข้าตั๋ว").setRequired(true)));
      if (enabled("schedule","COMMAND")) definition.addSubcommand(sub => sub.setName("auto-close").setDescription("ตั้งเวลาปิดอัตโนมัติสำหรับตั๋วนี้")
        .addIntegerOption(option => option.setName("minutes").setDescription("เวลาปิด 1–43200 นาที").setRequired(true).setMinValue(1).setMaxValue(43200))
        .addStringOption(option => option.setName("mode").setDescription("เริ่มนับเวลา").addChoices({name:"นับจากตอนตั้งเวลา",value:"FROM_NOW"},{name:"นับเมื่อไม่มีข้อความใหม่",value:"IDLE"})));
      if (enabled("autoClose","COMMAND")) definition
        .addSubcommand(sub => sub.setName("no-auto-close").setDescription("ยกเลิกปิดอัตโนมัติทันทีสำหรับผู้ดูแล หรือส่งคำขอสำหรับผู้เปิดตั๋ว"))
        .addSubcommand(sub => sub.setName("approve-exemption").setDescription("อนุมัติคำขอยกเว้นการปิดตั๋วอัตโนมัติ"))
        .addSubcommand(sub => sub.setName("deny-exemption").setDescription("ปฏิเสธคำขอยกเว้นการปิดตั๋วอัตโนมัติ"));
      if (enabled("history","COMMAND")) definition.addSubcommand(sub => sub.setName("history").setDescription("อ่านและดาวน์โหลดประวัติแชทตั๋วนี้"));
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
      if (!interaction.isChatInputCommand() && !interaction.isStringSelectMenu() && !interaction.isModalSubmit() && !interaction.isButton() && !interaction.isUserSelectMenu()) return;
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
