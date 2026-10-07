import type { FeatureConfiguration } from '@/features/bots/api'
import { configuration, license } from './domain'

export const walletTopupLicense = { ...license, featureName: 'Wallet Top-up', version: '2.1.0' }
type Field = FeatureConfiguration['fields'][number]
function field(
  key: string,
  type: string,
  value: Field['value'],
  required = true,
  validation: Field['validation'] = null,
): Field {
  return {
    key,
    type,
    value,
    defaultValue: value,
    label: key,
    description: '',
    required,
    secret: type === 'SECRET',
    configured: type === 'SECRET' || value != null,
    validation,
    ui: null,
  }
}
const slots = [
  'panel',
  'balance',
  'method_selector',
  'minimum_warning',
  'promptpay_qr',
  'expired',
  'processing',
  'failed',
  'succeeded',
  'admin_notification',
  'adjustment_result',
  'history',
  'monthly_summary',
  'leaderboard',
]
export const walletTopupConfiguration: FeatureConfiguration = {
  ...configuration,
  fields: [
    field('PANEL_COMMAND_NAME', 'STRING', 'wallet-panel', true, { pattern: '^[a-z0-9_-]{1,32}$' }),
    field('MIN_TOPUP_SATANG', 'INTEGER', 1000, true, { minimum: 1 }),
    field('TRUEMONEY_FEE_SATANG', 'INTEGER', 500, true, { minimum: 0 }),
    field('TRUEMONEY_FEE_MODE', 'STRING', 'FIXED', true, { enum: ['FIXED', 'PERCENT'] }),
    field('TRUEMONEY_FEE_PERCENT', 'INTEGER', 0, true, { minimum: 0, maximum: 100 }),
    field('TRUEMONEY_PHONE', 'STRING', '0812345678', true, { pattern: '^0[0-9]{8,9}$' }),
    field('PROMPTPAY_ID', 'STRING', '0812345678', true, { pattern: '^[0-9]{10,13}$' }),
    field('PROMPTPAY_ACCOUNT_NAME', 'STRING', 'TEST SHOP', true, { minLength: 1, maxLength: 120 }),
    field('PROMPTPAY_QR_EXPIRY_MINUTES', 'INTEGER', 5, true, { minimum: 1, maximum: 60 }),
    field('SLIPOK_BRANCH_ID', 'SECRET', null),
    field('SLIPOK_API_KEY', 'SECRET', null),
    field('SLIP_CHANNEL_ID', 'CHANNEL_ID', '123456789012345678'),
    field('SLIP_SUBMITTER_ROLE_ID', 'ROLE_ID', '123456789012345679'),
    field('TOPUP_NOTIFICATION_CHANNEL_ID', 'CHANNEL_ID', '123456789012345680'),
    field('WALLET_ADMIN_ROLE_ID', 'ROLE_ID', null, false),
    field('TOPUP_MEMBER_ROLE_ID', 'ROLE_ID', null, false),
    field('WALLET_HISTORY_DEFAULT_LIMIT', 'INTEGER', 10, true, { minimum: 1, maximum: 50 }),
    field('TOP_SPENDER_TOP1_ROLE_ID', 'ROLE_ID', null, false),
    field('TOP_SPENDER_TOP10_ROLE_ID', 'ROLE_ID', null, false),
    field('TOP_SPENDER_LEADERBOARD_CHANNEL_ID', 'CHANNEL_ID', null, false),
    field(
      'TOP_SPENDER_MILESTONE_ROLES',
      'JSON',
      [{ thresholdBaht: 1000, roleId: '123456789012345681', future: 'preserved' }],
      false,
    ),
    field('FUTURE_WALLET_SETTING', 'STRING', 'keep-this'),
  ],
  presentations: slots.map((key) => ({
    slotId: 'wallet-' + key,
    key,
    label: key,
    description: key,
    type: 'MESSAGE',
    availableVariables: [
      'member_mention',
      'minimum_amount',
      'truemoney_fee',
      'account_name',
      'amount',
      'balance',
    ],
    defaultDefinition:
      key === 'method_selector' || key === 'adjustment_result'
        ? {
            mode: 'COMPONENTS_V2',
            title: key === 'method_selector' ? 'เลือกช่องทางเติมเงิน' : '✅ ปรับยอดเงินสำเร็จ',
            description:
              key === 'method_selector'
                ? 'ขั้นต่ำ {{minimum_amount}} บาท · TrueMoney {{truemoney_fee}}'
                : '**สมาชิก** {{member_mention}}\n**รายการ** {{operation}}\n**จำนวน** {{amount}} {{currency}}\n**ยอดคงเหลือ** {{balance}} {{currency}}\n**ผู้ดำเนินการ** {{actor_mention}}\n**เหตุผล** {{reason}}\n**เวลา** {{transaction_time}}',
            actions: key === 'method_selector' ? ['wallet.promptpay', 'wallet.truemoney'] : [],
          }
        : {
            mode: 'EMBED',
            title:
              key === 'panel'
                ? 'เติมเงินเข้ากระเป๋า'
                : key === 'succeeded'
                  ? 'เติมเงินสำเร็จ'
                  : key,
            description:
              'สมาชิก {{member_mention}}\nยอด {{amount}} บาท · คงเหลือ {{balance}} บาท\nขั้นต่ำ {{minimum_amount}} บาท',
            actions: key === 'panel' ? ['wallet.topup', 'wallet.balance'] : [],
            future: 'preserved',
          },
    overrideDefinition: null,
  })),
}
