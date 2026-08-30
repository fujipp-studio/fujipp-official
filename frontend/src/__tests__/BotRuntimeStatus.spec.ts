import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'

import BotSettingsShell from '../features/bots/components/BotSettingsShell.vue'
import {
  botRuntimeDisplayState,
  isBotOnline,
  type BotControlAction,
} from '../features/bots/runtime-status'
import { type UserBot } from '@/features/bots/api'

const state = (status: string, desiredState: 'RUNNING' | 'STOPPED') => ({
  status,
  desiredState,
})

describe('bot runtime presentation', () => {
  it('does not show a stopped bot as online when the reported runtime status is stale', () => {
    const bot = state('RUNNING', 'STOPPED')

    expect(isBotOnline(bot)).toBe(false)
    expect(botRuntimeDisplayState(bot)).toBe('stopped')
  })

  it('shows transitional labels only while a control action is pending', () => {
    const bot = state('RUNNING', 'STOPPED')

    expect(botRuntimeDisplayState(bot, 'stop')).toBe('stopping')
    expect(botRuntimeDisplayState(bot)).toBe('stopped')
  })

  it.each<[BotControlAction, string]>([
    ['start', 'starting'],
    ['stop', 'stopping'],
    ['restart', 'restarting'],
  ])('maps a pending %s action to %s', (action, expected) => {
    expect(botRuntimeDisplayState(state('STOPPED', 'RUNNING'), action)).toBe(expected)
  })

  it('reports online only when actual and desired states are both running', () => {
    expect(isBotOnline(state('RUNNING', 'RUNNING'))).toBe(true)
    expect(isBotOnline(state('STOPPED', 'RUNNING'))).toBe(false)
    expect(isBotOnline(state('CRASHED', 'RUNNING'))).toBe(false)
  })
})

describe('BotSettingsShell', () => {
  const staleStoppedBot: UserBot = {
    id: 'bot-id',
    name: 'Fujipp',
    discordApplicationId: null,
    discordGuildId: null,
    discordUsername: null,
    discordAvatarUrl: null,
    status: 'RUNNING',
    desiredState: 'STOPPED',
    restartRevision: 0,
    createdAt: '',
    updatedAt: '',
  }

  it('keeps the badge and settled runtime label consistent', async () => {
    const wrapper = mount(BotSettingsShell, { props: { bot: staleStoppedBot } })

    expect(wrapper.text()).toContain('offline')
    expect(wrapper.text()).toContain('Stopped')
    expect(wrapper.text()).not.toContain('Stopping…')

    await wrapper.setProps({ controlAction: 'stop', controlling: true })

    expect(wrapper.text()).toContain('Stopping…')
  })
})
