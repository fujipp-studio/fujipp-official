import { PermissionFlagsBits, type ChatInputCommandInteraction } from "discord.js";

export async function applySetRoleMentions(
  payload: Record<string, unknown>,
  interaction: ChatInputCommandInteraction,
  enabled: boolean,
): Promise<void> {
  if (!enabled) return;
  const ids = new Set<string>();
  const collect = (text: unknown) => {
    if (typeof text !== "string") return;
    for (const match of text.matchAll(/<@&(\d{15,30})>/g)) ids.add(match[1]!);
  };
  const visit = (components: unknown) => {
    if (!Array.isArray(components)) return;
    for (const item of components) {
      if (!item || typeof item !== "object") continue;
      if (item.type === 10) collect(item.content);
      visit(item.components);
    }
  };
  collect(payload.content);
  visit(payload.components);
  if (ids.size > 100) throw new Error("SET สามารถ Ping ได้สูงสุด 100 Role");
  if (ids.size) {
    const guild = interaction.guild;
    const channel = interaction.channel;
    if (!guild || !channel || channel.isDMBased())
      throw new Error("ไม่พบเซิร์ฟเวอร์หรือห้องสำหรับ Ping Role");
    const member = guild.members.me ?? await guild.members.fetchMe();
    const permissions = channel.permissionsFor(member);
    const roles = await guild.roles.fetch();
    for (const id of ids) {
      const role = roles.get(id);
      if (!role || id === guild.id) throw new Error(`ไม่พบ Role สำหรับ Ping: ${id}`);
      if (!role.mentionable && !permissions?.has(PermissionFlagsBits.MentionEveryone))
        throw new Error(`Role ${id} ไม่อนุญาตให้แท็ก บอทต้องมี Mention Everyone หรือเปิดให้แท็ก Role นี้ได้`);
    }
  }
  payload.allowedMentions = { parse: [], roles: [...ids] };
}
