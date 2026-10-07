export const walletTopupConfigKeys = new Set([
  'PANEL_COMMAND_NAME',
  'MIN_TOPUP_SATANG',
  'TRUEMONEY_FEE_SATANG',
  'TRUEMONEY_FEE_MODE',
  'TRUEMONEY_FEE_PERCENT',
  'TRUEMONEY_PHONE',
  'PROMPTPAY_ID',
  'PROMPTPAY_ACCOUNT_NAME',
  'PROMPTPAY_QR_EXPIRY_MINUTES',
  'SLIPOK_BRANCH_ID',
  'SLIPOK_API_KEY',
  'SLIP_CHANNEL_ID',
  'SLIP_SUBMITTER_ROLE_ID',
  'TOPUP_NOTIFICATION_CHANNEL_ID',
  'WALLET_ADMIN_ROLE_ID',
  'TOPUP_MEMBER_ROLE_ID',
  'WALLET_HISTORY_DEFAULT_LIMIT',
  'TOP_SPENDER_TOP1_ROLE_ID',
  'TOP_SPENDER_TOP10_ROLE_ID',
  'TOP_SPENDER_MILESTONE_ROLES',
  'TOP_SPENDER_LEADERBOARD_CHANNEL_ID',
])

export const walletPresentationCopy: Record<
  string,
  { label: [string, string]; description: [string, string] }
> = {
  panel: {
    label: ['Top-up panel', 'แผงเติมเงิน'],
    description: [
      'Members choose to top up or check their balance.',
      'สมาชิกเลือกเติมเงินหรือดูยอดคงเหลือ',
    ],
  },
  balance: {
    label: ['Wallet balance', 'ยอดเงินคงเหลือ'],
    description: ['Current wallet balance shown to the member.', 'แสดงยอดเงินคงเหลือให้สมาชิก'],
  },
  method_selector: {
    label: ['Payment methods', 'เลือกช่องทางเติมเงิน'],
    description: ['Choose PromptPay or TrueMoney.', 'เลือกเติมเงินผ่านพร้อมเพย์หรือ TrueMoney'],
  },
  minimum_warning: {
    label: ['Minimum amount warning', 'แจ้งยอดต่ำกว่าขั้นต่ำ'],
    description: [
      'Shown when a PromptPay amount is too low.',
      'แสดงเมื่อยอดพร้อมเพย์ต่ำกว่าขั้นต่ำ',
    ],
  },
  promptpay_qr: {
    label: ['PromptPay QR', 'QR พร้อมเพย์'],
    description: [
      'QR, account details and remaining payment time.',
      'QR ข้อมูลบัญชี และเวลาชำระเงินที่เหลือ',
    ],
  },
  expired: {
    label: ['Session expired', 'รายการหมดอายุ'],
    description: ['Shown when the payment session expires.', 'แสดงเมื่อรายการชำระเงินหมดอายุ'],
  },
  processing: {
    label: ['Processing', 'กำลังตรวจสอบ'],
    description: ['Shown while verifying a payment.', 'แสดงระหว่างตรวจสอบการชำระเงิน'],
  },
  failed: {
    label: ['Payment failed', 'เติมเงินไม่สำเร็จ'],
    description: [
      'Payment error and the failure reason.',
      'แจ้งข้อผิดพลาดและเหตุผลที่เติมเงินไม่สำเร็จ',
    ],
  },
  succeeded: {
    label: ['Top-up receipt', 'เติมเงินสำเร็จ'],
    description: ['Receipt after a successful top-up.', 'ใบเสร็จหลังเติมเงินสำเร็จ'],
  },
  admin_notification: {
    label: ['Administrator notification', 'แจ้งเตือนผู้ดูแล'],
    description: [
      'Transaction notification sent to the audit channel.',
      'แจ้งรายการในห้องแจ้งเตือนของร้าน',
    ],
  },
  adjustment_result: {
    label: ['Balance adjustment receipt', 'ใบเสร็จปรับยอดเงิน'],
    description: [
      'Public receipt after an administrator adjusts a balance.',
      'ใบเสร็จในห้องคำสั่งเมื่อผู้ดูแลปรับยอดเงิน',
    ],
  },
  history: {
    label: ['Wallet history', 'ประวัติกระเป๋าเงิน'],
    description: ['Member wallet transactions.', 'แสดงรายการกระเป๋าเงินของสมาชิก'],
  },
  monthly_summary: {
    label: ['Monthly top-up summary', 'สรุปยอดเติมรายเดือน'],
    description: ['Top-up totals from the last month.', 'สรุปยอดเติมเงินในหนึ่งเดือนล่าสุด'],
  },
  leaderboard: {
    label: ['Top-up leaderboard', 'อันดับผู้เติมเงิน'],
    description: ['Lifetime Top 10 top-up leaderboard.', 'แสดง 10 อันดับยอดเติมเงินสะสม'],
  },
}
