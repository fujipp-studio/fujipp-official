import type { Message, TextChannel } from "discord.js";

const MAX_MESSAGES = 2000;
const MAX_BYTES = 5 * 1024 * 1024;
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);

function componentText(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!record(item)) return [];
    return [...(item.type === 10 && typeof item.content === "string" ? [item.content] : []), ...componentText(item.components)];
  });
}
export function transcriptMessage(message: Message): string {
  const lines = [`[${message.createdAt.toISOString()}] ${message.author.displayName ?? message.author.username} (${message.author.id})${message.editedTimestamp ? " [edited]" : ""}`];
  if (message.reference?.messageId) lines.push(`Reply to: ${message.reference.messageId}`);
  if (message.content) lines.push(message.content);
  for (const embed of message.embeds) {
    if (embed.title) lines.push(embed.title);
    if (embed.description) lines.push(embed.description);
    for (const field of embed.fields) lines.push(`${field.name}: ${field.value}`);
    if (embed.footer?.text) lines.push(embed.footer.text);
  }
  lines.push(...componentText(message.components.map((item) => item.toJSON())));
  for (const file of message.attachments.values()) lines.push(`File: ${file.name}\n${file.url}`);
  return lines.join("\n");
}

/** Bounded private export; the web reader supports paging through the full retained history. */
export async function ticketTranscript(channel: Pick<TextChannel, "id" | "name" | "messages">, cancelled: () => boolean = () => false) {
  const entries: Array<{ id: string; body: string }> = [];
  let before: string | undefined;
  let bytes = 0;
  let truncated = false;
  while (entries.length < MAX_MESSAGES && !cancelled()) {
    const page = await channel.messages.fetch({ limit: Math.min(100, MAX_MESSAGES - entries.length), ...(before ? { before } : {}), cache: false });
    if (!page.size) break;
    const ordered = [...page.values()].sort((a, b) => BigInt(a.id) > BigInt(b.id) ? -1 : 1);
    for (const message of ordered) {
      const body = transcriptMessage(message);
      bytes += Buffer.byteLength(body, "utf8") + 2;
      if (bytes > MAX_BYTES) { truncated = true; break; }
      entries.push({ id: message.id, body });
    }
    const oldest = ordered.at(-1)!.id;
    if (truncated || oldest === before) { truncated = true; break; }
    before = oldest;
    if (page.size < 100) break;
    if (entries.length === MAX_MESSAGES) {
      truncated = (await channel.messages.fetch({ limit: 1, before, cache: false })).size > 0;
    }
  }
  if (cancelled()) throw new Error("Ticket history export cancelled");
  entries.sort((a, b) => BigInt(a.id) < BigInt(b.id) ? -1 : 1);
  const header = ["Ticket conversation history", `Channel: #${channel.name} (${channel.id})`, `Exported: ${new Date().toISOString()}`, `Messages: ${entries.length}`, "Times use UTC.",
    ...(truncated ? ["PARTIAL EXPORT: only the most recent messages within 2000 messages / 5 MiB. Read earlier history on the bot management website."] : []), ""];
  return { attachment: Buffer.from([...header, ...entries.map((item) => item.body)].join("\n\n"), "utf8"), count: entries.length, truncated };
}

/** Complete bounded archive. Refuse channel deletion when a complete snapshot cannot be saved. */
export async function ticketArchive(channel: Pick<TextChannel, "messages">, cancelled: () => boolean = () => false) {
  const entries: Record<string, unknown>[] = [];
  let before: string | undefined;
  let bytes = 2;
  while (!cancelled()) {
    const page = await channel.messages.fetch({ limit: 100, ...(before ? { before } : {}), cache: false });
    if (!page.size) break;
    const ordered = [...page.values()].sort((a,b) => BigInt(a.id) > BigInt(b.id) ? -1 : 1);
    for (const message of ordered) {
      const entry = {
        id: message.id, content: message.content, timestamp: message.createdAt.toISOString(),
        edited_timestamp: message.editedAt?.toISOString() ?? null,
        author: { id: message.author.id, username: message.author.username, global_name: message.author.displayName, bot: message.author.bot },
        member: { nick: message.member?.displayName },
        message_reference: { message_id: message.reference?.messageId },
        embeds: message.embeds.map(e => e.toJSON()), components: message.components.map(c => c.toJSON()),
        attachments: [...message.attachments.values()].map(a => ({ filename: a.name, url: a.url })),
      };
      bytes += Buffer.byteLength(JSON.stringify(entry), "utf8") + 1;
      if (entries.length >= 10000 || bytes > 10 * 1024 * 1024)
        throw new Error("เก็บประวัติเกินขีดจำกัด 10,000 ข้อความ / 10 MiB จึงยังไม่ลบห้อง กรุณาให้ผู้ดูแลส่งออกประวัติก่อน");
      entries.push(entry);
    }
    const next = ordered.at(-1)!.id;
    if (before && BigInt(next) >= BigInt(before)) throw new Error("อ่านประวัติไม่ครบ จึงยังไม่ลบห้อง");
    before = next;
    if (page.size < 100) break;
  }
  if (cancelled()) throw new Error("Ticket archive cancelled");
  return entries.reverse();
}
