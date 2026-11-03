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
  ROBUX_PANELS: {
    label: ['Robux panels', 'Panel ขาย Robux'],
    description: [
      'Choose the Roblox groups and available actions for each panel.',
      'เลือกกลุ่ม Roblox และรูปแบบการใช้งานของแต่ละ Panel',
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
  ROBUX_SUCCESS_NOTIFICATION_CHANNEL_ID: {
    label: ['Success notification channel', 'ห้องแจ้งโอนสำเร็จ'],
    description: [
      'Channel receiving successful payout notifications.',
      'ห้องรับแจ้งเตือนเมื่อโอน Robux สำเร็จ',
    ],
  },
  ROBUX_ERROR_NOTIFICATION_CHANNEL_ID: {
    label: ['Error notification channel', 'ห้องแจ้งข้อผิดพลาด'],
    description: [
      'Channel receiving failed or refunded payout notifications.',
      'ห้องรับแจ้งเตือนเมื่อโอนไม่สำเร็จหรือคืนเงิน',
    ],
  },
  ROBUX_RECEIPT_CHANNEL_ID: {
    label: ['Receipt channel', 'ห้องใบเสร็จ'],
    description: [
      'Channel receiving successful purchase receipts.',
      'ห้องที่รับใบเสร็จเมื่อโอน Robux สำเร็จ',
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
  receipt: {
    label: ['Purchase receipt', 'ใบเสร็จการซื้อ Robux'],
    description: [
      'Receipt sent to the purchasing member after a successful payout.',
      'ใบเสร็จที่ส่งให้ผู้ซื้อหลังโอน Robux สำเร็จ',
    ],
  },
  manual_receipt: {
    label: ['Manual purchase receipt', 'ใบเสร็จรายการอื่น'],
    description: [
      'Receipt created manually with the administrator command.',
      'ใบเสร็จที่สร้างด้วยคำสั่งสำหรับผู้ดูแล',
    ],
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
