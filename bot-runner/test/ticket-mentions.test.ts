import assert from "node:assert/strict";
import test from "node:test";
import { PermissionFlagsBits, type TextChannel } from "discord.js";
import { sendTicketOpeningMentions } from "../src/features/ticket/mentions.js";
import { readTicketOpeningMentions, type TicketCategory } from "../src/features/ticket/config.js";

const opener = "111111111111111111", role = "222222222222222222", user = "333333333333333333", guildId = "444444444444444444";
function fixture() {
  const sent: any[] = [];
  let mentionable = true, canMention = false, accessible = true, roleExists = true;
  const channel = {
    guild: { id: guildId, members: { me: { id: "bot" }, fetch: async ({ user }: { user: string }) => ({ id: user }) },
      roles: { fetch: async (id: string) => roleExists ? { id, mentionable } : null } },
    permissionsFor: (recipient: { id: string }) => ({ has: (flag: bigint) => flag === PermissionFlagsBits.MentionEveryone ? canMention : recipient.id === "bot" || accessible }),
    send: async (payload: unknown) => { sent.push(payload); },
  } as unknown as TextChannel;
  const topic = { openingMentions: { enabled: true, opener: true, roleIds: [role], userIds: [user, opener] } } as TicketCategory;
  return { sent, channel, topic, permission: (options: { mentionable?: boolean; canMention?: boolean; accessible?: boolean; roleExists?: boolean }) => {
    mentionable = options.mentionable ?? mentionable; canMention = options.canMention ?? canMention;
    accessible = options.accessible ?? accessible; roleExists = options.roleExists ?? roleExists;
  } };
}

test("Ticket opening pings are opt-in and disabled/empty settings do not fetch Discord recipients", async () => {
  for (const openingMentions of [undefined, { enabled: false, opener: true, roleIds: [role], userIds: [] }, { enabled: true, opener: false, roleIds: [], userIds: [] }])
    await sendTicketOpeningMentions({} as TextChannel, { openingMentions } as TicketCategory, opener);
});

test("pings only configured recipients once, deduplicating the opener without parsing other mentions", async () => {
  const f = fixture();
  await sendTicketOpeningMentions(f.channel, f.topic, opener);
  assert.deepEqual(f.sent, [{ content: `<@&${role}> <@${user}> <@${opener}>`, allowedMentions: { parse: [], roles: [role], users: [user, opener], repliedUser: false } }]);
});

test("role ping requires mentionability or Mention Everyone and never mentions the everyone role", async () => {
  const f = fixture(); f.permission({ mentionable: false });
  await assert.rejects(sendTicketOpeningMentions(f.channel, f.topic, opener), /Mention Everyone/);
  assert.equal(f.sent.length, 0);
  f.permission({ canMention: true });
  await sendTicketOpeningMentions(f.channel, f.topic, opener);
  assert.equal(f.sent.length, 1);
  f.topic.openingMentions!.roleIds = [guildId];
  await assert.rejects(sendTicketOpeningMentions(f.channel, f.topic, opener), /ไม่พบ Role/);
  assert.equal(f.sent.length, 1);
});

test("all recipients must exist and be able to view the ticket before any ping is sent", async () => {
  const f = fixture(); f.permission({ roleExists: false });
  await assert.rejects(sendTicketOpeningMentions(f.channel, f.topic, opener), /ไม่พบ Role/);
  f.permission({ roleExists: true, accessible: false });
  await assert.rejects(sendTicketOpeningMentions(f.channel, f.topic, opener), /ไม่มีสิทธิ์ดูห้อง/);
  f.topic.openingMentions!.roleIds = [];
  await assert.rejects(sendTicketOpeningMentions(f.channel, f.topic, opener), /ไม่มีสิทธิ์ดูห้อง/);
  assert.equal(f.sent.length, 0);
});

test("rejects malformed, duplicate and excessive recipients even when pings are off", () => {
  assert.equal(readTicketOpeningMentions(undefined).enabled, false);
  const valid = { enabled: false, opener: false, roleIds: [role], userIds: [user] };
  assert.deepEqual(readTicketOpeningMentions(valid), valid);
  for (const invalid of [null, {}, { ...valid, enabled: "true" }, { ...valid, opener: 1 }, { ...valid, roleIds: [role, role] },
    { ...valid, userIds: ["invalid"] }, { ...valid, roleIds: Array.from({ length: 11 }, (_, i) => String(BigInt(role) + BigInt(i))) },
    { ...valid, userIds: Array.from({ length: 26 }, (_, i) => String(BigInt(user) + BigInt(i))) }])
    assert.throws(() => readTicketOpeningMentions(invalid));
});
