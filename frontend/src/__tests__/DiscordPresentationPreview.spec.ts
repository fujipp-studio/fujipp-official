import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { createI18n } from 'vue-i18n'

import DiscordPresentationPreview from '../features/bots/components/DiscordPresentationPreview.vue'

describe('DiscordPresentationPreview', () => {
  const global = {
    plugins: [createI18n({ legacy: false, locale: 'en', messages: { en: {}, th: {} } })],
  }
  it('renders the selected nested embed with sample variables', () => {
    const wrapper = mount(DiscordPresentationPreview, {
      props: {
        definition: {
          mode: 'EMBED',
          embed: {
            title: 'ยอดเงิน {{balance}} {{currency}}',
            description: 'สวัสดี {{member_mention}}',
          },
          components_v2: { title: 'Components title' },
        },
        variables: ['balance', 'currency', 'member_mention'],
      },
      global,
    })

    expect(wrapper.text()).toContain('ยอดเงิน 350.00 THB')
    expect(wrapper.text()).toContain('สวัสดี @Fujipp')
    expect(wrapper.text()).not.toContain('Components title')
  })

  it('renders interactive Components V2 actions without exposing action IDs', async () => {
    const wrapper = mount(DiscordPresentationPreview, {
      props: {
        definition: {
          mode: 'COMPONENTS_V2',
          components_v2: { title: 'ร้านค้า', description: 'เลือกสินค้า' },
          actions: ['wallet.topup', 'wallet.balance'],
        },
        variables: [],
      },
      global,
    })

    expect(wrapper.text()).toContain('Discord Components V2')
    expect(wrapper.text()).toContain('Top up')
    expect(wrapper.text()).toContain('Check balance')
    expect(wrapper.text()).not.toContain('wallet.topup')

    await wrapper.get('button.preview-button--success').trigger('click')
    expect(wrapper.get('[role="status"]').text()).toContain('Previewed action: Top up')
  })

  it('renders realistic sample content for result variables', () => {
    const wrapper = mount(DiscordPresentationPreview, {
      props: {
        definition: { mode: 'COMPONENTS_V2', description: '{{results_text}}' },
        variables: ['results_text'],
      },
      global,
    })

    expect(wrapper.text()).toContain('iPhone 16 Pro Max')
    expect(wrapper.text()).toContain('39,900 บาท')
    expect(wrapper.text()).not.toContain('results_text')
  })

  it('renders static and animated Discord custom emoji in embeds and buttons', () => {
    const wrapper = mount(DiscordPresentationPreview, {
      props: {
        definition: {
          mode: 'EMBED',
          embed: { title: '<:coin:123456789012345678>' },
          actions: ['wallet.topup'],
          action_overrides: { 'wallet.topup': { emoji: '<a:money:987654321098765432>' } },
        },
        variables: [],
      },
      global,
    })

    const emojiSources = wrapper.findAll('img.discord-custom-emoji').map((item) => item.attributes('src'))
    expect(emojiSources).toContain('https://cdn.discordapp.com/emojis/123456789012345678.png?size=48&quality=lossless')
    expect(emojiSources).toContain('https://cdn.discordapp.com/emojis/987654321098765432.gif?size=48&quality=lossless')
  })

  it('renders Discord markdown headings at their visual hierarchy', () => {
    const wrapper = mount(DiscordPresentationPreview, {
      props: {
        definition: {
          mode: 'COMPONENTS_V2',
          components_v2: { description: '# ยอดเงินคงเหลือ\n## 350.00 THB\n**พร้อมใช้งาน**' },
        },
        variables: [],
      },
      global,
    })

    expect(wrapper.find('.discord-markdown h1').text()).toBe('ยอดเงินคงเหลือ')
    expect(wrapper.find('.discord-markdown h2').text()).toBe('350.00 THB')
    expect(wrapper.find('.discord-markdown strong').text()).toBe('พร้อมใช้งาน')
  })

  it('renders Discord subtext, button style, emoji, and Co-Feature actions', () => {
    const wrapper = mount(DiscordPresentationPreview, {
      props: {
        definition: {
          mode: 'COMPONENTS_V2',
          description: '-# **ชื่อบัญชี** FUJIPP COMPANY',
          components: { confirm: { label: 'ยืนยัน', emoji: '✅', style: 3 } },
          co_features: [
            { action: 'wallet.topup', label: 'เติมเงิน', emoji: '💰', style: 'success' },
          ],
        },
        variables: [],
      },
      global,
    })

    expect(wrapper.find('.discord-subtext').text()).toBe('ชื่อบัญชี FUJIPP COMPANY')
    expect(wrapper.find('.discord-subtext').classes()).toContain('discord-subtext')
    expect(wrapper.findAll('.preview-button--success')).toHaveLength(2)
    expect(wrapper.text()).toContain('✅ยืนยัน')
    expect(wrapper.text()).toContain('💰เติมเงิน')
  })
})
