import { ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } from "discord.js";
import type { FeatureContext } from "../types.js";

export class PresentationValidationError extends Error {}

export function renderTemplate(context: FeatureContext, template: string, values: Record<string, string>): Record<string, unknown> {
  const definition = isRecord(context.presentations[template]) ? context.presentations[template] : null;
  if (!definition) throw new Error(`Presentation ${template} is not configured`);
  const mode = String(definition.mode ?? "EMBED").toUpperCase();
  if (mode === "COMPONENTS_V2") {
    const source = isRecord(definition.components_v2) ? definition.components_v2 : definition;
    if (!Array.isArray(source.components)) throw new Error(`Presentation ${template} must contain Components V2 blocks`);
    return {
      flags: MessageFlags.IsComponentsV2,
      components: normalizeComponents(deepRender(source.components, values)),
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

function fill(value: string, variables: Record<string, string>): string {
  return value.replace(/\{\{([a-z0-9_]+)}}/gi, (_, key: string) => variables[key] ?? "");
}
function deepRender(value: unknown, variables: Record<string, string>): unknown {
  if (typeof value === "string") return fill(value, variables);
  if (Array.isArray(value)) return value.map((item) => deepRender(item, variables));
  if (isRecord(value)) return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, deepRender(item, variables)]));
  return value;
}
function normalizeComponents(value: unknown, path = "components"): unknown[] {
  if (!Array.isArray(value)) return [];
  return value.map((item, index) => {
    if (!isRecord(item)) return item;
    const next = { ...item };
    const childPath = `${path}[${index}].components`;
    if (next.type === 1 && (!Array.isArray(next.components) || next.components.length < 1 || next.components.length > 5)) {
      throw new PresentationValidationError(`${childPath}: แถวปุ่มต้องมี 1–5 ปุ่ม กรุณาลบแถวว่างหรือแยกปุ่มที่เกินไปอีกแถว`);
    }
    if (next.type === 17 && typeof next.accent_color === "string" && /^#[0-9a-f]{6}$/i.test(next.accent_color)) {
      next.accent_color = Number.parseInt(next.accent_color.slice(1), 16);
    }
    if (Array.isArray(next.components)) next.components = normalizeComponents(next.components, childPath);
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
