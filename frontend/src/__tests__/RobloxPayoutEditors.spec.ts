import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { describe, expect, it } from 'vitest'
import RobloxGroupEditor from '../features/bots/components/RobloxGroupEditor.vue'
import RobuxPackagesEditor from '../features/bots/components/RobuxPackagesEditor.vue'
import { robloxPayoutCommands } from '../features/bots/config/feature-commands'
import botSettings from '../i18n/locales/en/botSettings'

const global = {
  plugins: [createI18n({ legacy: false, locale: 'en', messages: { en: { botSettings } } })],
}
describe('Roblox payout editors', () => {
  it('keeps existing metadata and hidden rates without submitting saved credentials on a public edit', async () => {
    const original = {
      key: 'main',
      name: 'Main Group',
      groupId: 12345,
      rate: 3.5,
      future: { retained: true },
    }
    const wrapper = mount(RobloxGroupEditor, {
      global,
      props: {
        groupsJson: JSON.stringify([original]),
        credentialsJson: '',
        credentialsConfigured: true,
        showRate: false,
      },
    })
    expect(wrapper.emitted('update:groupsJson')).toBeUndefined()
    expect(wrapper.get('.roblox-group__section--security').attributes('open')).toBeUndefined()
    await wrapper.findAll('input')[0]!.setValue('New name')
    expect(JSON.parse(String(wrapper.emitted('update:groupsJson')?.at(-1)?.[0]))).toEqual([
      { ...original, name: 'New name' },
    ])
    expect(wrapper.emitted('update:credentialsJson')?.at(-1)).toEqual([''])
    wrapper.unmount()
  })

  it('retains draft credentials for other groups while editing one credential', async () => {
    const wrapper = mount(RobloxGroupEditor, {
      global,
      props: {
        groupsJson: JSON.stringify([
          { key: 'main', name: 'Main', groupId: 1 },
          { key: 'other', name: 'Other', groupId: 2 },
        ]),
        credentialsJson: JSON.stringify({
          main: { cookie: 'draft-cookie', future: 'keep' },
          other: { cookie: 'other-draft' },
        }),
        showMembershipLookup: true,
      },
    })
    const secretInputs = wrapper.findAll('.roblox-group').at(0)!.findAll('input[type="password"]')
    await secretInputs[2]!.setValue('draft-api-key')
    expect(JSON.parse(String(wrapper.emitted('update:credentialsJson')?.at(-1)?.[0]))).toEqual({
      main: { cookie: 'draft-cookie', future: 'keep', openCloudApiKey: 'draft-api-key' },
      other: { cookie: 'other-draft' },
    })
    wrapper.unmount()
  })

  it('keeps package metadata aligned when deleting and adding packages', async () => {
    const wrapper = mount(RobuxPackagesEditor, {
      global,
      props: {
        modelValue: JSON.stringify([
          { robux: 350, future: 'first' },
          { robux: 700, future: 'second' },
        ]),
        rate: 3.5,
      },
    })
    await wrapper.findAll('.packages-editor__delete')[0]!.trigger('click')
    await wrapper.findAll('input')[0]!.setValue('800')
    expect(JSON.parse(String(wrapper.emitted('update:modelValue')?.at(-1)?.[0]))).toEqual([
      { robux: 800, future: 'second' },
    ])
    await wrapper.get('.packages-editor__add').trigger('click')
    await wrapper.findAll('input')[1]!.setValue('1000')
    expect(JSON.parse(String(wrapper.emitted('update:modelValue')?.at(-1)?.[0]))).toEqual([
      { robux: 800, future: 'second' },
      { robux: 1000 },
    ])
    wrapper.unmount()
  })

  it.each(['1.0.0', '2.0.0', '2.0.1', '2.1.0', '2.2.0', '3.0.0'])(
    'only lists commands available in %s',
    (version) => {
      expect(robloxPayoutCommands('shop-panel', version).map((command) => command.name)).toEqual([
        'shop-panel',
        ...(['2.2.0', '3.0.0'].includes(version) ? ['robux-receipt'] : []),
      ])
    },
  )
})
