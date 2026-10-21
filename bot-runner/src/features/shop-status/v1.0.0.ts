import {
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
  type Interaction,
  type NonThreadGuildBasedChannel,
  type GuildTextBasedChannel,
  type Message,
  type MessageEditOptions,
} from "discord.js";
import type { FeatureContext, FeatureModule } from "../../types.js";
import { renderTemplate } from "../presentation.js";
import {
  permissionPatch,
  readShopConfig,
  type ShopPermission,
  type ShopState,
  type ShopDeliveryMode,
} from "./config.js";

export const shopStatusFeature: FeatureModule = {
  runtimeKey: "shop-status",
  version: "1.0.0",
  intents: ["Guilds"],
  async activate(context) {
    if (!context.guildId)
      throw new Error("Shop Status requires a configured Discord server");
    const config = readShopConfig(context.config);
    let state = { ...context.runtimeState };
    let stopped = false;
    let busy = false;
    let activeCommandId: string | undefined;
    const running = new Set<Promise<void>>();
    let registration: Promise<void> = Promise.resolve();
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    const register = async () => {
      const commands = context.client.application?.commands;
      if (!commands) throw new Error("Discord application is unavailable");
      const existing = (await commands.fetch()).find(
        (item) => item.name === config.command,
      );
      if (existing && existing.id !== state.commandId)
        throw new Error(
          `Command /${config.command} is already owned by another feature`,
        );
      const command = await commands.create(
        new SlashCommandBuilder()
          .setName(config.command)
          .setDescription("เปิดหรือปิดร้าน")
          .setDMPermission(false)
          .addSubcommand((s) =>
            s.setName(config.open).setDescription("เปิดร้าน"),
          )
          .addSubcommand((s) =>
            s.setName(config.close).setDescription("ปิดร้าน"),
          )
          .toJSON(),
      );
      const previousId = state.previousCommandId ?? state.commandId;
      const next: Record<string, unknown> = {
        ...state,
        commandId: command.id,
        commandName: config.command,
      };
      if (typeof previousId === "string" && previousId !== command.id)
        next.previousCommandId = previousId;
      try {
        await context.saveRuntimeState(next);
      } catch (error) {
        // A newly created command must not be orphaned if ownership cannot be saved.
        if (!existing) await commands.delete(command.id).catch(() => undefined);
        throw error;
      }
      state = next;
      if (typeof previousId === "string" && previousId !== command.id) {
        await commands.delete(previousId).catch((error: unknown) => {
          if ((error as { code?: number })?.code !== 10063) throw error;
        });
        const cleaned = { ...state };
        delete cleaned.previousCommandId;
        await context.saveRuntimeState(cleaned);
        state = cleaned;
      }
      activeCommandId = command.id;
    };
    const report = (code: string, error: unknown) =>
      context
        .reportFeatureError(code, error, { recoverable: true })
        .catch(() => undefined);
    const handle = async (interaction: ChatInputCommandInteraction) => {
      if (!interaction.inGuild() || interaction.guildId !== context.guildId)
        return;
      const subcommand = interaction.options.getSubcommand();
      const action: ShopState | null =
        subcommand === config.open
          ? "open"
          : subcommand === config.close
            ? "close"
            : null;
      if (!action) {
        await interaction.reply({
          content: "คำสั่งนี้เปลี่ยนแล้ว กรุณาเลือกคำสั่งล่าสุด",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      if (
        !context.permissions.canUse(
          interaction,
          `${config.command}/${subcommand}`,
          false,
        )
      ) {
        await interaction.reply({
          content: "คุณไม่มีสิทธิ์ใช้คำสั่งนี้",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      if (busy) {
        await interaction.reply({
          content: "กำลังปรับสถานะร้าน กรุณารอแล้วลองอีกครั้ง",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      busy = true;
      try {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        await changeStatus(
          context,
          config,
          action,
          interaction,
          state.announcement,
          async () => {
            const next = {
              ...state,
              status: action,
              changedBy: interaction.user.id,
              changedAt: new Date().toISOString(),
            };
            await context.saveRuntimeState(next);
            state = next;
          },
          async (announcement) => {
            // Keep the ID in memory even if persistence is temporarily unavailable.
            state = { ...state, announcement };
            await context.saveRuntimeState(state);
          },
        );
      } finally {
        busy = false;
      }
    };
    const onInteraction = (interaction: Interaction) => {
      if (
        stopped ||
        !interaction.isChatInputCommand() ||
        interaction.commandName !== config.command ||
        interaction.commandId !== activeCommandId
      )
        return;
      const operation = handle(interaction)
        .catch(async (error: unknown) => {
          const content = `ปรับสถานะร้านไม่สำเร็จ: ${error instanceof Error ? error.message : "ตรวจสอบสิทธิ์ของบอท"}`;
          if (interaction.deferred)
            await interaction
              .editReply({ content, allowedMentions: { parse: [] } })
              .catch(() => undefined);
          else if (!interaction.replied)
            await interaction
              .reply({
                content,
                flags: MessageFlags.Ephemeral,
                allowedMentions: { parse: [] },
              })
              .catch(() => undefined);
          await report("SHOP_STATUS_FAILED", error);
        })
        .catch(() => undefined);
      running.add(operation);
      void operation.finally(() => running.delete(operation));
    };
    const onReady = () => {
      if (stopped) return;
      registration = register().catch(async (error: unknown) => {
        await report("SHOP_COMMAND_FAILED", error);
        if (!stopped) retryTimer = setTimeout(onReady, 30_000);
      });
    };
    context.client.on("interactionCreate", onInteraction);
    context.client.once("clientReady", onReady);
    if (context.client.isReady()) onReady();
    return async () => {
      stopped = true;
      clearTimeout(retryTimer);
      context.client.off("interactionCreate", onInteraction);
      context.client.off("clientReady", onReady);
      await registration;
      await Promise.allSettled(running);
    };
  },
};

async function changeStatus(
  context: FeatureContext,
  config: ReturnType<typeof readShopConfig>,
  action: ShopState,
  interaction: ChatInputCommandInteraction,
  previousAnnouncement: unknown,
  save: () => Promise<void>,
  remember: (announcement: AnnouncementReference) => Promise<void>,
) {
  const guild = await context.client.guilds.fetch(context.guildId!);
  const channelName = config.channelNames[action];
  const target =
    config.announcementChannelId || channelName
      ? await guild.channels.fetch(
          config.announcementChannelId ?? interaction.channelId,
          { force: true },
        )
      : interaction.channel;
  if (!target?.isSendable() || target.isDMBased())
    throw new Error("ไม่พบห้องสำหรับส่งประกาศ");
  const me = guild.members.me ?? (await guild.members.fetchMe());
  const targetPermissions = target.permissionsFor(me);
  const allowEveryoneMentions =
    context.config[`SHOP_${action.toUpperCase()}_ALLOW_EVERYONE_MENTIONS`] ===
    true;
  if (
    allowEveryoneMentions &&
    !targetPermissions?.has(PermissionFlagsBits.MentionEveryone)
  )
    throw new Error(
      "บอทต้องมี Mention Everyone ในห้องประกาศเพื่อ Ping @here / @everyone",
    );
  const previousName = target.name;
  const rename = Boolean(channelName && channelName !== previousName);
  if (
    rename &&
    !targetPermissions?.has(
      target.isThread()
        ? PermissionFlagsBits.ManageThreads
        : PermissionFlagsBits.ManageChannels,
    )
  )
    throw new Error(
      target.isThread()
        ? "บอทต้องมี Manage Threads เพื่อเปลี่ยนชื่อเธรดประกาศ"
        : "บอทต้องมี Manage Channels เพื่อเปลี่ยนชื่อห้องประกาศ",
    );
  const type =
    context.config[`SHOP_${action.toUpperCase()}_MESSAGE_TYPE`] ?? "DESIGNED";
  const variables = {
    status: action === "open" ? "เปิดร้าน" : "ปิดร้าน",
    user: `<@${interaction.user.id}>`,
    user_name: interaction.user.displayName,
    channel: `<#${target.id}>`,
    guild_name: guild.name,
  };
  const payload =
    type === "TEXT"
      ? {
          content: String(
            context.config[`SHOP_${action.toUpperCase()}_TEXT`] ??
              variables.status,
          ).replace(
            /\{\{([a-z0-9_]+)}}/gi,
            (_, key: string) => variables[key as keyof typeof variables] ?? "",
          ),
          allowedMentions: { parse: [] as string[] },
        }
      : renderTemplate(
          context,
          action === "open" ? "shop_open" : "shop_close",
          variables,
        );
  // Override only this shop announcement. Other features and private replies stay non-pinging.
  payload.allowedMentions = {
    parse: allowEveryoneMentions ? ["everyone"] : [],
  };
  if (
    "content" in payload &&
    typeof payload.content === "string" &&
    (!payload.content.trim() || payload.content.length > 2000)
  )
    throw new Error("ข้อความประกาศหลังแทนค่าตัวแปรต้องมี 1–2000 ตัวอักษร");
  if (
    !targetPermissions?.has(PermissionFlagsBits.ViewChannel) ||
    !targetPermissions.has(
      target.isThread()
        ? PermissionFlagsBits.SendMessagesInThreads
        : PermissionFlagsBits.SendMessages,
    ) ||
    ("embeds" in payload &&
      !targetPermissions.has(PermissionFlagsBits.EmbedLinks))
  )
    throw new Error("บอทไม่มีสิทธิ์ส่งประกาศในห้องปลายทาง");
  const changes: Array<{
    channel: NonThreadGuildBasedChannel;
    roleId: string;
    patch: Partial<Record<ShopPermission, boolean | null>>;
    previous: Partial<Record<ShopPermission, boolean | null>>;
  }> = [];
  // Resolve every resource before making any changes. Edit only the three supported bits.
  for (const rule of config.rules) {
    const patch = permissionPatch(rule[action]);
    if (!Object.keys(patch).length) continue;
    const channel = await guild.channels.fetch(rule.channelId, { force: true });
    const role = await guild.roles.fetch(rule.roleId);
    if (!channel || channel.isThread() || !role)
      throw new Error(`ไม่พบห้องหรือ Role: ${rule.channelId}/${rule.roleId}`);
    if (!channel.permissionsFor(me)?.has(PermissionFlagsBits.ManageRoles))
      throw new Error(`บอทต้องมี Manage Roles ในห้อง ${rule.channelId}`);
    if ("Connect" in patch && !channel.isVoiceBased())
      throw new Error(`Connect ใช้ได้เฉพาะห้องเสียง: ${rule.channelId}`);
    const overwrite = channel.permissionOverwrites.cache.get(role.id);
    const previous: Partial<Record<ShopPermission, boolean | null>> = {};
    for (const key of Object.keys(patch) as ShopPermission[])
      previous[key] = overwrite?.allow.has(PermissionFlagsBits[key])
        ? true
        : overwrite?.deny.has(PermissionFlagsBits[key])
          ? false
          : null;
    changes.push({ channel, roleId: role.id, patch, previous });
  }
  const applied: typeof changes = [];
  let renameAttempted = false;
  try {
    for (const change of changes) {
      // Include the attempted write: a network error can occur after Discord applied it.
      applied.push(change);
      await change.channel.permissionOverwrites.edit(
        change.roleId,
        change.patch,
        { reason: `Shop ${action} by ${interaction.user.id}` },
      );
    }
    if (rename) {
      // Include attempted renames: Discord may apply a write before a network error.
      renameAttempted = true;
      await target.setName(
        channelName,
        `Shop ${action} by ${interaction.user.id}`,
      );
    }
    await save();
  } catch (error) {
    const rollback = await Promise.allSettled([
      ...(renameAttempted
        ? [
            target.setName(
              previousName,
              "Restore channel name after failed shop change",
            ),
          ]
        : []),
      ...applied
        .reverse()
        .map((change) =>
          change.channel.permissionOverwrites.edit(
            change.roleId,
            change.previous,
            { reason: "Restore permissions after failed shop change" },
          ),
        ),
    ]);
    if (rollback.some((result) => result.status === "rejected"))
      throw new Error(
        "ปรับสถานะไม่ครบและคืนค่าบางห้องไม่สำเร็จ กรุณาตรวจสอบชื่อและสิทธิ์ทุกห้อง",
      );
    throw error;
  }
  const label = action === "open" ? "เปิดร้าน" : "ปิดร้าน";
  try {
    const message = await publishAnnouncement(
      target,
      payload,
      (context.config[`SHOP_${action.toUpperCase()}_DELIVERY_MODE`] ??
        "NEW") as ShopDeliveryMode,
      previousAnnouncement,
      me.id,
    );
    try {
      await remember({ channelId: target.id, messageId: message.id });
    } catch (error) {
      await context
        .reportFeatureError("SHOP_ANNOUNCEMENT_STATE_FAILED", error, {
          recoverable: true,
        })
        .catch(() => undefined);
      await interaction
        .editReply({
          content: `${label}และส่งประกาศแล้ว แต่บันทึกตำแหน่งข้อความไม่สำเร็จ หลังรีสตาร์ตอาจส่งข้อความใหม่`,
          allowedMentions: { parse: [] },
        })
        .catch(() => undefined);
      return;
    }
  } catch (error) {
    await interaction
      .editReply({
        content: `${label}และปรับสิทธิ์แล้ว แต่ส่งประกาศไม่สำเร็จ กรุณาตรวจสอบห้องประกาศ`,
        allowedMentions: { parse: [] },
      })
      .catch((ackError: unknown) =>
        context
          .reportFeatureError("SHOP_ACK_FAILED", ackError, {
            recoverable: true,
          })
          .catch(() => undefined),
      );
    await context
      .reportFeatureError("SHOP_ANNOUNCEMENT_FAILED", error, {
        recoverable: true,
      })
      .catch(() => undefined);
    return;
  }
  await interaction
    .editReply({
      content: `${label}และส่งประกาศแล้ว`,
      allowedMentions: { parse: [] },
    })
    .catch((error: unknown) =>
      context
        .reportFeatureError("SHOP_ACK_FAILED", error, { recoverable: true })
        .catch(() => undefined),
    );
}

interface AnnouncementReference {
  channelId: string;
  messageId: string;
}

async function publishAnnouncement(
  target: GuildTextBasedChannel,
  payload: Record<string, unknown>,
  mode: ShopDeliveryMode,
  previous: unknown,
  botId: string,
) {
  let message: Message<true> | undefined;
  if (mode !== "NEW" && previous && typeof previous === "object") {
    const reference = previous as Partial<AnnouncementReference>;
    if (
      reference.channelId === target.id &&
      typeof reference.messageId === "string"
    ) {
      try {
        message = await target.messages.fetch({
          message: reference.messageId,
          force: true,
        });
      } catch (error) {
        if (!unknownMessage(error)) throw error;
      }
      if (message && (message.author.id !== botId || message.webhookId))
        throw new Error("ประกาศเดิมไม่ได้เป็นข้อความของบอทนี้");
    }
  }
  if (message) {
    const componentsV2 = payload.flags === MessageFlags.IsComponentsV2;
    // Discord cannot remove IsComponentsV2 once set on a message.
    if (
      mode === "REPLACE" ||
      (message.flags.has(MessageFlags.IsComponentsV2) && !componentsV2)
    ) {
      await message.delete().catch((error: unknown) => {
        if (!unknownMessage(error)) throw error;
      });
    } else {
      try {
        return await message.edit({
          content: null,
          embeds: [],
          components: [],
          attachments: [],
          ...payload,
        } as MessageEditOptions);
      } catch (error) {
        // The announcement may have been deleted since it was fetched.
        if (!unknownMessage(error)) throw error;
      }
    }
  }
  return target.send(payload);
}

function unknownMessage(error: unknown) {
  return (error as { code?: number } | null)?.code === 10008;
}
