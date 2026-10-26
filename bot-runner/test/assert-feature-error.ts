import assert from "node:assert/strict";
import { MessageFlags, type APIEmbed } from "discord.js";

export function assertFeatureError(value: unknown, name: string, code?: string, warning = false) {
  const payload = value as { content?: unknown; flags?: number; embeds: APIEmbed[]; components: unknown[]; allowedMentions: unknown };
  assert.equal(payload.embeds.length, 1);
  assert.equal(payload.flags ? payload.flags & MessageFlags.IsComponentsV2 : 0, 0);
  assert.ok(!payload.content, "an error must be displayed in the Embed");
  assert.deepEqual(payload.components, []);
  assert.deepEqual(payload.allowedMentions, { parse: [] });
  const embed = payload.embeds[0]!;
  assert.ok(embed.title?.startsWith(`${name} • `));
  assert.equal(typeof embed.description, "string");
  assert.equal(embed.color, warning ? 0xfee75c : 0xed4245);
  assert.ok(embed.fields?.some(field => field.name === "คำแนะนำ" && field.value.length > 0));
  if (code) assert.ok(embed.fields?.some(field => field.name === "รหัสข้อผิดพลาด" && field.value === code));
  return embed as APIEmbed & { title: string; description: string };
}
