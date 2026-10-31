import { PermissionFlagsBits, type TextChannel } from "discord.js";
import { readTicketOpeningMentions, type TicketCategory } from "./config.js";

export async function sendTicketOpeningMentions(channel: TextChannel, topic: TicketCategory, openerId: string): Promise<void> {
  const mentions = readTicketOpeningMentions(topic.openingMentions);
  if (!mentions.enabled) return;
  const roles = mentions.roleIds;
  const users = [...new Set([...mentions.userIds, ...(mentions.opener ? [openerId] : [])])];
  if (!roles.length && !users.length) return;
  const guild = channel.guild;
  const bot = guild.members.me ?? await guild.members.fetchMe();
  const canMention = channel.permissionsFor(bot).has(PermissionFlagsBits.MentionEveryone);
  // Validate every recipient before sending. Pinging never grants channel access.
  for (const id of roles) {
    const role = await guild.roles.fetch(id);
    if (!role || id === guild.id) throw new Error(`ไม่พบ Role สำหรับ Ping: ${id}`);
    if (!channel.permissionsFor(role)?.has(PermissionFlagsBits.ViewChannel))
      throw new Error(`Role ${id} ไม่มีสิทธิ์ดูห้อง Ticket`);
    if (!role.mentionable && !canMention)
      throw new Error(`Role ${id} ไม่อนุญาตให้แท็ก บอทต้องมี Mention Everyone หรือเปิดให้แท็ก Role นี้ได้`);
  }
  for (const id of users) {
    const member = await guild.members.fetch({ user: id, force: true });
    if (!channel.permissionsFor(member).has(PermissionFlagsBits.ViewChannel))
      throw new Error(`ผู้ใช้ ${id} ไม่มีสิทธิ์ดูห้อง Ticket`);
  }
  await channel.send({
    content: [...roles.map(id => `<@&${id}>`), ...users.map(id => `<@${id}>`)].join(" "),
    allowedMentions: { parse: [], roles, users, repliedUser: false },
  });
}
