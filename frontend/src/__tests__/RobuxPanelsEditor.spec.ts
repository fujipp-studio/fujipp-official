import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { createI18n } from 'vue-i18n'
import { describe, expect, it } from 'vitest'

import RobuxPanelsEditor from '../features/bots/components/RobuxPanelsEditor.vue'
import botSettings from '../i18n/locales/en/botSettings'

describe('RobuxPanelsEditor', () => {
  it('saves a membership-only mode for an individual panel', async () => {
    const wrapper = mount(RobuxPanelsEditor, {
      attachTo: document.body,
      props: {
        panelsJson: JSON.stringify([
          {
            key: 'main',
            name: 'Main Panel',
            groupKeys: ['main'],
            presentationSlot: 'panel_1',
          },
        ]),
        groupsJson: JSON.stringify([{ key: 'main', name: 'Main Group' }]),
      },
      global: {
        plugins: [
          createI18n({
            legacy: false,
            locale: 'en',
            messages: { en: { botSettings } },
          }),
        ],
      },
    })

    await wrapper.get('[role="combobox"]').trigger('click')
    const option = [...document.body.querySelectorAll<HTMLButtonElement>('[role="option"]')].find(
      (item) => item.textContent?.includes('Membership check only'),
    )
    expect(option).toBeDefined()
    option?.click()
    await nextTick()

    const updates = wrapper.emitted('update:panelsJson') ?? []
    const latest = JSON.parse(String(updates.at(-1)?.[0]))
    expect(latest[0].mode).toBe('membership_only')

    wrapper.unmount()
  })
})
