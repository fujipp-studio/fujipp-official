export const paymentTriggerConfigKeys = new Set([
  'PAYMENT_TRIGGER_PREFIX',
  'BANK_QR_IMAGE_URL',
  'WALLET_NUMBER',
  'WALLET_FEE_SATANG',
])

export const paymentTriggerPresentationCopy: Record<
  string,
  {
    label: [string, string]
    description: [string, string]
  }
> = {
  method_selector: {
    label: ['Payment methods', 'เลือกช่องทางชำระเงิน'],
    description: ['Members choose bank QR or Wallet.', 'ลูกค้าเลือกชำระผ่าน QR ธนาคารหรือ Wallet'],
  },
  bank_payment: {
    label: ['Bank QR payment', 'ชำระผ่าน QR ธนาคาร'],
    description: [
      'The configured QR image and original payment amount.',
      'รูป QR ที่ตั้งไว้และยอดชำระตั้งต้น',
    ],
  },
  wallet_payment: {
    label: ['Wallet payment', 'ชำระผ่าน Wallet'],
    description: [
      'Wallet number, additional fee and total amount.',
      'หมายเลข Wallet ค่าธรรมเนียมที่บวกเพิ่ม และยอดรวม',
    ],
  },
  invalid_amount: {
    label: ['Invalid amount', 'แจ้งยอดเงินไม่ถูกต้อง'],
    description: [
      'Shown when the trigger has a missing or invalid amount.',
      'แสดงเมื่อ Trigger ไม่ระบุยอดหรือระบุยอดไม่ถูกต้อง',
    ],
  },
}

export const paymentTriggerButtonDefaults = {
  bank_button: { label: 'สแกน QR ธนาคาร', emoji: '🏦', style: 'success' },
  wallet_button: { label: 'ชำระผ่าน Wallet', emoji: '🟠', style: 'primary' },
}

const money = (satang: number) =>
  (satang / 100).toLocaleString('th-TH', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })
export function paymentTriggerSampleValues(values: Record<string, unknown>) {
  const configuredFee = values.WALLET_FEE_SATANG
  const fee =
    configuredFee !== '' &&
    configuredFee != null &&
    Number.isSafeInteger(Number(configuredFee)) &&
    Number(configuredFee) >= 0
      ? Number(configuredFee)
      : 500
  return {
    amount: '10',
    base_amount: '10',
    fee_amount: money(fee),
    total_amount: money(1000 + fee),
    qr_image_url: String(values.BANK_QR_IMAGE_URL ?? '').trim(),
    wallet_number: String(values.WALLET_NUMBER ?? '').trim(),
    trigger: String(values.PAYMENT_TRIGGER_PREFIX || 'p').trim(),
    datetime: '7/10/2569 14:30:00',
  }
}
