import { randomBytes } from 'node:crypto';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, MessageFlags, type Attachment, type Interaction, type Message } from 'discord.js';
import type { FeatureContext } from '../../types.js';
import type { ImageResult } from './results.js';
import { parseCountedGeminiPrice, readCountedGeminiResult } from './counted-pricing.js';
import { priceReaderResultPayload } from './v1.0.0.js';

export const countChoiceTtlMs = 5 * 60_000;
export function createCountChoices(context: FeatureContext) {
  const en = context.config.PRICE_READER_LANGUAGE === 'EN';
  const text = (english: string, thai: string) => en ? english : thai;
  const prefix = `pr32:${context.installationId}:`;
  type Session = { owner: string; source: Message; prompt: Message; results: ImageResult[]; images: Attachment[]; timer: ReturnType<typeof setTimeout>; busy: boolean; expiresAt: number };
  const sessions = new Map<string, Session>();
  let stopped = false;
  const first = (session: Session) => session.results.findIndex(row => Boolean(row.pending_read));
  const expired = () => ({ embeds: [{ description: text('This selection expired or was cancelled. Send the screenshot again.', 'รายการเลือกหมดอายุหรือถูกยกเลิก กรุณาส่งรูปอีกครั้ง'), color: 0x5865f2 }], components: [], allowedMentions: { parse: [] as [] } });
  const close = async (token: string, session: Session) => {
    clearTimeout(session.timer); sessions.delete(token);
    await session.prompt.edit(expired()).catch(() => undefined);
  };
  function prompt(token: string, session: Session) {
    const index = first(session);
    const data = parseCountedGeminiPrice(JSON.parse(session.results[index]!.pending_read!));
    const counts = data.itemType === 'BUNDLE' ? [2, 3, 4, 5] : [1, 2, 3, 4, 5];
    const menu = new StringSelectMenuBuilder().setCustomId(`${prefix}${token}:count:${index}`)
      .setPlaceholder(text('Choose included item count', 'เลือกจำนวนสินค้าที่รวมอยู่')).setMinValues(1).setMaxValues(1)
      .addOptions(counts.map(count => ({ label: count === 1 ? text('Single item', 'ชิ้นเดียว') : text(`Bundle · ${count} items`, `บันเดิล ${count} ชิ้น`), value: String(count) })));
    return {
      embeds: [{ title: text(`Image ${index + 1}: how many included items?`, `รูปที่ ${index + 1}: รวมสินค้ากี่ชิ้น?`),
        description: text('The screenshot does not show a clear item count. Select the products included in this one purchase. Prices will be matched after you choose.', 'รูปยังระบุจำนวนชิ้นไม่ชัด เลือกจำนวนสินค้าที่ขายรวมกันในการซื้อครั้งนี้ แล้วบอทจึงจับคู่ราคารับกด'),
        footer: { text: text('Only the sender can choose · expires 5 minutes after the first prompt', 'เฉพาะผู้ส่งรูปเท่านั้น · หมดอายุ 5 นาทีหลังเริ่มรายการ') },
        image: { url: session.images[index]!.url }, color: 0x5865f2 }],
      components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu).toJSON(),
        new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder().setCustomId(`${prefix}${token}:cancel`).setLabel(text('Cancel', 'ยกเลิก')).setStyle(ButtonStyle.Secondary)).toJSON()],
      allowedMentions: { parse: [] as [] },
    };
  }
  async function onInteraction(interaction: Interaction) {
    if ((!interaction.isStringSelectMenu() && !interaction.isButton()) || !interaction.customId.startsWith(prefix)) return;
    const [token, action, imageIndex] = interaction.customId.slice(prefix.length).split(':');
    const session = token ? sessions.get(token) : undefined;
    const reply = (message: string) => interaction.reply({ content: message, flags: MessageFlags.Ephemeral, allowedMentions: { parse: [] } }).catch(() => undefined);
    if (!session || stopped || Date.now() >= session.expiresAt) { await reply(text('Selection expired. Send the image again.', 'รายการเลือกหมดอายุ กรุณาส่งรูปอีกครั้ง')); return; }
    if (interaction.user.id !== session.owner || interaction.message.id !== session.prompt.id || interaction.channelId !== session.source.channelId || interaction.guildId !== session.source.guildId) {
      await reply(text('Only the person who sent these images can choose.', 'เฉพาะผู้ส่งรูปนี้เท่านั้นที่เลือกได้')); return;
    }
    if (session.busy) { await reply(text('Processing your selection…', 'กำลังประมวลผลรายการที่เลือก…')); return; }
    const index = first(session);
    const data = index >= 0 ? parseCountedGeminiPrice(JSON.parse(session.results[index]!.pending_read!)) : null;
    const count = interaction.isStringSelectMenu() && interaction.values.length === 1 ? Number(interaction.values[0]) : NaN;
    if (action !== 'cancel' && (action !== 'count' || imageIndex !== String(index) || !data || !Number.isInteger(count) || count < (data.itemType === 'BUNDLE' ? 2 : 1) || count > 5)) {
      await reply(text('Choose a valid item count.', 'กรุณาเลือกจำนวนชิ้นที่ถูกต้อง')); return;
    }
    session.busy = true;
    try {
      await interaction.deferUpdate();
      if (stopped || !sessions.has(token!) || Date.now() >= session.expiresAt) return;
      if (action === 'cancel') { await close(token!, session); return; }
      session.results[index] = readCountedGeminiResult(data, context.config, count);
      if (first(session) >= 0) await session.prompt.edit(prompt(token!, session));
      else {
        clearTimeout(session.timer); sessions.delete(token!);
        const payload = priceReaderResultPayload(context, session.results, '3.2.0');
        await session.prompt.edit({ content: null, embeds: [], ...payload, allowedMentions: { parse: [] } });
      }
    } catch {
      await close(token!, session);
      void context.reportFeatureError('PRICE_READER_SELECTION_FAILED', new Error('Unable to update item count selection'), { recoverable: true }).catch(() => undefined);
    } finally { session.busy = false; }
  }
  const listener = (interaction: Interaction) => { void onInteraction(interaction).catch(() => undefined); };
  context.client.on('interactionCreate', listener);
  return {
    async handleResults(source: Message, processing: Message, results: ImageResult[], images: Attachment[]): Promise<boolean> {
      if (!results.some(row => row.pending_read)) return false;
      if (stopped) { await processing.delete().catch(() => undefined); return true; }
      if (sessions.size >= 30) {
        await source.reply({ content: text('Too many pending selections. Try again later.', 'มีรายการรอเลือกจำนวนมาก กรุณาลองภายหลัง'), allowedMentions: { parse: [] } });
        await processing.delete().catch(() => undefined); return true;
      }
      const token = randomBytes(12).toString('hex');
      const session = { owner: source.author.id, source, prompt: processing, results, images, busy: false, expiresAt: Date.now() + countChoiceTtlMs } as Session;
      // A separate ordinary message avoids converting an existing Components V2 processing message back to an Embed.
      session.prompt = await source.reply(prompt(token, session));
      if (stopped) { await session.prompt.edit(expired()).catch(() => undefined); await processing.delete().catch(() => undefined); return true; }
      session.timer = setTimeout(() => { void close(token, session); }, countChoiceTtlMs);
      session.timer.unref(); sessions.set(token, session);
      await processing.delete().catch(() => undefined);
      return true;
    },
    async stop() {
      stopped = true; context.client.off('interactionCreate', listener);
      await Promise.allSettled([...sessions].map(([token, session]) => close(token, session)));
    },
  };
}
