export interface FeatureSubcommand {
  name: string
  description: { en: string; th: string }
}

// Shared by Feature settings and Bot Permissions suggestions.
export const voiceKeeperCommands: readonly FeatureSubcommand[] = [
  {
    name: 'join',
    description: {
      en: 'Choose a voice or stage channel. The bot returns to this channel after a restart.',
      th: 'เลือกห้อง Voice หรือ Stage บอทจะกลับเข้าห้องนี้หลัง Restart',
    },
  },
  {
    name: 'leave',
    description: {
      en: 'Leave the channel and stop automatic reconnection after restart.',
      th: 'ออกจากห้องและหยุดการกลับเข้าห้องอัตโนมัติหลัง Restart',
    },
  },
]

export function reviewCreditCommands(manualCount: boolean): FeatureSubcommand[] {
  return [
    { name: 'recount', description: { en: 'Recount all reviews.', th: 'นับรีวิวใหม่ทั้งหมด' } },
    {
      name: 'refresh',
      description: {
        en: 'Refresh reactions and the reply on the latest review.',
        th: 'รีเฟรช Reaction และข้อความตอบกลับของรีวิวล่าสุด',
      },
    },
    ...(manualCount
      ? [
          {
            name: 'set-count',
            description: {
              en: 'Replace the saved review count.',
              th: 'ตั้งจำนวนรีวิวที่บันทึกไว้',
            },
          },
        ]
      : []),
  ]
}

export function walletTopupCommands(panelName: string): FeatureSubcommand[] {
  return [
    {
      name: panelName,
      description: {
        en: 'Post the top-up panel · Administrator only.',
        th: 'ส่งแผงเติมเงิน · เฉพาะ Administrator',
      },
    },
    {
      name: 'topup-slip',
      description: {
        en: 'Submit a PromptPay slip with a session ID.',
        th: 'แนบสลิปพร้อมเพย์พร้อมรหัสรายการ',
      },
    },
    {
      name: 'wallet-admin/balance',
      description: { en: 'Check a member’s balance.', th: 'ดูยอดเงินสมาชิก' },
    },
    {
      name: 'wallet-admin/add',
      description: {
        en: 'Add member balance with an audit reason.',
        th: 'เพิ่มยอดเงินสมาชิกพร้อมเหตุผล',
      },
    },
    {
      name: 'wallet-admin/remove',
      description: {
        en: 'Remove member balance with an audit reason.',
        th: 'ลดยอดเงินสมาชิกพร้อมเหตุผล',
      },
    },
    {
      name: 'wallet-admin/set',
      description: {
        en: 'Set member balance with an audit reason.',
        th: 'ตั้งยอดเงินสมาชิกพร้อมเหตุผล',
      },
    },
    {
      name: 'history',
      description: { en: 'Show member wallet history.', th: 'ดูประวัติกระเป๋าเงินสมาชิก' },
    },
    {
      name: 'topup-monthly',
      description: {
        en: 'Show top-ups from the last month.',
        th: 'ดูยอดเติมเงินในหนึ่งเดือนล่าสุด',
      },
    },
    {
      name: 'top',
      description: {
        en: 'Show the Top 10 and update ranking roles.',
        th: 'แสดง Top 10 และอัปเดตยศอันดับ',
      },
    },
  ]
}

export function robloxPayoutCommands(panelName: string, version: string): FeatureSubcommand[] {
  return [
    {
      name: panelName,
      description: {
        en: 'Post the Robux panel in the current channel.',
        th: 'ส่งแผง Robux ในห้องที่ใช้คำสั่ง',
      },
    },
    ...(['2.2.0', '3.0.0'].includes(version)
      ? [
          {
            name: 'robux-receipt',
            description: {
              en: 'Create a manual receipt with a package, price and optional recipient.',
              th: 'สร้างใบเสร็จโดยระบุแพ็กเกจ ราคา และผู้รับได้',
            },
          },
        ]
      : []),
  ]
}
