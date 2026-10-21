export const permissionKeys = [
  "ViewChannel",
  "SendMessages",
  "Connect",
] as const;
export type ShopPermission = (typeof permissionKeys)[number];
export type PermissionSetting = "ALLOW" | "DENY" | "INHERIT" | "KEEP";
export type ShopState = "open" | "close";
export type ShopDeliveryMode = "NEW" | "UPDATE" | "REPLACE";
export interface ShopRule {
  channelId: string;
  roleId: string;
  open: Partial<Record<ShopPermission, PermissionSetting>>;
  close: Partial<Record<ShopPermission, PermissionSetting>>;
}
export function readShopConfig(config: Readonly<Record<string, unknown>>) {
  const name = (key: string, fallback: string) => {
    const value = config[key] ?? fallback;
    if (typeof value !== "string" || !/^[a-z0-9_-]{1,32}$/.test(value))
      throw new Error(`Invalid shop command: ${key}`);
    return value;
  };
  const command = name("SHOP_COMMAND_NAME", "shop");
  const open = name("SHOP_OPEN_COMMAND", "open");
  const close = name("SHOP_CLOSE_COMMAND", "close");
  if (open === close)
    throw new Error("Open and close commands must be different");
  const raw = config.SHOP_PERMISSION_RULES ?? [];
  if (!Array.isArray(raw) || raw.length > 25)
    throw new Error("At most 25 shop permission rules are allowed");
  const pairs = new Set<string>();
  const rules: ShopRule[] = raw.map((row: unknown) => {
    if (!row || typeof row !== "object" || Array.isArray(row))
      throw new Error("Invalid shop permission rule");
    const r = row as Record<string, unknown>;
    if (
      typeof r.channelId !== "string" ||
      !/^\d{15,30}$/.test(r.channelId) ||
      typeof r.roleId !== "string" ||
      !/^\d{15,30}$/.test(r.roleId)
    )
      throw new Error("Invalid channel or role ID");
    const pair = `${r.channelId}/${r.roleId}`;
    if (pairs.has(pair)) throw new Error("Duplicate channel and role rule");
    pairs.add(pair);
    const state = (value: unknown): ShopRule["open"] => {
      if (!value || typeof value !== "object" || Array.isArray(value))
        throw new Error("Invalid shop permission settings");
      for (const [key, setting] of Object.entries(value)) {
        if (
          !permissionKeys.includes(key as ShopPermission) ||
          typeof setting !== "string" ||
          !["ALLOW", "DENY", "INHERIT", "KEEP"].includes(setting)
        )
          throw new Error("Invalid shop permission setting");
      }
      return value as ShopRule["open"];
    };
    return {
      channelId: r.channelId,
      roleId: r.roleId,
      open: state(r.open),
      close: state(r.close),
    };
  });
  const channelNames: Record<ShopState, string> = { open: "", close: "" };
  for (const state of ["OPEN", "CLOSE"] as const) {
    for (const kind of ["EVERYONE", "ROLE"]) {
      const allowMentions = config[`SHOP_${state}_ALLOW_${kind}_MENTIONS`];
      if (allowMentions !== undefined && typeof allowMentions !== "boolean")
        throw new Error("Shop mention settings must be booleans");
    }
    const channelName = config[`SHOP_${state}_CHANNEL_NAME`] ?? "";
    if (
      typeof channelName !== "string" ||
      channelName.length > 100 ||
      (channelName !== "" &&
        (!channelName.trim() || /[\r\n\t]/.test(channelName)))
    )
      throw new Error(
        "Shop channel names must contain 1–100 characters or be empty",
      );
    channelNames[state === "OPEN" ? "open" : "close"] = channelName.trim();
    const delivery = config[`SHOP_${state}_DELIVERY_MODE`] ?? "NEW";
    if (
      typeof delivery !== "string" ||
      !["NEW", "UPDATE", "REPLACE"].includes(delivery)
    )
      throw new Error("Invalid shop delivery mode");
    const mode = config[`SHOP_${state}_MESSAGE_TYPE`] ?? "DESIGNED";
    if (typeof mode !== "string" || !["TEXT", "DESIGNED"].includes(mode))
      throw new Error("Invalid shop message type");
    const text =
      config[`SHOP_${state}_TEXT`] ??
      (state === "OPEN" ? "เปิดร้านแล้ว" : "ปิดร้านแล้ว");
    if (
      typeof text !== "string" ||
      text.length > 2000 ||
      (config[`SHOP_${state}_MESSAGE_TYPE`] === "TEXT" && !text.trim())
    )
      throw new Error("Shop text must contain 1–2000 characters");
  }
  const channel = config.SHOP_ANNOUNCEMENT_CHANNEL_ID;
  if (
    channel != null &&
    channel !== "" &&
    (typeof channel !== "string" || !/^\d{15,30}$/.test(channel))
  )
    throw new Error("Invalid announcement channel ID");
  return {
    command,
    open,
    close,
    rules,
    channelNames,
    announcementChannelId: channel ? String(channel) : null,
  };
}

export function permissionPatch(settings: ShopRule["open"]) {
  const patch: Partial<Record<ShopPermission, boolean | null>> = {};
  for (const key of permissionKeys) {
    const value = settings[key] ?? "KEEP";
    if (value !== "KEEP")
      patch[key] = value === "INHERIT" ? null : value === "ALLOW";
  }
  return patch;
}
