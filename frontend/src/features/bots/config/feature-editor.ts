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

export const robloxConfigCopy: Record<
  string,
  { label: [string, string]; description: [string, string] }
> = {
  PANEL_COMMAND_NAME: {
    label: ['Panel command', 'คำสั่งแผงขาย Robux'],
    description: [
      'Administrator command used to post the Robux shop panel.',
      'คำสั่งสำหรับผู้ดูแลเพื่อส่งแผงขาย Robux',
    ],
  },
  ROBUX_ENABLED: {
    label: ['Sales enabled', 'เปิดระบบขาย Robux'],
    description: [
      'Allow members to start new Robux purchases.',
      'อนุญาตให้สมาชิกเริ่มซื้อ Robux รายการใหม่',
    ],
  },
  ROBUX_RATE: {
    label: ['Robux rate', 'อัตรา Robux'],
    description: [
      'Robux received per one baht when packages are not configured.',
      'จำนวน Robux ที่ได้รับต่อหนึ่งบาทเมื่อไม่ได้กำหนดแพ็กเกจ',
    ],
  },
  ROBUX_PACKAGES: {
    label: ['Robux packages', 'แพ็กเกจ Robux'],
    description: [
      'Configure the Robux amounts available for purchase.',
      'กำหนดจำนวน Robux ที่สมาชิกสามารถเลือกซื้อได้',
    ],
  },
  ROBUX_PAYOUT_COOLDOWN_SECONDS: {
    label: ['Payout cooldown', 'ระยะพักระหว่างการโอน'],
    description: [
      'Delay between queued payouts, in seconds.',
      'ระยะเวลารอระหว่างรายการโอนในคิว หน่วยเป็นวินาที',
    ],
  },
  ROBUX_NOTIFICATION_CHANNEL_ID: {
    label: ['Notification channel', 'ช่องแจ้งเตือน'],
    description: ['Channel receiving payout results.', 'ช่องที่รับผลการทำรายการโอน Robux'],
  },
}

export const priceReaderConfigCopy: Record<
  string,
  { label: [string, string]; description: [string, string] }
> = {
  PRICE_READER_CHANNEL_ID: {
    label: ['Reader channel', 'ช่องอ่านราคา'],
    description: [
      'Channel where the bot reads Discord Shop screenshots.',
      'ช่องที่บอทใช้รับภาพหน้าจอ Discord Shop เพื่ออ่านราคา',
    ],
  },
  PRICE_READER_ORDER_CHANNEL_ID: {
    label: ['Order channel', 'ช่องสั่งซื้อ'],
    description: [
      'Optional destination for the order button.',
      'ช่องปลายทางสำหรับปุ่มสั่งซื้อ สามารถเว้นว่างได้',
    ],
  },
  PRICE_READER_PRICE_MAP: {
    label: ['Price map', 'ตารางราคา'],
    description: [
      'Map Discord prices to your shop prices, in THB.',
      'จับคู่ราคา Discord กับราคาขายของร้าน หน่วยเป็นบาท',
    ],
  },
  PRICE_READER_NO_NITRO_MARKUP_SATANG: {
    label: ['Non-Nitro markup', 'ค่าบวกเมื่อไม่มี Nitro'],
    description: [
      'Additional amount per item for buyers without Nitro, in satang.',
      'จำนวนเงินที่บวกต่อชิ้นเมื่อผู้ซื้อไม่มี Nitro หน่วยเป็นสตางค์',
    ],
  },
  PRICE_READER_RESULTS_ITEM_TEMPLATE: {
    label: ['Result item template', 'รูปแบบผลลัพธ์ต่อรูป'],
    description: [
      'Customize the text generated for each processed image.',
      'ปรับข้อความผลลัพธ์ที่สร้างสำหรับแต่ละรูป',
    ],
  },
}

export const robloxPresentationCopy: Record<
  string,
  { label: [string, string]; description: [string, string] }
> = {
  panel: {
    label: ['Robux shop panel', 'แผงร้าน Robux'],
    description: [
      'Public shop panel with live group stock.',
      'แผงร้านสาธารณะที่แสดง Robux คงเหลือของกลุ่ม',
    ],
  },
  eligibility: {
    label: ['Eligibility result', 'ผลตรวจสอบสิทธิ์'],
    description: ['Result after checking a Roblox username.', 'ผลหลังตรวจสอบชื่อผู้ใช้ Roblox'],
  },
  membership_result: {
    label: ['Group membership result', 'ผลตรวจสอบวันที่เข้ากลุ่ม'],
    description: [
      'Shows the current group join date and membership age.',
      'แสดงวันที่เข้ากลุ่มรอบปัจจุบันและจำนวนวันที่อยู่ในกลุ่ม',
    ],
  },
  package_selector: {
    label: ['Package selector', 'เลือกแพ็กเกจ'],
    description: [
      'Available packages based on wallet balance and group stock.',
      'แพ็กเกจที่ซื้อได้ตามยอดเงินและ Robux ในกลุ่ม',
    ],
  },
  confirmation: {
    label: ['Purchase confirmation', 'ยืนยันการซื้อ'],
    description: [
      'Confirmation before deducting the wallet balance.',
      'ข้อความยืนยันก่อนหักยอดเงินในกระเป๋า',
    ],
  },
  processing: {
    label: ['Payout processing', 'กำลังดำเนินการโอน'],
    description: ['Shown while processing the Roblox payout.', 'แสดงระหว่างประมวลผลการโอน Robux'],
  },
  queued: {
    label: ['Payout queued', 'เข้าคิวโอน Robux'],
    description: [
      'Shown after payment while waiting in the payout queue.',
      'แสดงหลังชำระเงินระหว่างรอคิวโอน',
    ],
  },
  succeeded: {
    label: ['Payout succeeded', 'โอน Robux สำเร็จ'],
    description: ['Successful payout receipt.', 'ใบยืนยันการโอน Robux สำเร็จ'],
  },
  failed: {
    label: ['Payout failed', 'โอน Robux ไม่สำเร็จ'],
    description: ['Failure and refund receipt.', 'ข้อความข้อผิดพลาดและการคืนเงิน'],
  },
  notification: {
    label: ['Payout notification', 'แจ้งเตือนการโอน'],
    description: ['Private payout audit notification.', 'ข้อความแจ้งเตือนผลการโอนสำหรับผู้ดูแล'],
  },
  notification_success: {
    label: ['Success notification', 'แจ้งเตือนรายการสำเร็จ'],
    description: ['Notification sent after a successful payout.', 'ข้อความแจ้งเตือนหลังโอนสำเร็จ'],
  },
  notification_error: {
    label: ['Error notification', 'แจ้งเตือนข้อผิดพลาด'],
    description: ['Notification sent when a payout fails.', 'ข้อความแจ้งเตือนเมื่อการโอนไม่สำเร็จ'],
  },
}

export const priceReaderPresentationCopy: Record<
  string,
  { label: [string, string]; description: [string, string] }
> = {
  processing: {
    label: ['Reading images', 'กำลังอ่านรูป'],
    description: [
      'Shown while OCR is processing uploaded images.',
      'แสดงระหว่างระบบ OCR กำลังอ่านรูปที่ส่งมา',
    ],
  },
  result: {
    label: ['Price reading result', 'ผลการอ่านราคา'],
    description: ['Result returned after OCR completes.', 'ผลลัพธ์ที่ส่งหลังจาก OCR อ่านราคาเสร็จ'],
  },
}

export const presentationModeOptions = [
  { value: 'EMBED', label: 'Embed' },
  { value: 'COMPONENTS_V2', label: 'Components V2' },
]

export const componentStyleOptions = [
  { value: 'primary', label: 'Primary · Blue' },
  { value: 'secondary', label: 'Secondary · Gray' },
  { value: 'success', label: 'Success · Green' },
  { value: 'danger', label: 'Danger · Red' },
]

export const componentStyles = ['primary', 'secondary', 'success', 'danger'] as const

export const walletActionDefaults: Record<
  string,
  { label: [string, string]; emoji: string; style: string }
> = {
  'wallet.topup': { label: ['Top up', 'เติมเงิน'], emoji: '💰', style: 'success' },
  'wallet.balance': {
    label: ['Check balance', 'เช็คยอดเงินคงเหลือ'],
    emoji: '💳',
    style: 'secondary',
  },
  'wallet.promptpay': { label: ['PromptPay', 'พร้อมเพย์ธนาคาร'], emoji: '🏦', style: 'primary' },
  'wallet.truemoney': {
    label: ['TrueMoney gift', 'ซองอั่งเปาทรูมันนี่'],
    emoji: '🧧',
    style: 'danger',
  },
}

export const variableDescriptions: Record<string, [english: string, thai: string]> = {
  action: ['Action that was completed', 'รายการที่ระบบดำเนินการ'],
  target: ['Message destination', 'ปลายทางของข้อความ'],
  message_url: ['URL of the Discord message', 'ลิงก์ไปยังข้อความ Discord'],
  message: ['Message returned by the system', 'ข้อความที่ระบบส่งกลับ'],
  content: ['Main message content', 'เนื้อหาหลักของข้อความ'],
  detail: ['Additional operation details', 'รายละเอียดเพิ่มเติมของรายการ'],
  status: ['Current operation status', 'สถานะปัจจุบันของรายการ'],
  error: ['Error description', 'รายละเอียดข้อผิดพลาด'],
  error_lines: ['List of errors, one per line', 'รายการข้อผิดพลาดแบบหลายบรรทัด'],
  reason: ['Reason for the operation', 'เหตุผลของรายการ'],
  failure_reason: ['Reason the operation failed', 'สาเหตุที่ดำเนินการไม่สำเร็จ'],
  failure_code: ['System failure code', 'รหัสข้อผิดพลาดของระบบ'],
  member: ['Discord member display name', 'ชื่อที่แสดงของสมาชิก Discord'],
  member_mention: ['Clickable Discord member mention', 'การ Mention สมาชิก Discord'],
  actor_mention: [
    'Mention of the administrator who performed the action',
    'Mention ผู้ดูแลที่ทำรายการ',
  ],
  avatar: ['Member avatar URL', 'URL รูปโปรไฟล์สมาชิก'],
  member_avatar_url: ['Member avatar URL', 'URL รูปโปรไฟล์สมาชิก'],
  bot_name: ['Current bot name', 'ชื่อของบอทตัวนี้'],
  amount: ['Amount for the current transaction', 'จำนวนเงินของรายการปัจจุบัน'],
  today: ['Amount added this time', 'ยอดที่เพิ่มในครั้งนี้'],
  total: ['Accumulated total amount', 'ยอดสะสมทั้งหมด'],
  balance: ['Current wallet balance', 'ยอดเงินคงเหลือปัจจุบัน'],
  balance_after: ['Wallet balance after the transaction', 'ยอดเงินหลังทำรายการ'],
  minimum_amount: ['Minimum accepted amount', 'จำนวนเงินขั้นต่ำที่รับได้'],
  refund: ['Refunded amount', 'จำนวนเงินที่คืน'],
  currency: ['Currency code such as THB', 'สกุลเงิน เช่น THB'],
  count: ['Accumulated number of uses', 'จำนวนครั้งสะสม'],
  entry_count: ['Number of transactions shown', 'จำนวนรายการที่แสดง'],
  member_count: ['Number of members in the result', 'จำนวนสมาชิกในผลลัพธ์'],
  updated_count: ['Number of members updated', 'จำนวนสมาชิกที่อัปเดตสำเร็จ'],
  image_count: ['Number of images submitted', 'จำนวนรูปภาพที่ส่งเข้ามา'],
  success_count: ['Number of images read successfully', 'จำนวนรูปที่อ่านสำเร็จ'],
  error_count: ['Number of images that failed', 'จำนวนรูปที่อ่านไม่สำเร็จ'],
  discord_price: ['Price detected from Discord', 'ราคาที่อ่านได้จาก Discord'],
  original_price: ['Original price before discount', 'ราคาเดิมก่อนลดราคา'],
  nitro_price: ['Discord Nitro price', 'ราคาสำหรับ Discord Nitro'],
  discount_percent: ['Detected discount percentage', 'เปอร์เซ็นต์ส่วนลดที่ตรวจพบ'],
  shop_price: ['Matched selling price from the shop table', 'ราคาขายที่ตรงจากตารางร้าน'],
  shop_price_found: ['Whether a matching shop price was found', 'พบราคาที่ตรงในตารางร้านหรือไม่'],
  no_nitro_markup: [
    'Additional price when Nitro is unavailable',
    'ราคาที่บวกเพิ่มเมื่อไม่มี Nitro',
  ],
  item_name: ['Detected product name', 'ชื่อสินค้าที่ตรวจพบ'],
  order_url: ['Configured purchase URL', 'ลิงก์สำหรับสั่งซื้อ'],
  results_text: ['Combined formatted results for every image', 'ผลลัพธ์ทุกภาพที่จัดรูปแบบรวมแล้ว'],
  result_index: ['Sequence number of the current image result', 'ลำดับของผลลัพธ์รูปปัจจุบัน'],
  discount_text: [
    'Formatted discount text, or blank when none',
    'ข้อความส่วนลด หรือค่าว่างเมื่อไม่มีส่วนลด',
  ],
  shop_price_text: [
    'Formatted shop price or not-found message',
    'ราคาขายที่จัดรูปแบบ หรือข้อความว่าไม่พบราคา',
  ],
  history_lines: ['Formatted wallet history rows', 'รายการประวัติกระเป๋าเงิน'],
  leaderboard_lines: ['Formatted ranking rows', 'รายการอันดับที่จัดรูปแบบแล้ว'],
  stock_lines: ['Formatted stock list', 'รายการสต็อกที่จัดรูปแบบแล้ว'],
  payment_method: ['Payment method used', 'ช่องทางการชำระเงิน'],
  transaction_time: ['Transaction date and time', 'วันและเวลาที่ทำรายการ'],
  datetime: ['Current formatted date and time', 'วันและเวลาที่จัดรูปแบบแล้ว'],
  expires_at: ['Expiration date and time', 'วันและเวลาหมดอายุ'],
  remaining: ['Remaining runtime', 'ระยะเวลาใช้งานที่เหลือ'],
  remaining_time: ['Formatted remaining time', 'เวลาคงเหลือที่จัดรูปแบบแล้ว'],
  renew_url: ['URL for renewing runtime', 'ลิงก์สำหรับต่ออายุ Runtime'],
  session_id: ['Top-up session reference', 'รหัสอ้างอิงรายการเติมเงิน'],
  qr_url: ['PromptPay QR image URL', 'URL รูป QR พร้อมเพย์'],
  slip_channel_url: ['Link to the slip submission channel', 'ลิงก์ไปยังห้องส่งสลิป'],
  account_name: ['PromptPay account name', 'ชื่อบัญชีพร้อมเพย์'],
  truemoney_fee: ['TrueMoney service fee', 'ค่าธรรมเนียม TrueMoney'],
  auto_renew: ['Current automatic renewal setting', 'สถานะการต่ออายุอัตโนมัติ'],
  username: ['Member or Roblox username', 'ชื่อผู้ใช้ของสมาชิกหรือ Roblox'],
  usernameRoblox: ['Roblox username', 'ชื่อผู้ใช้ Roblox'],
  roblox_username: ['Roblox username', 'ชื่อผู้ใช้ Roblox'],
  roblox_id: ['Roblox user ID', 'รหัสผู้ใช้ Roblox'],
  idRoblox: ['Roblox user ID', 'รหัสผู้ใช้ Roblox'],
  robux: ['Robux amount', 'จำนวน Robux'],
  price: ['Purchase price', 'ราคาที่ต้องชำระ'],
  rate: ['Robux exchange rate', 'อัตราแลกเปลี่ยน Robux'],
  group_name: ['Roblox group name', 'ชื่อกลุ่ม Roblox'],
  group_id: ['Roblox group ID', 'รหัสกลุ่ม Roblox'],
  group_robux: ['Robux available in the group', 'Robux คงเหลือในกลุ่ม'],
  group_stock: ['Available group stock', 'สต็อกคงเหลือของกลุ่ม'],
  queue: ['Current queue position', 'ลำดับคิวปัจจุบัน'],
}

export const coFeatureCatalog = [
  {
    featureCode: 'wallet-topup',
    action: 'wallet.topup',
    label: 'Wallet · เติมเงิน',
    emoji: '💰',
    style: 'success',
  },
  {
    featureCode: 'wallet-topup',
    action: 'wallet.balance',
    label: 'Wallet · เช็คยอดเงิน',
    emoji: '💳',
    style: 'secondary',
  },
]
