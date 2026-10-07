import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'

import { i18n } from '@/i18n'

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
  beforeEach(() => {
    i18n.global.locale.value = 'en'
  })
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
    const wrapper = mount(BotSettingsShell, {
      props: { bot: staleStoppedBot },
      global: { plugins: [i18n] },
    })

    expect(wrapper.text()).toContain('Offline')
    expect(wrapper.text()).toContain('Stopped')
    expect(wrapper.text()).not.toContain('Stopping…')

    await wrapper.setProps({ controlAction: 'stop', controlling: true })

    expect(wrapper.text()).toContain('Stopping…')
    wrapper.unmount()
  })

  it('updates translated controls and pending runtime labels when the app language changes', async () => {
    const wrapper = mount(BotSettingsShell, {
      props: { bot: staleStoppedBot, controlAction: 'start' },
      global: { plugins: [i18n] },
    })
    i18n.global.locale.value = 'th'
    await wrapper.vm.$nextTick()
    expect(wrapper.text()).toContain('กำลังเริ่มทำงาน…')
    expect(wrapper.text()).toContain('ออฟไลน์')
    expect(wrapper.get('h1').text()).toBe('ตั้งค่าบอท')
    expect(wrapper.get('nav').text()).toBe('หน้าหลัก')
    const start = wrapper.findAll('button').find((button) => button.text() === 'เริ่ม')!
    await start.trigger('click')
    expect(wrapper.emitted('control')).toEqual([['start']])
    await wrapper.setProps({
      bot: { ...staleStoppedBot, desiredState: 'RUNNING' },
      controlAction: 'restart',
    })
    expect(wrapper.text()).toContain('กำลังเริ่มใหม่…')
    expect(wrapper.text()).toContain('ออนไลน์')
    i18n.global.locale.value = 'en'
    await wrapper.vm.$nextTick()
    expect(wrapper.text()).toContain('Restarting…')
    expect(wrapper.findAll('button').map((button) => button.text())).toContain('Stop')
    wrapper.unmount()
  })
})
