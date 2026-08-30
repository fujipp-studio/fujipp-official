import { describe, expect, it } from 'vitest'

import { groupPackageInventory, nextInstallableLicense } from '../features/bots/package-inventory'
import { type FeatureLicense } from '@/features/bots/api'

function license(overrides: Partial<FeatureLicense> = {}): FeatureLicense {
  return {
    id: 'license-1',
    featureProductId: 'review-credit',
    featureCode: 'review-credit',
    featureName: 'Review Credit',
    version: '1.0.0',
    latestVersionId: null,
    latestVersion: null,
    upgradeAvailable: false,
    status: 'ACTIVE',
    installationLimit: 1,
    acquiredAt: '2026-08-28T00:00:00Z',
    expiresAt: null,
    installations: [],
    ...overrides,
  }
}

describe('package inventory grouping', () => {
  it('combines duplicate licenses into one package and version row', () => {
    const groups = groupPackageInventory([
      license({ id: 'review-1' }),
      license({ id: 'review-2' }),
      license({ id: 'review-3' }),
    ])

    expect(groups).toHaveLength(1)
    expect(groups[0]).toMatchObject({
      featureName: 'Review Credit',
      version: '1.0.0',
      availableSlots: 3,
      installationLimit: 3,
    })
  })

  it('keeps different versions separate and sorts packages by name', () => {
    const groups = groupPackageInventory([
      license({ id: 'voice', featureProductId: 'voice', featureName: 'Voice Keeper' }),
      license({ id: 'review-v2', version: '2.0.0' }),
      license({ id: 'review-v1', version: '1.0.0' }),
    ])

    expect(groups.map((group) => `${group.featureName} ${group.version}`)).toEqual([
      'Review Credit 1.0.0',
      'Review Credit 2.0.0',
      'Voice Keeper 1.0.0',
    ])
  })

  it('excludes unusable licenses but keeps installed purchases in the inventory total', () => {
    const now = Date.parse('2026-08-28T12:00:00Z')
    const groups = groupPackageInventory(
      [
        license({ id: 'available' }),
        license({ id: 'suspended', status: 'SUSPENDED' }),
        license({ id: 'expired', expiresAt: '2026-08-27T12:00:00Z' }),
        license({
          id: 'full',
          installations: [
            {
              id: 'installation-1',
              botId: 'bot-1',
              botName: 'Fujipp',
              status: 'ACTIVE',
              installedAt: '2026-08-28T00:00:00Z',
            },
          ],
        }),
      ],
      '',
      now,
    )

    expect(groups).toHaveLength(1)
    expect(groups[0]).toMatchObject({ availableSlots: 1, installationLimit: 2 })
    expect(groups[0]?.licenses.map((item) => item.id)).toEqual(['available', 'full'])
  })

  it('hides a package group when every installation slot has been used', () => {
    const full = (id: string) =>
      license({
        id,
        installations: [
          {
            id: `installation-${id}`,
            botId: `bot-${id}`,
            botName: `Bot ${id}`,
            status: 'ACTIVE',
            installedAt: '2026-08-28T00:00:00Z',
          },
        ],
      })

    expect(groupPackageInventory([full('1'), full('2')])).toEqual([])
  })

  it('uses the earliest-expiring license first when installing from a group', () => {
    const groups = groupPackageInventory([
      license({ id: 'later', expiresAt: '2026-10-01T00:00:00Z' }),
      license({ id: 'sooner', expiresAt: '2026-09-01T00:00:00Z' }),
      license({ id: 'no-expiry' }),
    ])

    expect(groups[0]?.licenses.map((item) => item.id)).toEqual(['sooner', 'later', 'no-expiry'])
  })

  it('selects an available license even when an installed license sorts first', () => {
    const installed = license({
      id: 'installed',
      expiresAt: '2026-09-01T00:00:00Z',
      installations: [
        {
          id: 'installation-1',
          botId: 'bot-1',
          botName: 'Fujipp',
          status: 'ACTIVE',
          installedAt: '2026-08-28T00:00:00Z',
        },
      ],
    })
    const available = license({ id: 'available', expiresAt: '2026-10-01T00:00:00Z' })
    const group = groupPackageInventory([installed, available])[0]

    expect(group && nextInstallableLicense(group)?.id).toBe('available')
  })
})
