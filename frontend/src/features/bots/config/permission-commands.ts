import type { FeatureConfiguration, FeatureLicense } from '../api'
import {
  reviewCreditCommands,
  voiceKeeperCommands,
  walletTopupCommands,
  robloxPayoutCommands,
} from './feature-commands'

export interface PermissionCommand {
  value: string
  description: { en: string; th: string }
}
export interface PermissionCommandFeature {
  id: string
  name: string
  commands: PermissionCommand[]
  unavailable?: boolean
}

// Keep suggestions aligned with command registration and permission gates in bot-runner/src/features.
const versions: Record<string, string[]> = {
  'member-spending': ['1.0.0'],
  'wallet-topup': ['1.0.0', '2.0.0', '2.1.0'],
  'admin-message-tools': ['1.0.0'],
  'voice-keeper': ['1.0.0'],
  'review-credit': ['1.0.0', '1.1.0'],
  'roblox-robux-payout': ['1.0.0', '2.0.0', '2.0.1', '2.1.0', '2.2.0', '3.0.0'],
}
export function hasPermissionCommandSuggestions(license: FeatureLicense) {
  return versions[license.featureCode]?.includes(license.version) ?? false
}
export function needsCommandConfiguration(license: FeatureLicense) {
  return ['wallet-topup', 'voice-keeper', 'review-credit', 'roblox-robux-payout'].includes(
    license.featureCode,
  )
}
export function permissionCommands(
  license: FeatureLicense,
  configuration?: FeatureConfiguration,
): PermissionCommandFeature {
  const values = Object.fromEntries(
    (configuration?.fields ?? []).map((field) => [field.key, field.value ?? field.defaultValue]),
  )
  const command = (value: string, en: string, th: string): PermissionCommand => ({
    value,
    description: { en, th },
  })
  const name = (key: string, fallback: string) =>
    typeof values[key] === 'string' && values[key].trim()
      ? values[key].trim().toLowerCase()
      : fallback
  const all = (name: string) =>
    command(name, `All subcommands of /${name}`, `ทุกคำสั่งย่อยของ /${name}`)
  let commands: PermissionCommand[] = []
  switch (license.featureCode) {
    case 'member-spending':
      commands = [
        all('spending'),
        command('spending/add', 'Add spending', 'เพิ่มยอดสะสม'),
        command('spending/update', 'Update totals or purchase count', 'แก้ไขยอดรวมหรือจำนวนครั้ง'),
        command('spending/delete', 'Delete member data', 'ลบข้อมูลสมาชิก'),
        command('spending/check', 'Check a member card', 'ตรวจสอบบัตรสมาชิก'),
        command('spending/list', 'Show spending leaderboard', 'ดูอันดับยอดสะสม'),
        command('spending/total', 'Show total spending', 'ดูยอดรวมทั้งหมด'),
        command('spending/rank', 'Refresh leaderboard roles', 'รีเฟรชยศอันดับ'),
      ]
      break
    case 'wallet-topup':
      commands = [
        ...walletTopupCommands(name('PANEL_COMMAND_NAME', 'wallet-panel')).map((item) => ({
          value: item.name,
          description: item.description,
        })),
        all('wallet-admin'),
      ]
      break
    case 'admin-message-tools':
      commands = [
        command('dm', 'Send a direct message', 'ส่งข้อความส่วนตัว'),
        all('message'),
        command('message/send', 'Send a channel message', 'ส่งข้อความในห้อง'),
        command('message/sendfile', 'Send a file', 'ส่งไฟล์ในห้อง'),
        command('message/edit', 'Edit a bot message', 'แก้ไขข้อความของบอท'),
      ]
      break
    case 'voice-keeper': {
      const root = name('COMMAND_NAME', 'voice')
      commands = [
        all(root),
        ...voiceKeeperCommands.map((item) => ({
          value: `${root}/${item.name}`,
          description: item.description,
        })),
      ]
      break
    }
    case 'review-credit': {
      const root = name('REVIEW_COMMAND_NAME', 'review')
      commands = [
        all(root),
        ...reviewCreditCommands(
          license.version === '1.1.0' || values.REVIEW_COUNT_WEBHOOKS != null,
        ).map((item) => ({ value: `${root}/${item.name}`, description: item.description })),
      ]
      break
    }
    case 'roblox-robux-payout':
      commands = robloxPayoutCommands(
        name('PANEL_COMMAND_NAME', 'robux-panel'),
        license.version,
      ).map((item) => ({ value: item.name, description: item.description }))
  }
  return { id: license.id, name: license.featureName, commands }
}
