import type { Session } from '@supabase/supabase-js'
import type { CurrentUser } from '@/features/auth/api'
import type { FeatureConfiguration, FeatureLicense, UserBot } from '@/features/bots/api'
import type { RuntimeSubscription } from '@/features/bots/runtime-api'
import type { StoreFeature } from '@/features/store/api'

export const session = { access_token: 'fixture-token', user: { id: 'fixture-user' } } as Session
export const user: CurrentUser = {
  id: 'fixture-user',
  email: 'test@example.invalid',
  role: 'ADMIN',
  status: 'ACTIVE',
  username: 'Test user',
  displayName: 'Test user',
  firstName: null,
  lastName: null,
  avatarUrl: null,
  profileCompletedAt: null,
  walletBalanceSatang: 100000,
}
export const bot: UserBot = {
  id: 'fixture-bot',
  name: 'Test bot',
  discordApplicationId: null,
  discordGuildId: null,
  discordUsername: 'Test bot',
  discordAvatarUrl: null,
  status: 'RUNNING',
  desiredState: 'RUNNING',
  restartRevision: 0,
  createdAt: '2026-08-01T00:00:00Z',
  updatedAt: '2026-08-01T00:00:00Z',
}
export const runtimeSubscription: RuntimeSubscription = {
  id: 'fixture-runtime-subscription',
  slotNumber: 1,
  planId: 'fixture-runtime-plan',
  planName: 'Runtime 1 Month',
  durationDays: 30,
  priceSatang: 9900,
  renewalPriceSatang: null,
  effectiveRenewalPriceSatang: 9900,
  currency: 'THB',
  botId: bot.id,
  botName: bot.name,
  status: 'ACTIVE',
  autoRenew: true,
  currentPeriodEnd: '2026-09-03T00:00:00Z',
  graceUntil: null,
}
export const license: FeatureLicense = {
  id: 'fixture-license',
  featureProductId: 'fixture-product',
  featureCode: 'wallet-topup',
  featureName: 'Wallet Topup',
  version: '2.0.0',
  latestVersionId: null,
  latestVersion: null,
  upgradeAvailable: false,
  status: 'ACTIVE',
  installationLimit: 1,
  acquiredAt: '2026-08-01T00:00:00Z',
  expiresAt: null,
  installations: [
    {
      id: 'fixture-installation',
      botId: bot.id,
      botName: bot.name,
      status: 'ACTIVE',
      installedAt: '2026-08-01T00:00:00Z',
    },
  ],
}
export const configuration: FeatureConfiguration = {
  licenseId: license.id,
  revision: 1,
  validatedForBotId: bot.id,
  fields: [
    {
      key: 'MIN_TOPUP_SATANG',
      label: 'Minimum amount',
      description: 'Minimum amount in satang',
      type: 'INTEGER',
      required: true,
      secret: false,
      defaultValue: 100,
      value: 100,
      configured: true,
      validation: null,
      ui: null,
    },
    {
      key: 'SLIPOK_API_KEY',
      label: 'API key',
      description: 'Stored secret',
      type: 'STRING',
      required: true,
      secret: true,
      defaultValue: null,
      value: null,
      configured: true,
      validation: null,
      ui: null,
    },
  ],
  presentations: [
    {
      slotId: 'fixture-slot',
      key: 'panel',
      label: 'Payment panel',
      description: 'Payment options',
      type: 'MESSAGE',
      availableVariables: ['username'],
      defaultDefinition: {
        mode: 'EMBED',
        embed: {
          title: 'Hello {{username}}',
          description: 'Choose a payment method',
          color: 5793266,
        },
        components_v2: { components: [{ type: 10, content: 'Choose a payment method' }] },
      },
      overrideDefinition: null,
    },
  ],
}
export const feature: StoreFeature = {
  id: 'fixture-product',
  code: 'wallet-topup',
  name: 'Wallet Topup',
  description: 'Wallet package',
  category: 'Tools',
  iconKey: 'wallet',
  image: null,
  tutorialUrl: null,
  featured: true,
  version: '2.0.0',
  offers: [
    {
      id: 'fixture-offer',
      code: 'wallet',
      name: 'Wallet package',
      kind: 'ONE_TIME',
      priceSatang: 10000,
      currency: 'THB',
      billingPeriodDays: null,
      installationLimit: 1,
    },
  ],
}
export function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((yes, no) => {
    resolve = yes
    reject = no
  })
  return { promise, resolve, reject }
}
