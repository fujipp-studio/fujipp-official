export const priceReaderConfigCopy: Record<
  string,
  { label: [string, string]; description: [string, string] }
> = {
  GEMINI_API_KEY: {
    label: ['Gemini API key', 'Gemini API key'],
    description: [
      'Your Google AI Studio API key. Stored encrypted.',
      'API key จาก Google AI Studio ของคุณ ระบบจัดเก็บแบบเข้ารหัส',
    ],
  },
  PRICE_READER_GEMINI_MODEL: {
    label: ['Gemini model', 'โมเดล Gemini'],
    description: [
      'Use an image-capable model with structured output. Check availability and quota in Google AI Studio.',
      'ใช้โมเดลที่รองรับรูปภาพและ Structured output ตรวจสอบโมเดลและโควตาใน Google AI Studio',
    ],
  },
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

export const priceReaderPresentationCopy: Record<
  string,
  { label: [string, string]; description: [string, string] }
> = {
  error: {
    label: ['Unable to read prices', 'อ่านราคาไม่สำเร็จ'],
    description: [
      'Shown when none of the images contain a supported price.',
      'แสดงเมื่ออ่านราคาไม่สำเร็จทุกรูป',
    ],
  },
  processing: {
    label: ['Reading images', 'กำลังอ่านรูป'],
    description: [
      'Shown while the reader is processing uploaded images.',
      'แสดงระหว่างระบบกำลังอ่านรูปที่ส่งมา',
    ],
  },
  result: {
    label: ['Price reading result', 'ผลการอ่านราคา'],
    description: ['Result returned after image reading completes.', 'ผลลัพธ์ที่ส่งหลังจากอ่านราคาเสร็จ'],
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
  base_amount: ['Payment amount before fees', 'ยอดชำระก่อนค่าธรรมเนียม'],
  fee_amount: ['Additional payment fee', 'ค่าธรรมเนียมที่บวกเพิ่ม'],
  total_amount: ['Total payment amount including fees', 'ยอดชำระรวมค่าธรรมเนียม'],
  today: ['Amount added this time', 'ยอดที่เพิ่มในครั้งนี้'],
  this_month: [
    'Spending this monthly cycle (THB, Thailand time)',
    'ยอดสะสมรอบเดือนปัจจุบัน (บาท ตามเวลาไทย)',
  ],
  this_month_count: ['Transactions this monthly cycle', 'จำนวนครั้งในรอบเดือนปัจจุบัน'],
  month: ['Selected month in YYYY-MM format', 'เดือนที่เลือกในรูปแบบ YYYY-MM'],
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
  matched_discord_price: [
    'Discord price selected from the price map',
    'ราคา Discord ในแถวที่ถูกเลือกจากตาราง',
  ],
  match_distance: [
    'Difference between detected and matched prices, in THB',
    'ส่วนต่างระหว่างราคาที่อ่านได้กับคู่ราคา หน่วยบาท',
  ],
  error_message: ['Reason an image could not be read', 'ข้อความสาเหตุที่อ่านรูปไม่สำเร็จ'],
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
  qr_image_url: ['Configured bank QR image URL', 'URL รูป QR ธนาคารที่ตั้งค่าไว้'],
  wallet_number: ['Configured Wallet recipient number', 'หมายเลข Wallet ที่ตั้งค่าไว้'],
  trigger: ['Configured message trigger', 'ข้อความ Trigger ที่ตั้งค่าไว้'],
  slip_channel_url: [
    'Slip channel link (use in a link button, not an image)',
    'ลิงก์ห้องส่งสลิป ใช้กับปุ่มลิงก์ ส่วนรูป QR ใช้ {{qr_url}}',
  ],
  account_name: ['PromptPay account name', 'ชื่อบัญชีพร้อมเพย์'],
  truemoney_fee: ['TrueMoney service fee', 'ค่าธรรมเนียม TrueMoney'],
  auto_renew: ['Current automatic renewal setting', 'สถานะการต่ออายุอัตโนมัติ'],
  username: ['Member or Roblox username', 'ชื่อผู้ใช้ของสมาชิกหรือ Roblox'],
  usernameRoblox: ['Roblox username', 'ชื่อผู้ใช้ Roblox'],
  roblox_username: ['Roblox username', 'ชื่อผู้ใช้ Roblox'],
  roblox_id: ['Roblox user ID', 'รหัสผู้ใช้ Roblox'],
  idRoblox: ['Roblox user ID', 'รหัสผู้ใช้ Roblox'],
  robux: ['Robux amount', 'จำนวน Robux'],
  package: ['Purchased Robux package', 'แพ็กเกจ Robux ที่ซื้อ'],
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
