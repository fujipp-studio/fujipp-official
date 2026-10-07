import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { describe, expect, it } from 'vitest'
import PriceMapEditor from '../features/bots/components/PriceMapEditor.vue'
import { priceReaderSampleValues } from '../features/bots/config/price-reader'
import { priceReaderPresentationPreview } from '../features/bots/models/price-reader-presentation-preview'
const global = { plugins: [createI18n({ legacy: false, locale: 'en', messages: { en: {} } })] }
const original = [
  { discordPrice: 250, shopPrice: 55, future: { keep: true } },
  { discordPrice: 295, shopPrice: 65 },
]
const output = (wrapper: ReturnType<typeof mount>) =>
  JSON.parse(String(wrapper.emitted('update:modelValue')?.at(-1)?.[0]))

describe('Price Reader', () => {
  it('keeps metadata and incomplete rows when editing, then restores the original values', async () => {
    const wrapper = mount(PriceMapEditor, {
      global,
      props: { modelValue: JSON.stringify(original) },
    })
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    await wrapper.findAll('input')[1]!.setValue('')
    const draft = output(wrapper)
    expect(draft).toEqual([{ ...original[0], shopPrice: '' }, original[1]])
    await wrapper.setProps({ modelValue: JSON.stringify(draft, null, 2) })
    expect(wrapper.findAll('[data-price-row]')).toHaveLength(2)
    expect(wrapper.findAll('input')[1]!.attributes('aria-invalid')).toBe('true')
    await wrapper.findAll('input')[1]!.setValue('55')
    expect(output(wrapper)).toEqual(original)
    wrapper.unmount()
  })
  it('adds blank rows to the draft and keeps metadata aligned after removal', async () => {
    const wrapper = mount(PriceMapEditor, {
      global,
      props: { modelValue: JSON.stringify(original) },
    })
    await wrapper.get('[data-add-price]').trigger('click')
    expect(output(wrapper)).toEqual([...original, { discordPrice: '', shopPrice: '' }])
    await wrapper.get('button[aria-label="Delete price pair 1"]').trigger('click')
    expect(output(wrapper)).toEqual([original[1], { discordPrice: '', shopPrice: '' }])
    wrapper.unmount()
  })
  it('flags duplicate prices and rejects negatives while allowing a zero shop price', async () => {
    const wrapper = mount(PriceMapEditor, {
      global,
      props: {
        modelValue: JSON.stringify([
          { discordPrice: 250, shopPrice: 0 },
          { discordPrice: 250, shopPrice: -1 },
        ]),
      },
    })
    expect(wrapper.findAll('[role="status"]')).toHaveLength(1)
    expect(wrapper.findAll('input').map((input) => input.attributes('aria-invalid'))).toEqual([
      'false',
      'false',
      'false',
      'true',
    ])
    wrapper.unmount()
  })
  it('preserves malformed data in the editable JSON fallback', async () => {
    const wrapper = mount(PriceMapEditor, { global, props: { modelValue: '[null,{"future":1}]' } })
    expect(wrapper.get('textarea').element.value).toBe('[null,{"future":1}]')
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    await wrapper.get('textarea').setValue(JSON.stringify(original))
    await wrapper.setProps({
      modelValue: String(wrapper.emitted('update:modelValue')?.at(-1)?.[0]),
    })
    expect(wrapper.findAll('[data-price-row]')).toHaveLength(2)
    wrapper.unmount()
  })
  it('keeps satang-format fields consistent with edits in baht', async () => {
    const wrapper = mount(PriceMapEditor, {
      global,
      props: {
        modelValue: JSON.stringify([
          { discordPriceSatang: 25000, shopPriceSatang: 5500, future: true },
        ]),
      },
    })
    await wrapper.findAll('input')[1]!.setValue('60.25')
    expect(output(wrapper)[0]).toEqual({
      discordPriceSatang: 25000,
      shopPriceSatang: 6025,
      discordPrice: 250,
      shopPrice: 60.25,
      future: true,
    })
    wrapper.unmount()
  })
  it('uses configured pairs, actual markup, per-image templates and optional order channels', () => {
    const samples = priceReaderSampleValues(
      {
        PRICE_READER_PRICE_MAP: JSON.stringify(original),
        PRICE_READER_NO_NITRO_MARKUP_SATANG: '250',
        PRICE_READER_RESULTS_ITEM_TEMPLATE:
          '{{result_index}}: {{discord_price}} / {{shop_price_text}} + {{no_nitro_markup}} {{unknown}}',
        PRICE_READER_ORDER_CHANNEL_ID: '123456789012345678',
      },
      '1.0.0',
      '234567890123456789',
    )
    expect(samples.results_text).toBe(
      '1: 250.00 / 55.00 บาท + 2.50 {{unknown}}\n\n---\n\n2: 295.00 / 65.00 บาท + 2.50 {{unknown}}',
    )
    expect(samples.image_count).toBe('2')
    expect(samples.order_url).toBe(
      'https://discord.com/channels/234567890123456789/123456789012345678',
    )
    const v2 = priceReaderSampleValues({ PRICE_READER_PRICE_MAP: [] }, '2.0.0')
    expect(v2.results_text).toContain('ไม่พบราคาที่ตรงกัน')
    expect(v2.results_text).not.toContain('ไนโตร')
    expect(v2).not.toHaveProperty('no_nitro_markup')
    expect(v2.order_url).toBe('')
  })
  it('mirrors the container fallback and filters unusable links without modifying designs', () => {
    const raw = {
      mode: 'COMPONENTS_V2',
      title: 'Reading',
      description: '{{image_count}} images',
      links: [{ url: '{{order_url}}', label: 'Order' }],
      future: true,
    }
    const saved = structuredClone(raw)
    const preview = priceReaderPresentationPreview(raw, { image_count: '2', order_url: '' })
    expect(preview.components).toEqual([
      {
        type: 17,
        components: [
          { type: 10, content: '# Reading\n' },
          { type: 14, divider: true, spacing: 2 },
          { type: 10, content: '{{image_count}} images' },
        ],
      },
    ])
    expect(raw).toEqual(saved)
    const embed = priceReaderPresentationPreview(
      { ...raw, mode: 'EMBED', embed: { title: 'Result' } },
      { order_url: 'https://discord.com/channels/123/456' },
    )
    expect(embed.links).toEqual([
      { url: 'https://discord.com/channels/123/456', label: 'Order', emoji: '🔗' },
    ])
    expect(embed.embed).toMatchObject({ title: 'Result', color: 0x5865f2 })
  })
})
