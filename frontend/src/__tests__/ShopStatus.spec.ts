import { describe, expect, it } from 'vitest'
import { parseShopRules, validateShopDraft } from '@/features/bots/config/shop-status'
import {
  permissionCommands,
  needsCommandConfiguration,
  hasPermissionCommandSuggestions,
} from '@/features/bots/config/permission-commands'
import { shopStatusFixture } from './fixtures/shopStatus'
describe('Shop Status configuration', () => {
  const rule = {
    channelId: '111111111111111111',
    roleId: '222222222222222222',
    open: { ViewChannel: 'ALLOW' },
    close: { SendMessages: 'DENY' },
  }
  it('accepts announcement-only and per-role setups with custom commands', () => {
    expect(validateShopDraft({})).toBe(true)
    expect(
      validateShopDraft({
        SHOP_OPEN_DELIVERY_MODE: 'UPDATE',
        SHOP_CLOSE_DELIVERY_MODE: 'REPLACE',
        SHOP_COMMAND_NAME: 'store',
        SHOP_OPEN_COMMAND: 'start',
        SHOP_CLOSE_COMMAND: 'stop',
        SHOP_PERMISSION_RULES: JSON.stringify([rule]),
      }),
    ).toBe(true)
  })
  it('blocks duplicate rules, unsupported permissions, malformed JSON and empty text', () => {
    for (const invalid of [
      { SHOP_OPEN_DELIVERY_MODE: 'invalid' },
      { SHOP_CLOSE_DELIVERY_MODE: ['UPDATE'] },
      { SHOP_OPEN_COMMAND: 'close' },
      { SHOP_COMMAND_NAME: '/shop' },
      { SHOP_PERMISSION_RULES: 'broken' },
      { SHOP_PERMISSION_RULES: '{}' },
      { SHOP_PERMISSION_RULES: JSON.stringify([rule, rule]) },
      { SHOP_PERMISSION_RULES: JSON.stringify([{ ...rule, open: { Administrator: 'ALLOW' } }]) },
      { SHOP_PERMISSION_RULES: JSON.stringify([{ ...rule, roleId: 'invalid' }]) },
      { SHOP_OPEN_MESSAGE_TYPE: 'TEXT', SHOP_OPEN_TEXT: ' ' },
      { SHOP_CLOSE_TEXT: 'x'.repeat(2001) },
      { SHOP_ANNOUNCEMENT_CHANNEL_ID: 'invalid' },
    ])
      expect(validateShopDraft(invalid)).toBe(false)
    expect(parseShopRules('broken')).toEqual([])
    expect(parseShopRules('[null, {}, {"channelId":"1","roleId":"2"}]')).toEqual([])
  })
  it('suggests customized command paths to Bot Permissions', () => {
    const { shopLicense, config } = shopStatusFixture()
    config.fields.find((f) => f.key === 'SHOP_COMMAND_NAME')!.value = 'store'
    config.fields.find((f) => f.key === 'SHOP_OPEN_COMMAND')!.value = 'start'
    expect(hasPermissionCommandSuggestions(shopLicense)).toBe(true)
    expect(needsCommandConfiguration(shopLicense)).toBe(true)
    expect(permissionCommands(shopLicense, config).commands.map((c) => c.value)).toEqual([
      'store',
      'store/start',
      'store/close',
    ])
  })
})
