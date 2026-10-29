export type ShopPermission = 'ViewChannel' | 'SendMessages' | 'Connect'
export type ShopPermissionSetting = 'KEEP' | 'ALLOW' | 'DENY' | 'INHERIT'
export interface ShopPermissionRule {
  channelId: string
  roleId: string
  open: Partial<Record<ShopPermission, ShopPermissionSetting>>
  close: Partial<Record<ShopPermission, ShopPermissionSetting>>
}
export const shopStatusConfigKeys = new Set([
  'SHOP_COMMAND_NAME',
  'SHOP_OPEN_COMMAND',
  'SHOP_CLOSE_COMMAND',
  'SHOP_ANNOUNCEMENT_CHANNEL_ID',
  'SHOP_OPEN_CHANNEL_NAME',
  'SHOP_CLOSE_CHANNEL_NAME',
  'SHOP_OPEN_ALLOW_EVERYONE_MENTIONS',
  'SHOP_CLOSE_ALLOW_EVERYONE_MENTIONS',
  'SHOP_OPEN_ALLOW_ROLE_MENTIONS',
  'SHOP_CLOSE_ALLOW_ROLE_MENTIONS',
  'SHOP_OPEN_MESSAGE_TYPE',
  'SHOP_CLOSE_MESSAGE_TYPE',
  'SHOP_OPEN_DELIVERY_MODE',
  'SHOP_CLOSE_DELIVERY_MODE',
  'SHOP_OPEN_TEXT',
  'SHOP_CLOSE_TEXT',
  'SHOP_PERMISSION_RULES',
])
