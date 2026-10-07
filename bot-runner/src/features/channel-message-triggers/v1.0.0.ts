import {
  ChannelType,
  type GuildTextBasedChannel,
  type Message,
  PermissionFlagsBits,
  type TextChannel,
} from "discord.js";
import type { FeatureContext, FeatureModule } from "../../types.js";

import { renderTemplate } from "../presentation.js";

interface ChannelCreateRule { categoryId: string; template: string; }
interface AdminTriggerRule { trigger: string; template: string; }

const TEMPLATE_KEY = /^template_(?:[1-9]|10)$/;

export const channelMessageTriggersFeature: FeatureModule = {
  runtimeKey: "channel-message-triggers",
  version: "1.0.0",
  intents: ["Guilds", "GuildMessages", "MessageContent"],
  async activate(context) {
    const channelRules = readChannelRules(context.config.CHANNEL_CREATE_RULES);
    const adminRules = readAdminRules(context.config.ADMIN_MESSAGE_TRIGGERS);

    const onChannelCreate = (channel: unknown) => {
      void handleChannelCreate(context, channelRules, channel).catch((error) => {
        console.error(`Channel message trigger failed for bot ${context.botId}: ${errorMessage(error)}`);
        void context.reportFeatureError("CHANNEL_CREATE_TRIGGER_FAILED", error);
      });
    };
    const onMessageCreate = (message: Message) => {
      void handleAdminTrigger(context, adminRules, message).catch((error) => {
        console.error(`Admin message trigger failed for bot ${context.botId}: ${errorMessage(error)}`);
        void context.reportFeatureError("ADMIN_MESSAGE_TRIGGER_FAILED", error);
      });
    };

    context.client.on("channelCreate", onChannelCreate);
    context.client.on("messageCreate", onMessageCreate);
    return () => {
      context.client.off("channelCreate", onChannelCreate);
      context.client.off("messageCreate", onMessageCreate);
    };
  },
};

async function handleChannelCreate(context: FeatureContext, rules: ChannelCreateRule[], channel: unknown): Promise<void> {
  if (!isCreatedTextChannel(channel) || !channel.parentId) return;
  if (context.guildId && channel.guildId !== context.guildId) return;
  const rule = rules.find((item) => item.categoryId === channel.parentId);
  if (!rule) return;
  await channel.send(renderTemplate(context, rule.template, {
    channel: `<#${channel.id}>`, channel_id: channel.id, channel_name: channel.name,
    category: channel.parent ? `<#${channel.parent.id}>` : "", category_id: channel.parentId,
    category_name: channel.parent?.name ?? "", guild_name: channel.guild.name,
  }));
}

async function handleAdminTrigger(context: FeatureContext, rules: AdminTriggerRule[], message: Message): Promise<void> {
  if (!message.inGuild() || message.author.bot) return;
  if (context.guildId && message.guildId !== context.guildId) return;
  if (!message.member?.permissions.has(PermissionFlagsBits.Administrator)) return;
  const content = message.content.trim().toLocaleLowerCase("en-US");
  const rule = rules.find((item) => item.trigger.toLocaleLowerCase("en-US") === content);
  if (!rule || !isSendableGuildChannel(message.channel)) return;

  await message.delete().catch((error) => {
    console.warn(`Unable to delete admin trigger message ${message.id}: ${errorMessage(error)}`);
  });
  await message.channel.send(renderTemplate(context, rule.template, {
    admin: `<@${message.author.id}>`, admin_id: message.author.id,
    admin_name: message.member?.displayName ?? message.author.displayName,
    channel: `<#${message.channelId}>`, channel_id: message.channelId,
    guild_name: message.guild.name, trigger: rule.trigger,
  }));
}

function readChannelRules(value: unknown): ChannelCreateRule[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!isRecord(item)) return [];
    const categoryId = String(item.categoryId ?? "").trim();
    const template = String(item.template ?? "").trim();
    return /^\d{15,30}$/.test(categoryId) && TEMPLATE_KEY.test(template) ? [{ categoryId, template }] : [];
  });
}

function readAdminRules(value: unknown): AdminTriggerRule[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!isRecord(item)) return [];
    const trigger = String(item.trigger ?? "").trim();
    const template = String(item.template ?? "").trim();
    return trigger.length > 0 && trigger.length <= 100 && TEMPLATE_KEY.test(template) ? [{ trigger, template }] : [];
  });
}

function isCreatedTextChannel(channel: unknown): channel is TextChannel {
  return !!channel && typeof channel === "object" && "type" in channel
    && (channel.type === ChannelType.GuildText || channel.type === ChannelType.GuildAnnouncement)
    && "send" in channel && typeof channel.send === "function";
}

function isSendableGuildChannel(channel: unknown): channel is GuildTextBasedChannel {
  return !!channel && typeof channel === "object" && "isTextBased" in channel
    && typeof channel.isTextBased === "function" && channel.isTextBased()
    && "send" in channel && typeof channel.send === "function" && "guildId" in channel;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message.slice(0, 300) : "Unknown error";
}
