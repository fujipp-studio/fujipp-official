import { describe, expect, it } from 'vitest'

import { filterRuntimeInventory, runtimeBotSelections } from '@/features/bots/runtime-inventory'
import type { RuntimeSubscription } from '@/features/bots/runtime-api'

function runtime(overrides: Partial<RuntimeSubscription> = {}): RuntimeSubscription {
  return {
    id: 'runtime-1',
    slotNumber: 1,
    planId: 'plan-1',
    planName: 'Runtime 1 Month',
    durationDays: 30,
    priceSatang: 9900,
    renewalPriceSatang: null,
    effectiveRenewalPriceSatang: 9900,
    currency: 'THB',
    botId: null,
    botName: null,
    status: 'ACTIVE',
    autoRenew: true,
    currentPeriodEnd: '2026-10-02T10:55:00Z',
    graceUntil: null,
    ...overrides,
  }
}

describe('runtime inventory', () => {
  it('shows only active and grace-period subscriptions', () => {
    const subscriptions = [
      runtime({ id: 'active' }),
      runtime({ id: 'grace', status: 'GRACE' }),
      runtime({ id: 'expired', status: 'EXPIRED' }),
      runtime({ id: 'cancelled', status: 'CANCELLED' }),
    ]

    expect(filterRuntimeInventory(subscriptions).map((item) => item.id)).toEqual([
      'active',
      'grace',
    ])
  })

  it('continues to search the manageable subscriptions', () => {
    const subscriptions = [
      runtime({ id: 'first', botName: 'Fujipp' }),
      runtime({ id: 'second', slotNumber: 4, botName: 'Bot สำรอง' }),
    ]

    expect(filterRuntimeInventory(subscriptions, 'SLOT-4').map((item) => item.id)).toEqual([
      'second',
    ])
  })

  it('supports searching with localized Runtime labels', () => {
    const subscriptions = [runtime({ id: 'localized' })]

    expect(
      filterRuntimeInventory(subscriptions, 'รันไทม์', () => 'ช่อง-1 รันไทม์ 1 เดือน').map(
        (item) => item.id,
      ),
    ).toEqual(['localized'])
  })

  it('leaves a newly purchased runtime unselected until the user chooses a bot', () => {
    const selections = runtimeBotSelections([
      runtime({ id: 'new-runtime', botId: null }),
      runtime({ id: 'assigned-runtime', botId: 'bot-2' }),
    ])

    expect(selections).toEqual({
      'new-runtime': '',
      'assigned-runtime': 'bot-2',
    })
  })
})
