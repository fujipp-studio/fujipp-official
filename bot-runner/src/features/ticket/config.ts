export interface TicketField {
  key: string;
  label: string;
  style: "SHORT" | "PARAGRAPH";
  required: boolean;
  placeholder: string;
}
export interface TicketCategory {
  key: string;
  label: string;
  description: string;
  emoji?: string;
  channelNameTemplate?: string;
  welcome?: { title: string; description: string; imageUrl: string };
  categoryId: string;
  supportRoleIds: string[];
  autoCloseMinutes: number;
  autoCloseMode: "IDLE" | "OPENED";
  formEnabled: boolean;
  formTitle: string;
  fields: TicketField[];
}
const idPattern = /^\d{15,30}$/;
const keyPattern = /^[a-z0-9_-]{1,32}$/;
const record = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);
const text = (value: unknown, max: number, empty = false): value is string =>
  typeof value === "string" && value.length <= max && (empty || !!value.trim());

export type TicketDelivery = "OFF" | "COMMAND" | "BUTTON" | "BOTH";
export type TicketAction = "close" | "schedule" | "autoClose" | "addUser" | "history";
export type TicketActions = Record<TicketAction, TicketDelivery>;
export const defaultTicketActions: TicketActions = { close: "BOTH", schedule: "OFF", autoClose: "BOTH", addUser: "BOTH", history: "BOTH" };
export function readTicketActions(value: unknown): TicketActions {
  if (value === undefined) return { ...defaultTicketActions };
  if (!record(value) || Object.keys(value).some(key => !Object.hasOwn(defaultTicketActions,key))
    || Object.values(value).some(mode => typeof mode !== "string" || !["OFF", "COMMAND", "BUTTON", "BOTH"].includes(mode))) throw new Error("Invalid Ticket command/button options");
  return { ...defaultTicketActions, ...value } as TicketActions;
}
export const ticketActionEnabled = (actions: TicketActions, action: TicketAction, via: "COMMAND" | "BUTTON") => actions[action] === "BOTH" || actions[action] === via;
export interface TicketBehavior { controlStyle?: "MANAGE" | "DIRECT"; actions?: Partial<TicketActions>; maxOpenPerUser: number; confirmClose: boolean; closeRoleIds: string[]; closeUserIds: string[]; }
export const defaultTicketBehavior: TicketBehavior = { maxOpenPerUser: 1, confirmClose: true, closeRoleIds: [], closeUserIds: [] };
export const validTicketEmoji = (value: unknown) => typeof value === "string" && (value === "" || /^<a?:[A-Za-z0-9_]{2,32}:\d{15,30}>$/.test(value) || (/^(?:\p{Regional_Indicator}{2}|[#*0-9]\uFE0F?\u20E3|\p{Extended_Pictographic}(?:\uFE0F|\p{Emoji_Modifier})?(?:\u200D\p{Extended_Pictographic}(?:\uFE0F|\p{Emoji_Modifier})?)*)$/u.test(value) && value.length <= 32));
export const validTicketName = (value: unknown) => text(value, 100) && !/[\p{Cc}\p{Cf}/\\]/u.test(value) && !/[{}]/.test(value.replace(/\{\{(username|user_id|topic|id)\}\}/g, ""));
export function ticketChannelName(template: string | undefined, category: string, user: { id: string; username: string }, ticketId: string) {
  const vars: Record<string, string> = { username: user.username, user_id: user.id, topic: category, id: ticketId };
  const value = (template ?? "ticket-{{topic}}-{{id}}")
    .replace(/\{\{(username|user_id|topic|id)\}\}/g, (_, key: string) => vars[key]!)
    .normalize("NFKC").replace(/[\p{Cc}\p{Cf}/\\#@]/gu, "").trim().replace(/\s+/g, "-").toLowerCase();
  return Array.from(value || `ticket-${ticketId}`).slice(0, 100).join("");
}
export function readTicketBehavior(value: unknown): TicketBehavior {
  if (value === undefined) return { ...defaultTicketBehavior };
  if (!record(value) || !Number.isInteger(value.maxOpenPerUser) || Number(value.maxOpenPerUser) < 1 || Number(value.maxOpenPerUser) > 25
    || typeof value.confirmClose !== "boolean") throw new Error("Invalid Ticket opening limit or confirmation setting");
  for (const [key, max] of [["closeRoleIds", 10], ["closeUserIds", 25]] as const) {
    const ids = value[key];
    if (!Array.isArray(ids) || ids.length > max || !ids.every((id) => typeof id === "string" && idPattern.test(id)) || new Set(ids).size !== ids.length)
      throw new Error("Invalid Ticket closing roles or users");
  }
  if (value.controlStyle !== undefined && (typeof value.controlStyle !== "string" || !["MANAGE", "DIRECT"].includes(value.controlStyle))) throw new Error("Invalid Ticket control style");
  readTicketActions(value.actions);
  return value as unknown as TicketBehavior;
}

export function readTicketConfig(values: Readonly<Record<string, unknown>>) {
  if (values.TICKET_DISCORD_HISTORY_ENABLED !== undefined && typeof values.TICKET_DISCORD_HISTORY_ENABLED !== "boolean")
    throw new Error("Ticket Discord history setting must be boolean");
  const command = values.TICKET_COMMAND_NAME ?? "ticket";
  if (typeof command !== "string" || !keyPattern.test(command)) throw new Error("Invalid ticket command name");
  const categories = values.TICKET_CATEGORIES;
  if (!Array.isArray(categories) || !categories.length || categories.length > 25)
    throw new Error("Configure 1–25 ticket categories");
  const keys = new Set<string>();
  for (const row of categories) {
    if (record(row) && row.categoryId === "")
      throw new Error("Configure the Discord Category ID for every Ticket topic in bot settings before starting Ticket");
    if (!record(row) || typeof row.key !== "string" || !keyPattern.test(row.key) || keys.has(row.key)
      || !text(row.label, 100) || !text(row.description, 100, true)
      || typeof row.categoryId !== "string" || !idPattern.test(row.categoryId)
      || !Array.isArray(row.supportRoleIds) || row.supportRoleIds.length > 10
      || !row.supportRoleIds.every((id) => typeof id === "string" && idPattern.test(id))
      || new Set(row.supportRoleIds).size !== row.supportRoleIds.length
      || !Number.isInteger(row.autoCloseMinutes) || Number(row.autoCloseMinutes) < 0 || Number(row.autoCloseMinutes) > 43200
      || !["IDLE", "OPENED"].includes(String(row.autoCloseMode))
      || typeof row.formEnabled !== "boolean" || !text(row.formTitle, 45)
      || !Array.isArray(row.fields) || row.fields.length > 5 || (row.formEnabled && !row.fields.length))
      throw new Error("Invalid ticket category, timer, roles or form");
    keys.add(row.key);
    if (row.welcome !== undefined && (!record(row.welcome) || !text(row.welcome.title, 256) || !text(row.welcome.description, 3500, true) || !text(row.welcome.imageUrl, 2048, true) || (row.welcome.imageUrl !== "" && !/^https:\/\/[^\s]+$/.test(row.welcome.imageUrl)))) throw new Error("Invalid topic welcome message");
    if (row.emoji !== undefined && !validTicketEmoji(row.emoji)) throw new Error("Invalid Ticket topic emoji");
    if (row.channelNameTemplate !== undefined && !validTicketName(row.channelNameTemplate)) throw new Error("Invalid Ticket channel name template");
    const fields = new Set<string>();
    for (const field of row.fields) {
      if (!record(field) || typeof field.key !== "string" || !keyPattern.test(field.key) || fields.has(field.key)
        || !text(field.label, 45) || !["SHORT", "PARAGRAPH"].includes(String(field.style))
        || typeof field.required !== "boolean" || !text(field.placeholder, 100, true))
        throw new Error("Invalid ticket form field");
      fields.add(field.key);
    }
  }
  const behavior = readTicketBehavior(values.TICKET_BEHAVIOR);
  return { command, categories: categories as TicketCategory[], behavior, actions: readTicketActions(behavior.actions), discordHistoryEnabled: values.TICKET_DISCORD_HISTORY_ENABLED === true };
}

export interface TicketState {
  autoCloseStartAt?: number;
  participantIds?: string[];
  ticketNumber?: number;
  exemption?: { requestedBy: string; requestedAt: number; status: "PENDING" | "APPROVED" | "DENIED"; decidedBy?: string; decidedAt?: number };
  ownerId: string;
  categoryKey: string;
  openedAt: number;
  autoCloseMinutes: number;
  autoCloseMode: "IDLE" | "OPENED";
  supportRoleIds: string[];
  status: "OPEN" | "CLOSING" | "CLOSED";
}
export function ticketTopic(installationId: string, state: TicketState): string {
  return `fujipp-ticket:${installationId}:${JSON.stringify(state)}`;
}
export function readTicketTopic(installationId: string, topic: string | null): TicketState | null {
  const prefix = `fujipp-ticket:${installationId}:`;
  if (!topic?.startsWith(prefix)) return null;
  try {
    const state: unknown = JSON.parse(topic.slice(prefix.length));
    if (!record(state) || typeof state.ownerId !== "string" || !idPattern.test(state.ownerId)
      || typeof state.categoryKey !== "string" || !keyPattern.test(state.categoryKey)
      || !Number.isSafeInteger(state.openedAt) || Number(state.openedAt) <= 0
      || !Number.isInteger(state.autoCloseMinutes) || Number(state.autoCloseMinutes) < 0 || Number(state.autoCloseMinutes) > 43200
      || !["IDLE", "OPENED"].includes(String(state.autoCloseMode))
      || !["OPEN", "CLOSING", "CLOSED"].includes(String(state.status))
      || !Array.isArray(state.supportRoleIds) || state.supportRoleIds.length > 10
      || !state.supportRoleIds.every((id) => typeof id === "string" && idPattern.test(id))) return null;
    if (state.autoCloseStartAt !== undefined && (!Number.isSafeInteger(state.autoCloseStartAt) || Number(state.autoCloseStartAt) <= 0)) return null;
    if (state.participantIds !== undefined && (!Array.isArray(state.participantIds) || state.participantIds.length > 25 || !state.participantIds.every(id => typeof id === "string" && idPattern.test(id)) || new Set(state.participantIds).size !== state.participantIds.length)) return null;
    return state as unknown as TicketState;
  } catch { return null; }
}
export function ticketDue(state: TicketState, lastActivity: number, now: number): boolean {
  const start = Math.max(state.openedAt, state.autoCloseStartAt ?? state.openedAt);
  return state.status === "OPEN" && state.autoCloseMinutes > 0
    && now >= (state.autoCloseMode === "OPENED" ? start : Math.max(start, lastActivity)) + state.autoCloseMinutes * 60_000;
}
