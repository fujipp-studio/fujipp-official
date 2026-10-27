import { MessageFlags, type APIEmbed, type RepliableInteraction } from "discord.js";

const features = {
  "member-spending": ["Member Spending Card", "ตรวจสอบการตั้งค่าฐานข้อมูลและสิทธิ์จัดการยศของบอท หากยอดถูกบันทึกแล้ว อย่าเพิ่มรายการเดิมซ้ำ"],
  "message-sets": ["Message Sets", "ตรวจสอบ SET, Message ID, ดีไซน์ และสิทธิ์ส่งข้อความของบอท"],
  "shop-status": ["Shop Status", "ตรวจสอบห้องประกาศและสิทธิ์จัดการห้อง ส่งข้อความ และแนบ Embed ของบอท"],
  "review-credit": ["Review Credit", "ตรวจสอบห้องรีวิว สิทธิ์อ่านข้อความย้อนหลัง และสิทธิ์จัดการห้องหรือยศของบอท"],
  "voice-keeper": ["Voice Keeper", "ตรวจสอบห้องเสียงและสิทธิ์ View Channel / Connect ของบอท"],
  "admin-message-tools": ["Admin Message Tools", "ตรวจสอบห้องหรือผู้รับ Message ID และสิทธิ์ส่งหรือแก้ไขข้อความของบอท"],
  "role-shop": ["Role Shop", "ตรวจสอบยอดเงินใน Wallet และสิทธิ์ Manage Roles ของบอท"],
  "wallet-topup": ["Wallet Top-up", "ตรวจสอบสถานะรายการและประวัติกระเป๋าเงินก่อนทำรายการซ้ำ หากยังมีปัญหาให้ติดต่อผู้ดูแลร้าน"],
  "roblox-robux-payout": ["Robux Payout", "ตรวจสอบสถานะคำสั่งซื้อและประวัติการโอนก่อนทำรายการซ้ำ หรือติดต่อผู้ดูแลร้าน"],
  "roblox-payout-test": ["Roblox Payout Test", "ตรวจสอบการตั้งค่ากลุ่ม บัญชี Roblox และประวัติการโอนก่อนทดสอบซ้ำ"],
  "price-reader": ["Price Reader", "ตรวจสอบว่ารูปอ่านราคาได้ชัดเจนและมีราคาเป็นเงินบาท แล้วส่งรูปใหม่"],
  "payment-trigger": ["Payment Trigger", "ตรวจสอบยอดเงิน วิธีชำระเงิน ดีไซน์ และสิทธิ์ส่งข้อความของบอท"],
  "channel-message-triggers": ["Channel Message Triggers", "ตรวจสอบกฎ Trigger, ดีไซน์ และสิทธิ์ส่งข้อความในห้องปลายทาง"],
} as const;

export type ErrorFeature = keyof typeof features;
export interface FeatureErrorOptions {
  code?: string;
  title?: string;
  hint?: string;
  warning?: boolean;
  followUp?: boolean;
}

/** Only user-facing details belong in Discord; stacks and credentials stay out. */
export function safeErrorText(value: string, limit = 1800): string {
  return value
    .split(/\n\s*at /, 1)[0]!
    .replace(/postgres(?:ql)?:\/\/[^\s<>"']+/gi, "[database connection]")
    .replace(/(https?:\/\/)[^\s/@]+:[^\s/@]+@/gi, "$1[credentials]@")
    .replace(/\b(Bearer|Bot)\s+[A-Za-z0-9._-]{20,}/gi, "$1 [redacted]")
    .replace(/\b[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{6,}\.[A-Za-z0-9_-]{20,}\b/g, "[redacted]")
    .replace(/((?:password|token|secret|cookie|authorization|api[_-]?key)\s*[=:]\s*)[^\s,;]+/gi, "$1[redacted]")
    .replace(/([?&](?:key|token|secret|password|api[_-]?key)=)[^\s&#]+/gi, "$1[redacted]")
    .slice(0, limit);
}

export function featureErrorPayload(feature: ErrorFeature, error: unknown, options: FeatureErrorOptions = {}) {
  const detail = typeof error === "string" ? error : error instanceof Error ? error.message : "ระบบเกิดข้อผิดพลาด กรุณาตรวจสอบการตั้งค่าหรือติดต่อผู้ดูแล";
  const rawCode = options.code ?? (error && typeof error === "object" && "code" in error ? String(error.code) : error instanceof Error && error.name === "GatewayRateLimitError" ? "DISCORD_RATE_LIMITED" : "FEATURE_OPERATION_FAILED");
  const code = rawCode.replace(/[^a-z0-9_-]/gi, "_").slice(0, 64) || "FEATURE_OPERATION_FAILED";
  const discordHint = code === "50013" || code === "50001"
    ? "บอทไม่มีสิทธิ์เข้าถึงหรือทำรายการ ตรวจสอบสิทธิ์ในห้องและลำดับยศของบอท"
    : code === "50035" ? "ตรวจสอบดีไซน์ Embed / Components และค่าที่ส่งให้ Discord"
    : code === "DISCORD_RATE_LIMITED" || code === "429" ? "Discord จำกัดคำขอชั่วคราว กรุณารอสักครู่แล้วตรวจสอบผลอีกครั้ง" : undefined;
  const embed: APIEmbed = {
    color: options.warning ? 0xfee75c : 0xed4245,
    title: `${features[feature][0]} • ${options.title ?? "ทำรายการไม่สำเร็จ"}`.slice(0, 256),
    description: safeErrorText(detail).trim() || "ระบบเกิดข้อผิดพลาด กรุณาติดต่อผู้ดูแล",
    fields: [
      { name: "รหัสข้อผิดพลาด", value: code, inline: true },
      { name: "คำแนะนำ", value: safeErrorText(options.hint ?? discordHint ?? features[feature][1], 1024) },
    ],
  };
  return { embeds: [embed], components: [] as [], allowedMentions: { parse: [] as [] } };
}

/** Acknowledge privately, or replace an existing response without stale controls. */
export async function replyFeatureError(interaction: RepliableInteraction, feature: ErrorFeature, error: unknown, options: FeatureErrorOptions = {}): Promise<void> {
  const payload = featureErrorPayload(feature, error, options);
  const privatePayload = { ...payload, flags: MessageFlags.Ephemeral as const };
  try {
    if (!interaction.deferred && !interaction.replied) await interaction.reply(privatePayload);
    else if (options.followUp) await interaction.followUp(privatePayload);
    else {
      try { await interaction.editReply({ ...payload, content: null }); }
      // Discord cannot convert a Components V2 response into an Embed.
      catch { await interaction.followUp(privatePayload); }
    }
  } catch { /* A deleted message or expired interaction cannot receive an error. */ }
}
