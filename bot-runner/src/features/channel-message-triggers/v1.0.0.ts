import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  type GuildTextBasedChannel,
  type Message,
  MessageFlags,
  PermissionFlagsBits,
  type TextChannel,
} from "discord.js";
import type { FeatureContext, FeatureModule } from "../../types.js";

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

function renderTemplate(context: FeatureContext, template: string, values: Record<string, string>): Record<string, unknown> {
  const definition = isRecord(context.presentations[template]) ? context.presentations[template] : null;
  if (!definition) throw new Error(`Presentation ${template} is not configured`);
  const mode = String(definition.mode ?? "EMBED").toUpperCase();
  if (mode === "COMPONENTS_V2") {
    const source = isRecord(definition.components_v2) ? definition.components_v2 : definition;
    if (!Array.isArray(source.components)) throw new Error(`Presentation ${template} must contain Components V2 blocks`);
    return {
      flags: MessageFlags.IsComponentsV2,
      components: normalizeComponentColors(deepRender(source.components, values)),
      allowedMentions: { parse: [] },
    };
  }

  const source = isRecord(definition.embed) ? definition.embed : definition;
  const embeds = Array.isArray(definition.embeds)
    ? deepRender(definition.embeds, values)
    : [renderEmbed(source, values)];
  const content = fill(String(source.content ?? definition.content ?? ""), values).trim();
  const links = linkComponents(source.links, values);
  return { ...(content ? { content } : {}), embeds, ...(links.length ? { components: links } : {}), allowedMentions: { parse: [] } };
}

function renderEmbed(source: Record<string, unknown>, values: Record<string, string>): Record<string, unknown> {
  const title = fill(String(source.title ?? ""), values).trim();
  const description = fill(String(source.description ?? ""), values).trim();
  const url = optionalUrl(source.url, values);
  const color = embedColor(source.color);
  const image = urlObject(imageUrl(source.image_url ?? source.image, values));
  const thumbnail = urlObject(imageUrl(source.thumbnail_url ?? source.thumbnail, values));
  const footer = isRecord(source.footer)
    ? deepRender(source.footer, values)
    : source.footer ? { text: fill(String(source.footer), values) } : undefined;
  const timestamp = source.timestamp === true
    ? new Date().toISOString()
    : typeof source.timestamp === "string" ? fill(source.timestamp, values) : undefined;
  return {
    ...(title ? { title } : {}),
    ...(description ? { description } : {}),
    ...(url ? { url } : {}),
    ...(color !== undefined ? { color } : {}),
    ...(isRecord(source.author) ? { author: deepRender(source.author, values) } : {}),
    ...(Array.isArray(source.fields) ? { fields: deepRender(source.fields, values) } : {}),
    ...(footer ? { footer } : {}),
    ...(timestamp ? { timestamp } : {}),
    ...(image ? { image } : {}),
    ...(thumbnail ? { thumbnail } : {}),
  };
}

function linkComponents(value: unknown, variables: Record<string, string>) {
  if (!Array.isArray(value)) return [];
  const buttons = value.slice(0, 5).flatMap((item) => {
    if (!isRecord(item)) return [];
    const url = fill(String(item.url ?? ""), variables);
    if (!/^https:\/\//i.test(url)) return [];
    const button = new ButtonBuilder().setStyle(ButtonStyle.Link).setURL(url)
      .setLabel(fill(String(item.label ?? "Open link"), variables).slice(0, 80));
    const emoji = fill(String(item.emoji ?? ""), variables).trim();
    if (emoji) button.setEmoji(emoji);
    return [button];
  });
  return buttons.length ? [new ActionRowBuilder<ButtonBuilder>().addComponents(buttons)] : [];
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

function fill(value: string, variables: Record<string, string>): string {
  return value.replace(/\{\{([a-z0-9_]+)}}/gi, (_, key: string) => variables[key] ?? "");
}
function deepRender(value: unknown, variables: Record<string, string>): unknown {
  if (typeof value === "string") return fill(value, variables);
  if (Array.isArray(value)) return value.map((item) => deepRender(item, variables));
  if (isRecord(value)) return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, deepRender(item, variables)]));
  return value;
}
function normalizeComponentColors(value: unknown): unknown[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => {
    if (!isRecord(item)) return item;
    const next = { ...item };
    if (next.type === 17 && typeof next.accent_color === "string" && /^#[0-9a-f]{6}$/i.test(next.accent_color)) {
      next.accent_color = Number.parseInt(next.accent_color.slice(1), 16);
    }
    if (Array.isArray(next.components)) next.components = normalizeComponentColors(next.components);
    return next;
  });
}
function embedColor(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 0xffffff) return value;
  if (typeof value !== "string") return undefined;
  const normalized = value.trim().replace(/^#/, "");
  return /^[0-9a-f]{6}$/i.test(normalized) ? Number.parseInt(normalized, 16) : undefined;
}
function imageUrl(value: unknown, variables: Record<string, string>): string {
  if (typeof value === "string") return fill(value, variables);
  return isRecord(value) ? fill(String(value.url ?? ""), variables) : "";
}
function urlObject(value: string): { url: string } | undefined {
  return /^https?:\/\//i.test(value) ? { url: value } : undefined;
}
function optionalUrl(value: unknown, variables: Record<string, string>): string | undefined {
  const url = fill(String(value ?? ""), variables);
  return /^https?:\/\//i.test(url) ? url : undefined;
}
function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message.slice(0, 300) : "Unknown error";
}
