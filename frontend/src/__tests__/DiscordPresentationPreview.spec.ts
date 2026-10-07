import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { createI18n } from 'vue-i18n'

import DiscordPresentationPreview from '../features/bots/components/DiscordPresentationPreview.vue'

describe('DiscordPresentationPreview', () => {
  const global = {
    plugins: [createI18n({ legacy: false, locale: 'en', messages: { en: {}, th: {} } })],
  }
  it.each(['EMBED', 'COMPONENTS_V2'])(
    'explains a broken image in %s and loads a replacement URL',
    async (mode) => {
      const expiredUrl = 'https://media.discordapp.net/attachments/1/2/image.png?ex=6abe0f04'
      const definition =
        mode === 'EMBED'
          ? { mode, image_url: expiredUrl }
          : { mode, components: [{ type: 12, items: [{ media: { url: expiredUrl } }] }] }
      const wrapper = mount(DiscordPresentationPreview, {
        global,
        props: { definition, variables: [] },
      })
      const image = wrapper.findAll('img').find((image) => image.attributes('src') === expiredUrl)!
      await image.trigger('error')
      expect(wrapper.text()).toContain('Image could not be loaded in this preview')
      expect(wrapper.text()).not.toContain('expired')
      const fresh = '/new-image.png'
      await wrapper.setProps({
        definition:
          mode === 'EMBED'
            ? { mode, image_url: fresh }
            : { mode, components: [{ type: 12, items: [{ media: { url: fresh } }] }] },
      })
      expect(wrapper.find('[data-preview-image-error]').exists()).toBe(false)
      expect(wrapper.findAll('img').some((image) => image.attributes('src') === fresh)).toBe(true)
      wrapper.unmount()
    },
  )
  it('renders member and actor mentions with Discord styling and keeps code literal', () => {
    const wrapper = mount(DiscordPresentationPreview, {
      props: {
        definition: {
          mode: 'COMPONENTS_V2',
          components: [
            { type: 10, content: '{{member_mention}} · {{actor_mention}} · <@!1234> · `<@1234>`' },
          ],
        },
        variables: ['member_mention', 'actor_mention'],
      },
      global,
    })
    expect(wrapper.findAll('.discord-mention').map((mention) => mention.text())).toEqual([
      '@Fujipp',
      '@Admin',
      '@User',
    ])
    expect(wrapper.get('code').text()).toBe('<@1234>')
    expect(wrapper.get('code').find('.discord-mention').exists()).toBe(false)
  })
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

  it('renders a legacy embeds array used by generic Features', () => {
    const wrapper = mount(DiscordPresentationPreview, {
      props: {
        definition: {
          mode: 'EMBED',
          content: 'Outside the embed',
          embeds: [{ title: 'Array title', description: 'Array description', color: 0x123456 }],
        },
        variables: [],
      },
      global,
    })

    expect(wrapper.text()).toContain('Outside the embed')
    expect(wrapper.text()).toContain('Array title')
    expect(wrapper.text()).toContain('Array description')
    expect(wrapper.find('.preview-embed').attributes('style')).toContain('rgb(18, 52, 86)')
  })

  it('previews Wallet balance without inventing an avatar thumbnail or an accent', () => {
    const wrapper = mount(DiscordPresentationPreview, {
      props: {
        definition: {
          mode: 'EMBED',
          title: '💳 เงินในบัญชีของคุณ',
          description: '# ยอดคงเหลือ {{balance}} {{currency}}',
          thumbnail_url: '{{member_avatar_url}}',
        },
        sampleValues: { member_avatar_url: '' },
        variables: ['balance', 'currency', 'member_avatar_url'],
      },
      global,
    })
    expect(wrapper.get('.preview-copy h1').text()).toBe('ยอดคงเหลือ 350.00 THB')
    expect(wrapper.get('.discord-unicode-emoji').attributes('src')).toContain('/svg/1f4b3.svg')
    expect(wrapper.find('.preview-thumbnail').exists()).toBe(false)
    expect(wrapper.get('.preview-embed').classes()).not.toContain('preview-embed--thumbnail')
    expect(wrapper.get('.preview-embed').attributes('style')).toContain('var(--discord-border)')
  })

  it('keeps Unicode emoji sequences and escaped content intact when rendering Markdown', () => {
    const wrapper = mount(DiscordPresentationPreview, {
      props: {
        definition: {
          mode: 'EMBED',
          description: '**👨‍👩‍👧‍👦** · 1️⃣ · 🇹🇭 · <script>alert(1)</script>',
        },
        variables: [],
      },
      global,
    })
    expect(wrapper.findAll('.discord-unicode-emoji')).toHaveLength(3)
    expect(wrapper.get('.preview-copy').text()).toContain('👨‍👩‍👧‍👦')
    expect(wrapper.get('.preview-copy').text()).toContain('<script>alert(1)</script>')
    expect(wrapper.find('script').exists()).toBe(false)
  })

  it('uses only the actual embeds payload when legacy or inactive design values coexist', () => {
    const wrapper = mount(DiscordPresentationPreview, {
      props: {
        definition: {
          mode: 'EMBED',
          content: 'Outside',
          title: 'Unused title',
          color: '#5865f2',
          thumbnail_url: '/unused.png',
          image_url: '/unused-image.png',
          footer: 'Unused footer',
          embed: { title: 'Inactive nested design' },
          embeds: [{ title: 'Actual title', description: '# {{balance}} THB' }],
        },
        variables: ['balance'],
      },
      global,
    })
    expect(wrapper.text()).toContain('Outside')
    expect(wrapper.get('.preview-embed h4').text()).toBe('Actual title')
    expect(wrapper.find('.preview-embed img').exists()).toBe(false)
    expect(wrapper.find('.preview-footer').exists()).toBe(false)
    expect(wrapper.get('.preview-embed').attributes('style')).toContain('var(--discord-border)')
  })

  it.each([undefined, null, -1, 0x1000000, 'invalid'])('uses a neutral accent for %s', (color) => {
    const wrapper = mount(DiscordPresentationPreview, {
      props: { definition: { mode: 'EMBED', title: 'Balance', color }, variables: [] },
      global,
    })
    expect(wrapper.get('.preview-embed').attributes('style')).toContain('var(--discord-border)')
  })

  it.each([0, '#000000', '000000'])('preserves an explicitly black accent: %s', (color) => {
    const wrapper = mount(DiscordPresentationPreview, {
      props: { definition: { mode: 'EMBED', title: 'Balance', color }, variables: [] },
      global,
    })
    expect(wrapper.get('.preview-embed').attributes('style')).toContain('rgb(0, 0, 0)')
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

  it('uses component blocks instead of legacy quick content when both are present', () => {
    const wrapper = mount(DiscordPresentationPreview, {
      props: {
        definition: {
          mode: 'COMPONENTS_V2',
          title: 'Legacy title',
          description: 'Legacy description',
          components: [{ type: 10, content: 'Rendered block' }],
        },
        variables: [],
      },
      global,
    })

    expect(wrapper.text()).toContain('Rendered block')
    expect(wrapper.text()).not.toContain('Legacy title')
    expect(wrapper.text()).not.toContain('Legacy description')
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

  it('omits optional presentation sections when their sample value is empty', () => {
    const wrapper = mount(DiscordPresentationPreview, {
      props: {
        definition: {
          mode: 'COMPONENTS_V2',
          description: 'Package {{package}}{{#group_name}} · กลุ่ม {{group_name}}{{/group_name}}',
        },
        variables: ['package', 'group_name'],
        sampleValues: { group_name: '' },
      },
      global,
    })

    expect(wrapper.text()).toContain('Package 400 Robux')
    expect(wrapper.text()).not.toContain('กลุ่ม')
    expect(wrapper.text()).not.toContain('{{#group_name}}')
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

    const emojiSources = wrapper
      .findAll('img.discord-custom-emoji')
      .map((item) => item.attributes('src'))
    expect(emojiSources).toContain(
      'https://cdn.discordapp.com/emojis/123456789012345678.png?size=48&quality=lossless',
    )
    expect(emojiSources).toContain(
      'https://cdn.discordapp.com/emojis/987654321098765432.gif?size=48&quality=lossless',
    )
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

  it('keeps bold dividers inside subtext without shrinking surrounding lines', () => {
    const divider = '‿'.repeat(39)
    const wrapper = mount(DiscordPresentationPreview, {
      props: {
        definition: {
          mode: 'EMBED',
          embeds: [{ description: `บรรทัดปกติ\n-# **${divider}**\nบรรทัดถัดไป` }],
        },
        variables: [],
      },
      global,
    })

    expect(wrapper.findAll('.discord-subtext')).toHaveLength(1)
    expect(wrapper.get('.discord-subtext strong').text()).toBe(divider)
    expect(wrapper.get('.discord-subtext').text()).not.toContain('บรรทัดถัดไป')
    expect(wrapper.text()).not.toContain('-#')
    expect(wrapper.text()).not.toContain('**')
  })

  it('preserves all Section text displays and optional Container accents', () => {
    const wrapper = mount(DiscordPresentationPreview, {
      props: {
        definition: {
          mode: 'COMPONENTS_V2',
          components: [
            {
              type: 17,
              components: [
                {
                  type: 9,
                  components: [
                    { type: 10, content: '## {{member}}' },
                    { type: 10, content: 'ยอดสะสม **2,500 บาท**' },
                    { type: 10, content: '-# รายละเอียดเพิ่มเติม' },
                  ],
                  accessory: { type: 2, style: 1, label: 'ดูบัตร' },
                },
                { type: 14, spacing: 1 },
                { type: 14, spacing: 2, divider: false },
              ],
            },
            { type: 17, accent_color: 0, components: [{ type: 10, content: 'Black accent' }] },
          ],
        },
        sampleValues: { member: 'Fujipp' },
        variables: [],
      },
      global,
    })
    const containers = wrapper.findAll('.preview-container')
    expect(containers[0]!.classes()).not.toContain('preview-container--accent')
    expect(containers[1]!.classes()).toContain('preview-container--accent')
    expect(containers[1]!.attributes('style')).toContain('rgb(0, 0, 0)')
    expect(wrapper.get('.preview-section').text()).toContain('Fujipp')
    expect(wrapper.get('.preview-section strong').text()).toBe('2,500 บาท')
    expect(wrapper.get('.preview-section .discord-subtext').text()).toBe('รายละเอียดเพิ่มเติม')
    expect(wrapper.get('.preview-section button').text()).toBe('ดูบัตร')
    expect(wrapper.findAll('.preview-separator hr')).toHaveLength(1)
    expect(wrapper.get('.preview-separator--large').find('hr').exists()).toBe(false)
  })

  it('renders raw V2 links, disabled actions, selects, and custom emoji correctly', async () => {
    const wrapper = mount(DiscordPresentationPreview, {
      props: {
        definition: {
          mode: 'COMPONENTS_V2',
          components: [
            {
              type: 1,
              components: [
                { type: 2, style: 3, label: 'ยืนยัน', custom_id: 'confirm', disabled: true },
                { type: 2, style: 5, label: 'ร้านค้า', url: 'https://example.com/store' },
                {
                  type: 2,
                  style: 1,
                  label: 'ยอดเงิน',
                  custom_id: 'balance',
                  emoji: { name: 'coin', id: '123456789012345678', animated: true },
                },
              ],
            },
            {
              type: 1,
              components: [{ type: 3, custom_id: 'packages', placeholder: 'เลือกแพ็กเกจ' }],
            },
          ],
        },
        variables: [],
      },
      global,
    })
    await wrapper.get('button:disabled').trigger('click')
    expect(wrapper.find('[role="status"]').exists()).toBe(false)
    expect(wrapper.get('a.preview-component-button').attributes('href')).toBe(
      'https://example.com/store',
    )
    expect(wrapper.find('a.preview-component-button .preview-link-icon').exists()).toBe(true)
    expect(wrapper.get('.preview-select-menu').text()).toBe('เลือกแพ็กเกจ')
    expect(wrapper.get('.discord-custom-emoji').attributes('src')).toContain(
      '123456789012345678.gif',
    )
    await wrapper.get('button.preview-button--1').trigger('click')
    expect(wrapper.get('[role="status"]').text()).toContain('ยอดเงิน')
  })

  it.each(['EMBED', 'COMPONENTS_V2'])('renders shared Link buttons in %s', (mode) => {
    const wrapper = mount(DiscordPresentationPreview, {
      props: {
        definition: {
          mode,
          title: 'Member card',
          links: [
            { label: 'Verify with FujiPP', emoji: '✅', url: 'https://example.com/verify' },
            { label: 'Unavailable', url: 'https://example.com/disabled', disabled: true },
          ],
        },
        variables: [],
      },
      global,
    })
    const link = wrapper.get('a.preview-link-button')
    expect(link.attributes('href')).toBe('https://example.com/verify')
    expect(link.attributes('target')).toBe('_blank')
    expect(link.get('.preview-link-emoji').text()).toBe('✅')
    expect(link.get('.preview-link-icon').attributes('aria-hidden')).toBe('true')
    const disabled = wrapper.get('button.preview-link-button')
    expect(disabled.attributes('disabled')).toBeDefined()
    expect(disabled.attributes('href')).toBeUndefined()
    expect(disabled.find('.preview-link-icon').exists()).toBe(true)
  })

  it('preserves media descriptions and reveals spoilers with a keyboard-accessible button', async () => {
    const wrapper = mount(DiscordPresentationPreview, {
      props: {
        definition: {
          mode: 'COMPONENTS_V2',
          components: [
            { type: 17, spoiler: true, components: [{ type: 10, content: 'ข้อความที่ซ่อน' }] },
            {
              type: 12,
              items: [{ media: { url: '/sample.png' }, description: 'บัตรสมาชิก', spoiler: true }],
            },
          ],
        },
        variables: [],
      },
      global,
    })
    expect(wrapper.get('.preview-gallery img').attributes('alt')).toBe('บัตรสมาชิก')
    expect(
      wrapper.get('.preview-container .preview-component-stack').attributes('inert'),
    ).toBeDefined()
    await wrapper.get('.preview-container .preview-spoiler-reveal').trigger('click')
    expect(wrapper.find('.preview-container .preview-spoiler-reveal').exists()).toBe(false)
    expect(
      wrapper.get('.preview-container .preview-component-stack').attributes('inert'),
    ).toBeUndefined()
    await wrapper.get('.preview-gallery .preview-spoiler-reveal').trigger('click')
    expect(wrapper.get('.preview-gallery img').classes()).not.toContain('preview-spoiler-content')
  })
})
