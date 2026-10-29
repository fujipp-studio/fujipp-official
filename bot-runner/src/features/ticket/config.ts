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
    const fields = new Set<string>();
    for (const field of row.fields) {
      if (!record(field) || typeof field.key !== "string" || !keyPattern.test(field.key) || fields.has(field.key)
        || !text(field.label, 45) || !["SHORT", "PARAGRAPH"].includes(String(field.style))
        || typeof field.required !== "boolean" || !text(field.placeholder, 100, true))
        throw new Error("Invalid ticket form field");
      fields.add(field.key);
    }
  }
  return { command, categories: categories as TicketCategory[], discordHistoryEnabled: values.TICKET_DISCORD_HISTORY_ENABLED === true };
}

export interface TicketState {
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
    return state as unknown as TicketState;
  } catch { return null; }
}
export function ticketDue(state: TicketState, lastActivity: number, now: number): boolean {
  return state.status === "OPEN" && state.autoCloseMinutes > 0
    && now >= (state.autoCloseMode === "OPENED" ? state.openedAt : Math.max(state.openedAt, lastActivity)) + state.autoCloseMinutes * 60_000;
}
