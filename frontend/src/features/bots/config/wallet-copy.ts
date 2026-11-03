export const walletConfigCopy: Record<
  string,
  { label: [string, string]; description: [string, string] }
> = {
  PANEL_COMMAND_NAME: {
    label: ['Panel command', 'คำสั่งแผงเติมเงิน'],
    description: [
      'Administrator command used to post the wallet panel.',
      'คำสั่งสำหรับผู้ดูแลเพื่อส่งแผงเติมเงิน',
    ],
  },
  MIN_TOPUP_SATANG: {
    label: ['PromptPay minimum top-up', 'ยอดเติมขั้นต่ำผ่านพร้อมเพย์'],
    description: [
      'Minimum PromptPay amount accepted, in satang.',
      'ยอดเงินขั้นต่ำที่รับผ่านพร้อมเพย์ หน่วยเป็นสตางค์',
    ],
  },
  TRUEMONEY_FEE_SATANG: {
    label: ['TrueMoney fee', 'ค่าธรรมเนียม TrueMoney'],
    description: [
      'Fixed fee deducted from a successful voucher, in satang.',
      'ค่าธรรมเนียมคงที่ที่หักจากซองสำเร็จ หน่วยเป็นสตางค์',
    ],
  },
  TRUEMONEY_FEE_MODE: {
    label: ['TrueMoney fee mode', 'รูปแบบค่าธรรมเนียม TrueMoney'],
    description: [
      'Choose a fixed fee or a percentage of the voucher amount.',
      'เลือกค่าธรรมเนียมคงที่หรือคิดเป็นเปอร์เซ็นต์จากยอดซอง',
    ],
  },
  TRUEMONEY_FEE_PERCENT: {
    label: ['TrueMoney percentage fee', 'ค่าธรรมเนียม TrueMoney แบบเปอร์เซ็นต์'],
    description: [
      'Percentage deducted when percentage mode is selected.',
      'เปอร์เซ็นต์ที่หักเมื่อเลือกรูปแบบเปอร์เซ็นต์',
    ],
  },
  TRUEMONEY_PHONE: {
    label: ['TrueMoney phone', 'เบอร์โทร TrueMoney'],
    description: [
      'Recipient phone number used by the Voucher API.',
      'เบอร์โทรผู้รับที่ใช้กับระบบซองของขวัญ TrueMoney',
    ],
  },
  PROMPTPAY_ID: {
    label: ['PromptPay ID', 'หมายเลขพร้อมเพย์'],
    description: [
      'Phone number or national ID used to generate the QR.',
      'เบอร์โทรหรือเลขบัตรประชาชนที่ใช้สร้าง QR พร้อมเพย์',
    ],
  },
  PROMPTPAY_ACCOUNT_NAME: {
    label: ['PromptPay account name', 'ชื่อบัญชีพร้อมเพย์'],
    description: ['Account name displayed beside the QR.', 'ชื่อบัญชีที่แสดงคู่กับ QR พร้อมเพย์'],
  },
  PROMPTPAY_QR_EXPIRY_MINUTES: {
    label: ['QR lifetime (minutes)', 'อายุ QR (นาที)'],
    description: [
      '1–60 minutes. Temporary slip access ends when the QR expires.',
      '1–60 นาที ยศส่งสลิปชั่วคราวจะหมดสิทธิ์เมื่อ QR หมดอายุ',
    ],
  },
  SLIPOK_BRANCH_ID: {
    label: ['SlipOK branch ID', 'รหัสสาขา SlipOK'],
    description: ['Branch ID supplied by SlipOK.', 'รหัสสาขาที่ได้รับจาก SlipOK'],
  },
  SLIPOK_API_KEY: {
    label: ['SlipOK API key', 'คีย์ API ของ SlipOK'],
    description: ['API key used to verify payment slips.', 'คีย์ API สำหรับตรวจสอบสลิปการชำระเงิน'],
  },
  SLIP_CHANNEL_ID: {
    label: ['Slip submission channel', 'ช่องส่งสลิป'],
    description: [
      'Channel where members submit PromptPay slips.',
      'ช่องที่สมาชิกใช้ส่งสลิปพร้อมเพย์',
    ],
  },
  SLIP_SUBMITTER_ROLE_ID: {
    label: ['Slip submitter role', 'ยศผู้ส่งสลิป'],
    description: [
      'Temporary role allowed to submit payment slips.',
      'ยศชั่วคราวสำหรับสมาชิกที่ได้รับอนุญาตให้ส่งสลิป',
    ],
  },
  TOPUP_NOTIFICATION_CHANNEL_ID: {
    label: ['Top-up notification channel', 'ช่องแจ้งเตือนการเติมเงิน'],
    description: [
      'Private channel receiving successful top-up notifications.',
      'ช่องส่วนตัวที่รับการแจ้งเตือนเมื่อเติมเงินสำเร็จ',
    ],
  },
  WALLET_ADMIN_ROLE_ID: {
    label: ['Wallet administrator role', 'ยศผู้ดูแลกระเป๋าเงิน'],
    description: [
      'Optional role allowed to inspect and adjust member balances.',
      'ยศเสริมที่สามารถตรวจสอบและปรับยอดเงินสมาชิกได้',
    ],
  },
  TOPUP_MEMBER_ROLE_ID: {
    label: ['Top-up member role', 'ยศสมาชิกที่เติมเงิน'],
    description: [
      'Optional permanent role granted after a successful top-up.',
      'ยศถาวรเสริมที่มอบให้หลังเติมเงินสำเร็จ',
    ],
  },
  WALLET_HISTORY_DEFAULT_LIMIT: {
    label: ['History default limit', 'จำนวนประวัติเริ่มต้น'],
    description: [
      'Default number of wallet history entries shown.',
      'จำนวนรายการประวัติกระเป๋าเงินที่แสดงเริ่มต้น',
    ],
  },
  TOP_SPENDER_TOP1_ROLE_ID: {
    label: ['Top spender #1 role', 'ยศผู้เติมเงินอันดับ 1'],
    description: [
      'Optional role for the lifetime top-up leader.',
      'ยศเสริมสำหรับผู้เติมเงินสะสมอันดับหนึ่ง',
    ],
  },
  TOP_SPENDER_TOP10_ROLE_ID: {
    label: ['Top spender top 10 role', 'ยศผู้เติมเงิน 10 อันดับแรก'],
    description: [
      'Optional role for lifetime ranks 1–10.',
      'ยศเสริมสำหรับผู้เติมเงินสะสมอันดับ 1–10',
    ],
  },
  TOP_SPENDER_MILESTONE_ROLES: {
    label: ['Top spender milestones', 'ยศตามยอดเติมสะสม'],
    description: [
      'Roles granted when lifetime top-up thresholds are reached.',
      'ยศที่มอบเมื่อยอดเติมเงินสะสมถึงเกณฑ์',
    ],
  },
  TOP_SPENDER_LEADERBOARD_CHANNEL_ID: {
    label: ['Leaderboard channel', 'ช่องตารางอันดับ'],
    description: [
      'Optional channel receiving the public Top 10 leaderboard.',
      'ช่องเสริมสำหรับแสดงตารางผู้เติมเงิน 10 อันดับแรก',
    ],
  },
}
