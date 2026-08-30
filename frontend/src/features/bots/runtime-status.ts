import { type UserBot } from '@/features/bots/api'

export type BotControlAction = 'start' | 'stop' | 'restart'
export type BotRuntimeDisplayState =
  'starting' | 'stopping' | 'restarting' | 'running' | 'stopped' | 'crashed' | 'offline'

type BotRuntimeState = Pick<UserBot, 'desiredState' | 'status'>

export function isBotOnline(bot: BotRuntimeState) {
  return bot.desiredState === 'RUNNING' && bot.status === 'RUNNING'
}

export function botRuntimeDisplayState(
  bot: BotRuntimeState,
  pendingAction: BotControlAction | null = null,
): BotRuntimeDisplayState {
  if (pendingAction === 'start') return 'starting'
  if (pendingAction === 'stop') return 'stopping'
  if (pendingAction === 'restart') return 'restarting'

  if (bot.desiredState === 'STOPPED') return 'stopped'
  if (bot.status === 'RUNNING') return 'running'
  if (bot.status === 'CRASHED') return 'crashed'
  if (bot.status === 'STOPPED') return 'stopped'
  return 'offline'
}
