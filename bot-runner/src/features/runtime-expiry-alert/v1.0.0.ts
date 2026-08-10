import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, MessageFlags, type GuildTextBasedChannel } from "discord.js";
import type { FeatureContext, FeatureModule } from "../../types.js";

const CHECK_INTERVAL_MS = 60_000;
const MILESTONES = [
  { key: "7D", configKey: "RUNTIME_ALERT_7D", milliseconds: 7 * 86_400_000, label: "7 วัน" },
  { key: "3D", configKey: "RUNTIME_ALERT_3D", milliseconds: 3 * 86_400_000, label: "3 วัน" },
  { key: "1D", configKey: "RUNTIME_ALERT_1D", milliseconds: 86_400_000, label: "1 วัน" },
  { key: "1H", configKey: "RUNTIME_ALERT_1H", milliseconds: 3_600_000, label: "1 ชั่วโมง" },
] as const;
type Destination = "DM" | "CHANNEL";
type DeliveryMode = Destination | "BOTH" | "DISABLED";
interface DeliveryState { periodKey: string; delivered: Record<string, Destination[]> }

export const runtimeExpiryAlertFeature: FeatureModule = {
  runtimeKey: "runtime-expiry-alert",
  version: "1.0.0",
  intents: ["Guilds"],
  async activate(context) {
    const mode = readMode(context.config.RUNTIME_ALERT_DELIVERY);
    const dmUserId = optionalSnowflake(context.config.RUNTIME_ALERT_DM_USER_ID, "RUNTIME_ALERT_DM_USER_ID");
    const channelId = optionalSnowflake(context.config.RUNTIME_ALERT_CHANNEL_ID, "RUNTIME_ALERT_CHANNEL_ID");
    const milestones = MILESTONES.filter((item) => readBoolean(context.config[item.configKey], true));
    let state = readState(context);
    let checking = false;
    let stopped = false;
    let timer: NodeJS.Timeout | undefined;

    const saveDelivery = async (milestone: string, destination: Destination) => {
      const destinations = new Set(state.delivered[milestone] ?? []);
      destinations.add(destination);
      state = { ...state, delivered: { ...state.delivered, [milestone]: [...destinations] } };
      await context.saveRuntimeState({ periodKey: state.periodKey, delivered: state.delivered });
    };

    const send = async (milestone: typeof MILESTONES[number], destination: Destination) => {
      if (state.delivered[milestone.key]?.includes(destination)) return;
      const payload = messagePayload(context, milestone.label);
      if (destination === "DM") {
        if (!dmUserId) throw new Error("DM delivery is enabled but RUNTIME_ALERT_DM_USER_ID is not configured");
        const user = await context.client.users.fetch(dmUserId).catch(() => null);
        if (!user) throw new Error(`DM recipient ${dmUserId} was not found`);
        await user.send(payload as never);
      } else {
        if (!channelId) throw new Error("Channel delivery is enabled but RUNTIME_ALERT_CHANNEL_ID is not configured");
        const channel = await context.client.channels.fetch(channelId).catch(() => null);
        if (!isSendableGuildChannel(channel) || (context.guildId && channel.guildId !== context.guildId)) {
          throw new Error(`Alert channel ${channelId} is unavailable or outside the configured guild`);
        }
        await channel.send(payload as never);
      }
      await saveDelivery(milestone.key, destination);
    };

    const check = async () => {
      if (checking || stopped || mode === "DISABLED") return;
      checking = true;
      try {
        const remaining = Date.parse(context.runtimeSubscription.currentPeriodEnd) - Date.now();
        if (!Number.isFinite(remaining) || remaining <= 0) return;
        const milestone = [...milestones].sort((a, b) => a.milliseconds - b.milliseconds)
          .find((item) => remaining <= item.milliseconds);
        if (!milestone) return;
        if (mode === "DM" || mode === "BOTH") await send(milestone, "DM").catch(logError(context, "DM"));
        if (mode === "CHANNEL" || mode === "BOTH") await send(milestone, "CHANNEL").catch(logError(context, "channel"));
      } finally {
        checking = false;
      }
    };

    context.client.once("clientReady", () => {
      if (stopped) return;
      void check().catch(logError(context, "initial check"));
      timer = setInterval(() => void check().catch(logError(context, "scheduled check")), CHECK_INTERVAL_MS);
      timer.unref();
    });
    return () => { stopped = true; if (timer) clearInterval(timer); };
  },
};

function readState(context: FeatureContext): DeliveryState {
  const periodKey = `${context.runtimeSubscription.id}:${context.runtimeSubscription.currentPeriodEnd}`;
  if (context.runtimeState.periodKey !== periodKey) {
    return { periodKey, delivered: {} };
  }
  const delivered: Record<string, Destination[]> = {};
  if (isRecord(context.runtimeState.delivered)) {
    for (const [key, value] of Object.entries(context.runtimeState.delivered)) {
      if (Array.isArray(value)) delivered[key] = value.filter((item): item is Destination => item === "DM" || item === "CHANNEL");
    }
  }
  return { periodKey, delivered };
}

function messagePayload(context: FeatureContext, remainingLabel: string) {
  const url = `https://fujipp.com/my-bot/${encodeURIComponent(context.botId)}/settings/runtime`;
  const values = {
    bot_name: context.client.user?.username ?? "Discord Bot",
    remaining: remainingLabel,
    expires_at: formatThaiDate(context.runtimeSubscription.currentPeriodEnd),
    auto_renew: context.runtimeSubscription.autoRenew ? "เปิดอยู่" : "ปิดอยู่",
    renew_url: url,
  };
  const raw = isRecord(context.presentations.expiry_alert) ? context.presentations.expiry_alert : null;
  if (raw?.mode === "COMPONENTS_V2" && Array.isArray(raw.components)) {
    return { flags: MessageFlags.IsComponentsV2, components: deepRender(raw.components, values), allowedMentions: { parse: [] } };
  }
  if (raw?.mode === "EMBED" && Array.isArray(raw.embeds)) {
    const links = Array.isArray(raw.links) ? raw.links.flatMap((item) => {
      if (!isRecord(item)) return [];
      const link = fill(String(item.url ?? ""), values);
      if (!/^https:\/\//.test(link)) return [];
      return [new ButtonBuilder().setStyle(ButtonStyle.Link).setURL(link).setLabel(fill(String(item.label ?? "เปิดลิงก์"), values)).setEmoji(fill(String(item.emoji ?? "🔗"), values))];
    }) : [];
    return { embeds: deepRender(raw.embeds, values), components: links.length ? [new ActionRowBuilder<ButtonBuilder>().addComponents(links)] : [], allowedMentions: { parse: [] } };
  }
  const embed = new EmbedBuilder().setColor(0x111111).setTitle("แจ้งเตือน Runtime ใกล้หมดอายุ")
    .setDescription("Runtime สำหรับบอทของคุณกำลังจะหมดอายุ กรุณาต่ออายุก่อนถึงกำหนดเพื่อให้บอททำงานต่อเนื่อง")
    .addFields(
      { name: "บอท", value: context.client.user?.username ?? "Discord Bot", inline: true },
      { name: "เหลือเวลา", value: remainingLabel, inline: true },
      { name: "หมดอายุ", value: formatThaiDate(context.runtimeSubscription.currentPeriodEnd), inline: false },
      { name: "ต่ออายุอัตโนมัติ", value: context.runtimeSubscription.autoRenew ? "เปิดอยู่" : "ปิดอยู่", inline: true },
    ).setFooter({ text: "Fujipp Runtime Service • การแจ้งเตือนอัตโนมัติ" }).setTimestamp();
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel("ตรวจสอบและต่ออายุ").setURL(url),
  );
  return { embeds: [embed], components: [row], allowedMentions: { parse: [] } };
}

function readMode(value: unknown): DeliveryMode {
  const mode = typeof value === "string" ? value.trim().toUpperCase() : "CHANNEL";
  if (mode === "DM" || mode === "CHANNEL" || mode === "BOTH" || mode === "DISABLED") return mode;
  throw new Error("RUNTIME_ALERT_DELIVERY must be DM, CHANNEL, BOTH, or DISABLED");
}
function optionalSnowflake(value: unknown, key: string): string | undefined {
  if (value == null || value === "") return undefined;
  const id = String(value).trim();
  if (!/^\d{15,30}$/.test(id)) throw new Error(`${key} must be a valid Discord ID`);
  return id;
}
function readBoolean(value: unknown, fallback: boolean): boolean { return typeof value === "boolean" ? value : fallback; }
function isRecord(value: unknown): value is Record<string, unknown> { return !!value && typeof value === "object" && !Array.isArray(value); }
function fill(value:string,values:Record<string,string>){return value.replace(/\{\{([a-z0-9_]+)}}/gi,(_,key:string)=>values[key]??"");}
function deepRender(value:unknown,values:Record<string,string>):unknown {if(typeof value==="string")return fill(value,values);if(Array.isArray(value))return value.map(item=>deepRender(item,values));if(isRecord(value))return Object.fromEntries(Object.entries(value).map(([key,item])=>[key,deepRender(item,values)]));return value;}
function isSendableGuildChannel(channel: unknown): channel is GuildTextBasedChannel {
  return !!channel && typeof channel === "object" && "isTextBased" in channel && typeof channel.isTextBased === "function"
    && channel.isTextBased() && "send" in channel && typeof channel.send === "function" && "guildId" in channel;
}
function formatThaiDate(value: string): string {
  return new Intl.DateTimeFormat("th-TH", { dateStyle: "long", timeStyle: "short", timeZone: "Asia/Bangkok" }).format(new Date(value));
}
function logError(context: FeatureContext, destination: string) {
  return (error: unknown) => console.error(`Runtime Expiry Alert ${destination} failed for bot ${context.botId}: ${error instanceof Error ? error.message : "Unknown error"}`);
}
