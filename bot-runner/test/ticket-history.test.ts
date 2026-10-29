import assert from "node:assert/strict";
import test from "node:test";
import { Collection, type Message, type TextChannel } from "discord.js";
import { ticketArchive, ticketTranscript } from "../src/features/ticket/history.js";

function message(index: number) {
  return {
    id: String(100000000000000000n + BigInt(index)), createdAt: new Date(1790000000000 + index),
    author: { id: "222222222222222222", displayName: "Alice" }, editedTimestamp: null,
    content: `ข้อความที่ ${index} <script>alert(1)</script>`, reference: null,
    embeds: [{ title: "Order", description: "Product", fields: [{ name: "Quantity", value: "1" }], toJSON: () => ({ title: "Order", description: "Product" }) }],
    components: [{ toJSON: () => ({ type: 17, components: [{ type: 10, content: "Form response" }] }) }],
    attachments: new Collection([["file", { name: "receipt.png", url: "https://cdn.discordapp.com/attachments/1/2/receipt.png" }]]),
  } as unknown as Message;
}
function channel(count: number, contentBytes = 0) {
  const messages = Array.from({ length: count }, (_, index) => message(index + 1)).reverse();
  if (contentBytes) for (const item of messages) (item as any).content = "ก".repeat(contentBytes);
  const calls: any[] = [];
  const value = {
    id: "333333333333333333", name: "ticket-order",
    messages: { fetch: async (options: any) => {
      calls.push(options);
      const batch = messages.filter((item) => !options.before || BigInt(item.id) < BigInt(options.before)).slice(0, options.limit);
      return new Collection(batch.map((item) => [item.id, item]));
    } },
  } as unknown as TextChannel;
  return { value, calls };
}
test("exports paginated messages chronologically with author IDs, forms and attachments", async () => {
  const f = channel(105);
  const result = await ticketTranscript(f.value);
  assert.equal(result.count, 105); assert.equal(result.truncated, false);
  assert.equal(f.calls.length, 2); assert.equal(f.calls[1].before, message(6).id);
  const text = result.attachment.toString("utf8");
  assert.ok(text.indexOf("ข้อความที่ 1 ") < text.indexOf("ข้อความที่ 105 "));
  assert.match(text, /Alice \(222222222222222222\)/);
  assert.match(text, /Form response/); assert.match(text, /receipt.png/);
});
test("clearly marks exports that exceed the message or byte limits", async () => {
  const countLimit = await ticketTranscript(channel(2001).value);
  assert.equal(countLimit.count, 2000); assert.equal(countLimit.truncated, true);
  assert.match(countLimit.attachment.toString("utf8"), /PARTIAL EXPORT/);
  const byteLimit = await ticketTranscript(channel(1500, 4000).value);
  assert.ok(byteLimit.count < 1500); assert.equal(byteLimit.truncated, true);
  assert.ok(byteLimit.attachment.length < 6 * 1024 * 1024);
});
test("permission failures do not produce misleading empty exports and cleanup cancels work", async () => {
  const f = channel(0);
  (f.value.messages as any).fetch = async () => { throw Error("No read permission"); };
  await assert.rejects(ticketTranscript(f.value), /No read permission/);
  await assert.rejects(ticketTranscript(channel(1).value, () => true), /cancelled/);
});

test("archives complete paginated conversations as message data and refuses truncated deletion", async () => {
  const f = channel(105);
  const result = await ticketArchive(f.value);
  assert.equal(result.length, 105);
  assert.equal(result[0]!.id, message(1).id);
  assert.equal(result[104]!.id, message(105).id);
  assert.match(JSON.stringify(result), /Form response/);
  await assert.rejects(ticketArchive(channel(10001).value), /10,000/);
  await assert.rejects(ticketArchive(channel(1500, 4000).value), /10 MiB/);
  await assert.rejects(ticketArchive(channel(1).value, () => true), /cancelled/);
});
