import { randomUUID } from "node:crypto";
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
  type ButtonInteraction,
  type ChatInputCommandInteraction,
  type Interaction,
} from "discord.js";
import type { FeatureContext, FeatureModule } from "../../types.js";
import { payout, type RobloxGroup } from "./roblox-client.js";

const COMMAND_NAME = "robux-payout-test";
const CONFIRM_PREFIX = "fujipp:robux-payout-test:confirm:";
const PENDING_MS = 5 * 60_000;

export const robloxPayoutTestFeature: FeatureModule = {
  runtimeKey: "roblox-payout-test",
  version: "1.0.0",
  intents: ["Guilds"],
  async activate(context) {
    const pending = new Map<string, { userId: string; expiresAt: number }>();
    let running = false;
    const onReady = () => void (async () => {
      if (!context.guildId) throw new Error("Discord guild ID is not configured");
      const guild = await context.client.guilds.fetch(context.guildId);
      await guild.commands.create(
      new SlashCommandBuilder()
        .setName(COMMAND_NAME)
        .setDescription("ทดสอบการโอน 1 Robux และอ่าน challenge จาก Roblox")
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .toJSON(),
      );
    })().catch((error: unknown) => void context.reportFeatureError("TEST_COMMAND_FAILED", error));
    const onInteraction = (interaction: Interaction) => {
      if (!interaction.inGuild() || (context.guildId && interaction.guildId !== context.guildId)) return;
      if (interaction.isChatInputCommand() && interaction.commandName === COMMAND_NAME) {
        void start(interaction).catch((error) => void context.reportFeatureError("TEST_START_FAILED", error));
      } else if (interaction.isButton() && interaction.customId.startsWith(CONFIRM_PREFIX)) {
        void confirm(interaction).catch((error) => void context.reportFeatureError("TEST_PAYOUT_FAILED", error));
      }
    };

    async function start(interaction: ChatInputCommandInteraction) {
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) return;
      const config = readConfig(context);
      if (!config) {
        await interaction.reply({ content: "ตั้งค่า Group ID, Recipient ID และ Roblox cookie ของ Feature ทดสอบก่อน", flags: MessageFlags.Ephemeral });
        return;
      }
      const id = randomUUID();
      pending.set(id, { userId: interaction.user.id, expiresAt: Date.now() + PENDING_MS });
      const button = new ButtonBuilder().setCustomId(`${CONFIRM_PREFIX}${id}`).setLabel("ยืนยันโอนทดสอบ 1 Robux").setStyle(ButtonStyle.Danger);
      await interaction.reply({
        content: `จะโอน **1 Robux** จากกลุ่ม **${config.group.groupId}** ให้ Roblox User ID **${config.recipientId}** จริง เพื่อตรวจ challenge ของ Roblox`,
        components: [new ActionRowBuilder<ButtonBuilder>().addComponents(button)],
        flags: MessageFlags.Ephemeral,
      });
    }

    async function confirm(interaction: ButtonInteraction) {
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) return;
      const id = interaction.customId.slice(CONFIRM_PREFIX.length);
      const request = pending.get(id);
      if (!request || request.userId !== interaction.user.id || request.expiresAt < Date.now()) {
        await interaction.reply({ content: "คำขอทดสอบหมดอายุหรือไม่ใช่ของคุณ", flags: MessageFlags.Ephemeral });
        return;
      }
      if (running) {
        await interaction.reply({ content: "มีรายการทดสอบกำลังทำงานอยู่", flags: MessageFlags.Ephemeral });
        return;
      }
      pending.delete(id);
      const config = readConfig(context);
      if (!config) {
        await interaction.update({ content: "การตั้งค่า Feature ทดสอบไม่ครบ", components: [] });
        return;
      }
      running = true;
      try {
        await interaction.update({ content: "กำลังส่งคำขอโอนทดสอบไปยัง Roblox…", components: [] });
        const result = await payout(config.group, config.recipientId, 1);
        const detail = result.ok
          ? "Roblox ยืนยันคำขอโอน 1 Robux สำเร็จ"
          : `${result.error.code}: ${result.error.message}`
            + (result.error.challengeStage ? `\nขั้นตอน: ${{ payout: "ส่งคำขอโอน", chef: "ยืนยัน chef", "2fa": "ยืนยัน 2FA" }[result.error.challengeStage]}` : "")
            + (result.error.status ? `\nHTTP ${result.error.status}` : "")
            + (result.error.challengeReason ? `\nรหัสเหตุผล Roblox: ${result.error.challengeReason}` : "")
            + (result.error.code === "ROBLOX_SESSION_BLOCKED"
              ? result.error.retryAfterSeconds
                ? `\nRoblox ระบุให้รออย่างน้อย ${result.error.retryAfterSeconds} วินาที`
                : "\nRoblox ไม่ได้ระบุเวลารอ Retry-After"
              : "")
            + (result.error.unknownOutcome ? "\nผลการโอนไม่แน่ชัด ตรวจประวัติ Roblox ก่อนทดสอบซ้ำ" : "");
        await interaction.editReply({ content: detail.slice(0, 1800), components: [], allowedMentions: { parse: [] } });
      } finally {
        running = false;
      }
    }

    context.client.once("clientReady", onReady);
    context.client.on("interactionCreate", onInteraction);
    return () => {
      context.client.off("clientReady", onReady);
      context.client.off("interactionCreate", onInteraction);
      pending.clear();
    };
  },
};

function readConfig(context: FeatureContext): { group: RobloxGroup; recipientId: number } | null {
  const groupId = Number(context.config.ROBLOX_TEST_GROUP_ID);
  const recipientId = Number(context.config.ROBLOX_TEST_RECIPIENT_ID);
  const cookie = String(context.secrets.ROBLOX_TEST_COOKIE ?? "").trim();
  const totpSecret = String(context.secrets.ROBLOX_TEST_TOTP_SECRET ?? "").trim();
  if (!Number.isSafeInteger(groupId) || groupId < 1 || !Number.isSafeInteger(recipientId) || recipientId < 1 || cookie.length < 20) return null;
  return { group: { groupId, cookie, ...(totpSecret ? { totpSecret } : {}) }, recipientId };
}
