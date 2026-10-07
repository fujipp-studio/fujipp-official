import type { FeatureConfiguration } from '@/features/bots/api'
import { configuration, license } from './domain'

const definitions: Record<string, Record<string, unknown>> = {
  method_selector: {
    mode: 'COMPONENTS_V2',
    components: {
      bank_button: {
        label: 'สแกน QR ธนาคาร',
        emoji: '🏦',
        style: 'success',
      },
      wallet_button: {
        label: 'ชำระผ่าน Wallet',
        emoji: '🟠',
        style: 'primary',
      },
    },
    embed: {
      color: 5793266,
      title: '💳 เลือกช่องทางการชำระเงิน',
      description:
        'กรุณาเลือกช่องทางที่ต้องการชำระเงินจากปุ่มด้านล่าง\n\n**ยอดรายการ:** {{base_amount}} บาท\n\n> โปรดตรวจสอบยอดเงินให้ถูกต้องก่อนชำระเงิน\n> การชำระผ่าน Wallet มีค่าธรรมเนียมเพิ่มเติม {{fee_amount}} บาท',
      footer: {
        text: 'ขอบคุณที่ใช้บริการ · {{datetime}}',
      },
    },
    components_v2: {
      components: [
        {
          type: 17,
          accent_color: 5793266,
          components: [
            {
              type: 10,
              content: '# 💳 เลือกช่องทางการชำระเงิน',
            },
            {
              type: 14,
              divider: true,
              spacing: 1,
            },
            {
              type: 10,
              content:
                'กรุณาเลือกช่องทางที่ต้องการชำระเงินจากปุ่มด้านล่าง\n\n**ยอดรายการ:** `{{base_amount}} บาท`\n\n> โปรดตรวจสอบยอดเงินให้ถูกต้องก่อนชำระเงิน\n> การชำระผ่าน Wallet มีค่าธรรมเนียมเพิ่มเติม `{{fee_amount}} บาท`',
            },
            {
              type: 14,
              divider: true,
              spacing: 1,
            },
            {
              type: 10,
              content: 'ขอบคุณที่ใช้บริการ · {{datetime}}',
            },
          ],
        },
      ],
    },
  },
  bank_payment: {
    mode: 'COMPONENTS_V2',
    embed: {
      color: 5763719,
      title: '🏦 ชำระเงินผ่าน QR ธนาคาร',
      description:
        'กรุณาสแกน QR Code เพื่อดำเนินการชำระเงิน\n\n**ยอดที่ต้องชำระ:** {{amount}} บาท\n\n> กรุณาชำระเงินให้ตรงตามยอดที่ระบุ\n> เมื่อชำระเรียบร้อยแล้ว โปรดส่งหลักฐานการชำระเงินในห้องนี้',
      image_url: '{{qr_image_url}}',
      footer: {
        text: 'ขอบคุณที่ใช้บริการ · {{datetime}}',
      },
    },
    components_v2: {
      components: [
        {
          type: 17,
          accent_color: 5763719,
          components: [
            {
              type: 10,
              content:
                '# 🏦 ชำระเงินผ่าน QR ธนาคาร\nกรุณาสแกน QR Code ด้านล่างเพื่อดำเนินการชำระเงิน',
            },
            {
              type: 14,
              divider: true,
              spacing: 1,
            },
            {
              type: 10,
              content:
                '**ยอดที่ต้องชำระ:** `{{amount}} บาท`\n\n> กรุณาชำระเงินให้ตรงตามยอดที่ระบุ\n> เมื่อชำระเรียบร้อยแล้ว โปรดส่งหลักฐานการชำระเงินในห้องนี้',
            },
            {
              type: 12,
              items: [
                {
                  media: {
                    url: '{{qr_image_url}}',
                  },
                  description: 'QR Code สำหรับชำระเงินผ่านธนาคาร',
                },
              ],
            },
            {
              type: 14,
              divider: true,
              spacing: 1,
            },
            {
              type: 10,
              content: 'ขอบคุณที่ใช้บริการ · {{datetime}}',
            },
          ],
        },
      ],
    },
  },
  wallet_payment: {
    mode: 'COMPONENTS_V2',
    embed: {
      color: 3447003,
      title: '🟠 ชำระเงินผ่าน Wallet',
      description:
        'กรุณาโอนเงินไปยังหมายเลข Wallet ด้านล่าง\n\n**ยอดรายการ:** {{base_amount}} บาท\n**ค่าธรรมเนียม Wallet:** {{fee_amount}} บาท\n**ยอดที่ต้องชำระทั้งหมด:** {{total_amount}} บาท\n**หมายเลข Wallet:** `{{wallet_number}}`\n\n> กรุณาโอนเงินให้ตรงตามยอดทั้งหมดที่ระบุ\n> เมื่อชำระเรียบร้อยแล้ว โปรดส่งหลักฐานการชำระเงินในห้องนี้',
      footer: {
        text: 'ขอบคุณที่ใช้บริการ · {{datetime}}',
      },
    },
    components_v2: {
      components: [
        {
          type: 17,
          accent_color: 3447003,
          components: [
            {
              type: 10,
              content: '# 🟠 ชำระเงินผ่าน Wallet\nกรุณาโอนเงินไปยังหมายเลข Wallet ด้านล่าง',
            },
            {
              type: 14,
              divider: true,
              spacing: 1,
            },
            {
              type: 10,
              content:
                '**ยอดรายการ:** `{{base_amount}} บาท`\n**ค่าธรรมเนียม Wallet:** `{{fee_amount}} บาท`\n**ยอดที่ต้องชำระทั้งหมด:** `{{total_amount}} บาท`\n**หมายเลข Wallet:** `{{wallet_number}}`',
            },
            {
              type: 14,
              divider: true,
              spacing: 1,
            },
            {
              type: 10,
              content:
                '> กรุณาโอนเงินให้ตรงตามยอดทั้งหมดที่ระบุ\n> เมื่อชำระเรียบร้อยแล้ว โปรดส่งหลักฐานการชำระเงินในห้องนี้',
            },
            {
              type: 14,
              divider: true,
              spacing: 1,
            },
            {
              type: 10,
              content: 'ขอบคุณที่ใช้บริการ · {{datetime}}',
            },
          ],
        },
      ],
    },
  },
  invalid_amount: {
    mode: 'COMPONENTS_V2',
    embed: {
      color: 15548997,
      title: '⚠️ ไม่พบยอดชำระเงิน',
      description:
        'กรุณาระบุยอดเงินต่อท้าย Trigger เช่น `{{trigger}}10` สำหรับยอด 10 บาท\n\nรองรับทศนิยมไม่เกิน 2 ตำแหน่ง และยอดต้องมากกว่า 0 บาท',
    },
    components_v2: {
      components: [
        {
          type: 17,
          accent_color: 15548997,
          components: [
            {
              type: 10,
              content: '# ⚠️ ไม่พบยอดชำระเงิน',
            },
            {
              type: 14,
              divider: true,
              spacing: 1,
            },
            {
              type: 10,
              content:
                'กรุณาระบุยอดเงินต่อท้าย Trigger เช่น `{{trigger}}10` สำหรับยอด 10 บาท\n\nรองรับทศนิยมไม่เกิน 2 ตำแหน่ง และยอดต้องมากกว่า 0 บาท',
            },
          ],
        },
      ],
    },
  },
}

export function paymentTriggerFixture(mode: 'EMBED' | 'COMPONENTS_V2' = 'COMPONENTS_V2') {
  const paymentLicense = {
    ...license,
    featureCode: 'payment-trigger',
    featureName: 'Payment Trigger',
    version: '1.0.0',
  }
  const config: FeatureConfiguration = {
    ...structuredClone(configuration),
    fields: [
      {
        key: 'PAYMENT_TRIGGER_PREFIX',
        type: 'STRING',
        value: 'p',
        validation: { pattern: '^[a-zA-Z]{1,10}$' },
      },
      {
        key: 'BANK_QR_IMAGE_URL',
        type: 'STRING',
        value: 'https://fixture.invalid/payment-qr.png',
        validation: { pattern: '^https://.+', maxLength: 2000 },
      },
      {
        key: 'WALLET_NUMBER',
        type: 'STRING',
        value: '0812345678',
        validation: { pattern: '^[0-9]{10}$' },
      },
      {
        key: 'WALLET_FEE_SATANG',
        type: 'INTEGER',
        value: 500,
        validation: { minimum: 0, maximum: 100000 },
      },
      { key: 'FUTURE_SETTING', type: 'STRING', value: 'preserved', validation: null },
    ].map((item) => ({
      label: item.key,
      description: '',
      required: true,
      secret: false,
      configured: true,
      defaultValue: item.value,
      ui: null,
      ...item,
    })),
    presentations: Object.entries(definitions).map(([key, source], index) => {
      const definition = structuredClone(source)
      definition.mode = mode
      definition.future = { retained: true }
      if (key === 'method_selector') {
        const components = definition.components as Record<string, Record<string, unknown>>
        components.bank_button!.future = 'keep'
      }
      return {
        slotId: `payment-slot-${index + 1}`,
        key,
        label: key,
        description: '',
        type: 'COMPONENTS_V2',
        availableVariables: [
          'amount',
          'base_amount',
          'fee_amount',
          'total_amount',
          'datetime',
          'qr_image_url',
          'wallet_number',
          'trigger',
        ],
        defaultDefinition: definition,
        overrideDefinition: null,
      }
    }),
  }
  return { paymentLicense, config }
}
