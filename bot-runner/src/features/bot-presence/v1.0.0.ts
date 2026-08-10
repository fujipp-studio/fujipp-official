import {
  ActivityType,
  type PresenceStatusData,
} from "discord.js";
import type { FeatureModule } from "../../types.js";

const DEFAULT_ROTATE_SECONDS = 30;
const MIN_ROTATE_SECONDS = 20;
const MAX_ROTATE_SECONDS = 86_400;
const MAX_TEXTS = 20;
const MAX_TEXT_LENGTH = 128;

const ACTIVITY_TYPES: Readonly<Record<string, ActivityType>> = {
  WATCHING: ActivityType.Watching,
  PLAYING: ActivityType.Playing,
  LISTENING: ActivityType.Listening,
  COMPETING: ActivityType.Competing,
};

const STATUSES = new Set<PresenceStatusData>(["online", "idle", "dnd", "invisible"]);

export const botPresenceFeature: FeatureModule = {
  runtimeKey: "bot-presence",
  version: "1.0.0",
  intents: [],
  async activate(context) {
    const status = readStatus(context.config.PRESENCE_STATUS);
    const activityType = readActivityType(context.config.PRESENCE_ACTIVITY_TYPE);
    const texts = readTexts(context.config.PRESENCE_TEXTS);
    const rotateSeconds = readRotateSeconds(context.config.PRESENCE_ROTATE_SECONDS);
    let timer: NodeJS.Timeout | undefined;

    const apply = (text?: string) => {
      context.client.user?.setPresence({
        status,
        activities: text ? [{ name: text, type: activityType }] : [],
      });
    };

    const onReady = () => {
      if (texts.length === 0) {
        apply();
        console.info(`Bot presence active: bot ${context.botId}, status ${status}, no activity`);
        return;
      }

      let index = 0;
      apply(texts[index]);
      console.info(
        `Bot presence active: bot ${context.botId}, status ${status}, activities ${texts.length}`,
      );
      if (texts.length === 1) return;

      timer = setInterval(() => {
        index = (index + 1) % texts.length;
        apply(texts[index]);
      }, rotateSeconds * 1_000);
      timer.unref();
    };

    context.client.once("clientReady", onReady);
    return () => {
      context.client.off("clientReady", onReady);
      if (timer) clearInterval(timer);
    };
  },
};

function readStatus(value: unknown): PresenceStatusData {
  const status = typeof value === "string" ? value.trim().toLowerCase() : "online";
  if (!STATUSES.has(status as PresenceStatusData)) {
    throw new Error("PRESENCE_STATUS must be online, idle, dnd or invisible");
  }
  return status as PresenceStatusData;
}

function readActivityType(value: unknown): ActivityType {
  const key = typeof value === "string" ? value.trim().toUpperCase() : "WATCHING";
  const activityType = ACTIVITY_TYPES[key];
  if (activityType === undefined) {
    throw new Error("PRESENCE_ACTIVITY_TYPE must be WATCHING, PLAYING, LISTENING or COMPETING");
  }
  return activityType;
}

function readTexts(value: unknown): string[] {
  const values = Array.isArray(value) ? value : typeof value === "string" ? [value] : [];
  const texts = values.map((text) => typeof text === "string" ? text.trim() : "").filter(Boolean);
  if (texts.length > MAX_TEXTS) throw new Error(`PRESENCE_TEXTS supports at most ${MAX_TEXTS} items`);
  if (texts.some((text) => text.length > MAX_TEXT_LENGTH)) {
    throw new Error(`Each presence text must contain at most ${MAX_TEXT_LENGTH} characters`);
  }
  return texts;
}

function readRotateSeconds(value: unknown): number {
  const seconds = value === undefined ? DEFAULT_ROTATE_SECONDS : Number(value);
  if (!Number.isInteger(seconds) || seconds < MIN_ROTATE_SECONDS || seconds > MAX_ROTATE_SECONDS) {
    throw new Error(
      `PRESENCE_ROTATE_SECONDS must be an integer from ${MIN_ROTATE_SECONDS} to ${MAX_ROTATE_SECONDS}`,
    );
  }
  return seconds;
}
