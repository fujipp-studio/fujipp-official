import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { describe, expect, it } from 'vitest'
import PriceMapEditor from '../features/bots/components/PriceMapEditor.vue'
import {
  priceReaderSampleValues,
  validatePriceReaderDraft,
} from '../features/bots/config/price-reader'
import PriceReaderResultEditor from '../features/bots/components/PriceReaderResultEditor.vue'
import { priceReaderPresentationPreview } from '../features/bots/models/price-reader-presentation-preview'
const global = { plugins: [createI18n({ legacy: false, locale: 'en', messages: { en: {} } })] }
const original = [
  { discordPrice: 250, shopPrice: 55, future: { keep: true } },
  { discordPrice: 295, shopPrice: 65 },
]
const output = (wrapper: ReturnType<typeof mount>) =>
  JSON.parse(String(wrapper.emitted('update:modelValue')?.at(-1)?.[0]))

describe('Price Reader', () => {
  it('keeps saved blocks when switching to a template and back', async () => {
    const blocks = JSON.stringify([
      { id: 'custom', enabled: true, text: 'My shop {{shop_price_text}}' },
    ])
    const wrapper = mount(PriceReaderResultEditor, {
      global,
      props: {
        modelValue: blocks,
        mode: 'BLOCKS',
        template: 'My template',
        withMarkup: false,
        canUseBlocks: true,
      },
    })
    await wrapper
      .findAll('button')
      .find((button) => button.text() === 'Use template')!
      .trigger('click')
    expect(wrapper.emitted('update:mode')?.at(-1)).toEqual(['TEMPLATE'])
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    await wrapper.setProps({ mode: 'TEMPLATE' })
    await wrapper
      .findAll('button')
      .find((button) => button.text() === 'Design with blocks')!
      .trigger('click')
    expect(wrapper.emitted('update:mode')?.at(-1)).toEqual(['BLOCKS'])
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    wrapper.unmount()
  })
  it('preserves templates when enabling, reordering and disabling result blocks', async () => {
    const wrapper = mount(PriceReaderResultEditor, {
      global,
      props: {
        modelValue: '[]',
        template: 'Original {{discord_price}}',
        withMarkup: false,
        canUseBlocks: true,
      },
    })
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    await wrapper
      .findAll('button')
      .find((button) => button.text() === 'Design with blocks')!
      .trigger('click')
    const read = () => JSON.parse(String(wrapper.emitted('update:modelValue')?.at(-1)?.[0]))
    await wrapper.setProps({ modelValue: JSON.stringify(read()) })
    await wrapper.get('button[aria-label="Move block 4 up"]').trigger('click')
    expect(read().map((block: { id: string }) => block.id)).toEqual([
      'index',
      'name',
      'shop',
      'discord',
    ])
    await wrapper.setProps({ modelValue: JSON.stringify(read()) })
    await wrapper.findAll('[role="switch"]')[2]!.trigger('click')
    expect(read()[2].enabled).toBe(false)
    expect(wrapper.emitted('update:template')).toBeUndefined()
    await wrapper
      .findAll('button')
      .find((button) => button.text() === 'Use template')!
      .trigger('click')
    await wrapper.setProps({ modelValue: JSON.stringify(read()) })
    expect(wrapper.get('textarea').element.value).toBe('Original {{discord_price}}')
    wrapper.unmount()
  })
  it('inserts variables at the cursor and preserves malformed block drafts', async () => {
    const wrapper = mount(PriceReaderResultEditor, {
      global,
      props: {
        modelValue: '[]',
        template: 'Hello world',
        withMarkup: false,
        canUseBlocks: true,
      },
      attachTo: document.body,
    })
    wrapper.get('textarea').element.setSelectionRange(6, 11)
    await wrapper.get('button[aria-label="Insert item_name"]').trigger('click')
    expect(wrapper.emitted('update:template')?.at(-1)).toEqual(['Hello {{item_name}}'])
    await wrapper.setProps({ modelValue: '[null,{"future":1}]' })
    expect(wrapper.get('textarea').element.value).toBe('[null,{"future":1}]')
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    wrapper.unmount()
  })
  it('validates tolerance and block output before saving without rejecting legacy settings', () => {
    expect(validatePriceReaderDraft({})).toBe(true)
    expect(validatePriceReaderDraft({ PRICE_READER_MATCH_TOLERANCE_SATANG: '0' })).toBe(true)
    for (const value of ['', '-1', '5001', '0.5'])
      expect(validatePriceReaderDraft({ PRICE_READER_MATCH_TOLERANCE_SATANG: value })).toBe(false)
    expect(validatePriceReaderDraft({ PRICE_READER_RESULT_BLOCKS: '[null]' })).toBe(false)
    expect(
      validatePriceReaderDraft({
        PRICE_READER_RESULT_BLOCKS: JSON.stringify([{ id: 'a', text: 'hidden', enabled: false }]),
      }),
    ).toBe(false)
    expect(
      validatePriceReaderDraft({
        PRICE_READER_RESULT_BLOCKS: '[]',
        PRICE_READER_RESULTS_SEPARATOR: '',
      }),
    ).toBe(true)
  })
  it('previews mixed and failed scenarios using the current unsaved messages', () => {
    const config = {
      PRICE_READER_PRICE_MAP: original,
      PRICE_READER_NOT_FOUND_TEXT: 'Send another screenshot',
      PRICE_READER_OCR_ERROR_TEXT: 'Try again',
      PRICE_READER_ERROR_ITEM_TEMPLATE: '{{result_index}}: {{error_message}}',
    }
    const mixed = priceReaderSampleValues(config, '2.0.0', null, 'mixed')
    expect(mixed.results_text).toContain('3: Send another screenshot')
    expect(mixed.success_count).toBe('2')
    expect(mixed.error_count).toBe('1')
    expect(priceReaderSampleValues(config, '2.0.0', null, 'error').results_text).toBe(
      '1: Send another screenshot',
    )
    expect(priceReaderSampleValues(config, '2.0.0', null, 'ocr_error').results_text).toBe(
      '1: Try again',
    )
  })
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
