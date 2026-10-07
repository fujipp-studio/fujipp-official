import { describe, expect, it } from 'vitest'
import { ref } from 'vue'

import { usePresentationEditor } from '../features/bots/composables/usePresentationEditor'
import type { PresentationMode } from '../features/bots/models/presentation'

function setup(definition: Record<string, unknown>, mode: PresentationMode) {
  const presentations = ref({ slot: structuredClone(definition) })
  const presentationJson = ref({ slot: JSON.stringify(definition, null, 2) })
  const editor = usePresentationEditor({
    presentations,
    presentationJson,
    presentationMode: ref<PresentationMode>(mode),
    t: (key) => key,
    text: (english) => english,
    availableCoFeatures: ref([]),
    draggedComponent: ref(null),
    advancedSlots: ref(new Set<string>()),
  })
  return { editor, presentations }
}

describe('usePresentationEditor presentation storage', () => {
  it.each(['EMBED', 'COMPONENTS_V2'] as const)(
    'keeps payment button edits at the root while preserving both %s layouts and other metadata',
    (mode) => {
      const definition = {
        mode,
        future: { retained: true },
        components: {
          bank_button: { label: 'Bank', style: 'success', future: 'keep' },
          wallet_button: { label: 'Wallet', style: 'primary' },
        },
        embed: { title: 'Embed body', future: true },
        components_v2: { components: [{ type: 10, content: 'Components body' }] },
      }
      const { editor, presentations } = setup(definition, mode)
      editor.updateSystemComponent('slot', 'bank_button', 'label', 'New bank label')
      editor.updateSystemComponent('slot', 'bank_button', 'style', 'danger')
      expect(presentations.value.slot).toEqual({
        ...definition,
        components: {
          ...definition.components,
          bank_button: {
            ...definition.components.bank_button,
            label: 'New bank label',
            style: 'danger',
          },
        },
      })
    },
  )
  it.each([
    {
      mode: 'EMBED',
      title: 'Flat',
      actions: ['wallet.topup', 'custom.action', 'wallet.balance'],
      action_overrides: {
        'wallet.topup': { label: 'Custom text', emoji: '⭐', style: 'danger', future: true },
      },
    },
    {
      mode: 'EMBED',
      embed: {
        title: 'Nested',
        actions: ['wallet.topup', 'custom.action', 'wallet.balance'],
        action_overrides: { 'wallet.balance': { label: 'Balance', future: true } },
      },
      components_v2: { title: 'Keep alternate design', actions: ['wallet.promptpay'] },
    },
    {
      mode: 'EMBED',
      embeds: [{ title: 'Array embed', future: true }],
      actions: ['wallet.topup', 'custom.action', 'wallet.balance'],
    },
  ])(
    'reorders system actions in their active storage without changing overrides or other data',
    (definition) => {
      const { editor, presentations } = setup(definition, 'EMBED')
      const original = JSON.parse(JSON.stringify(presentations.value.slot))
      editor.moveFixedAction('slot', 'wallet.topup', -1)
      editor.moveFixedAction('slot', 'missing.action', 1)
      expect(presentations.value.slot).toEqual(original)
      editor.moveFixedAction('slot', 'wallet.balance', -1)
      expect(editor.fixedActions('slot').map((item) => item.action)).toEqual([
        'wallet.balance',
        'wallet.topup',
      ])
      expect(editor.visualDefinition('slot').actions).toEqual([
        'wallet.balance',
        'custom.action',
        'wallet.topup',
      ])
      const moved = JSON.parse(JSON.stringify(presentations.value.slot))
      editor.moveFixedAction('slot', 'wallet.topup', 1)
      expect(presentations.value.slot).toEqual(moved)
      editor.moveFixedAction('slot', 'wallet.balance', 1)
      expect(presentations.value.slot).toEqual(original)
    },
  )

  it('keeps an unset accent unset and allows clearing an explicit color', () => {
    const { editor, presentations } = setup({ mode: 'EMBED', title: 'Balance' }, 'EMBED')
    expect(editor.embedColor('slot')).toBe('')
    editor.updateEmbedColor('slot', '#123456')
    expect(editor.embedColor('slot')).toBe('#123456')
    editor.updateEmbedColor('slot', '')
    expect(editor.embedColor('slot')).toBe('')
    expect(JSON.stringify(presentations.value.slot)).not.toContain('color')
  })
  it('keeps legacy outer media and colors out of the actual embeds array', () => {
    const { editor, presentations } = setup(
      {
        mode: 'EMBED',
        color: '#5865f2',
        thumbnail_url: '/unused.png',
        image_url: '/unused-image.png',
        embed: { title: 'Unused nested title' },
        embeds: [{ title: 'Actual title' }],
      },
      'EMBED',
    )
    expect(editor.visualDefinition('slot').title).toBe('Actual title')
    expect(editor.visualDefinition('slot').color).toBeUndefined()
    expect(editor.visualDefinition('slot').image_url).toBe('')
    expect(editor.visualDefinition('slot').thumbnail_url).toBe('')
    editor.updatePresentation('slot', 'title', 'Updated title')
    expect(presentations.value.slot.embeds).toEqual([{ title: 'Updated title' }])
    expect(presentations.value.slot.embed).toEqual({ title: 'Unused nested title' })
  })
  it('updates an active flat Embed without creating a partial nested definition', () => {
    const { editor, presentations } = setup(
      { mode: 'EMBED', title: 'Original', description: 'Keep me', color: 0x5865f2 },
      'EMBED',
    )

    editor.updatePresentation('slot', 'title', 'Updated')

    expect(presentations.value.slot).toMatchObject({
      mode: 'EMBED',
      title: 'Updated',
      description: 'Keep me',
    })
    expect(presentations.value.slot).not.toHaveProperty('embed')
  })

  it('updates an active flat Components V2 layout in place', () => {
    const { editor, presentations } = setup(
      {
        mode: 'COMPONENTS_V2',
        title: 'Original',
        components: [{ type: 10, content: 'Keep me' }],
      },
      'COMPONENTS_V2',
    )

    editor.updatePresentation('slot', 'title', 'Updated')

    expect(presentations.value.slot).toMatchObject({
      mode: 'COMPONENTS_V2',
      title: 'Updated',
      components: [{ type: 10, content: 'Keep me' }],
    })
    expect(presentations.value.slot).not.toHaveProperty('components_v2')
  })

  it('seeds a missing alternate design before changing one field', () => {
    const { editor, presentations } = setup(
      { mode: 'COMPONENTS_V2', title: 'Shared title', description: 'Shared description' },
      'EMBED',
    )

    editor.updatePresentation('slot', 'color', '#123456')

    expect(presentations.value.slot).toMatchObject({
      mode: 'COMPONENTS_V2',
      embed: {
        title: 'Shared title',
        description: 'Shared description',
        color: '#123456',
      },
    })
  })

  it('reads and updates the first embed in an embeds array', () => {
    const { editor, presentations } = setup(
      {
        mode: 'EMBED',
        content: 'Outside',
        embeds: [
          {
            title: 'Original',
            description: 'Keep me',
            image: { url: 'https://example.com/original.png' },
          },
        ],
      },
      'EMBED',
    )

    expect(editor.visualDefinition('slot')).toMatchObject({
      content: 'Outside',
      title: 'Original',
      image_url: 'https://example.com/original.png',
    })
    editor.updatePresentation('slot', 'title', 'Updated')
    editor.updatePresentation('slot', 'image_url', 'https://example.com/updated.png')
    editor.updateEmbedColor('slot', '#123456')
    editor.updatePresentation('slot', 'content', 'Updated outside')

    expect(presentations.value.slot).toMatchObject({
      content: 'Updated outside',
      embeds: [
        {
          title: 'Updated',
          description: 'Keep me',
          color: 0x123456,
          image: { url: 'https://example.com/updated.png' },
        },
      ],
    })
  })

  it('creates Discord-compatible nested Components V2 values', () => {
    const { editor, presentations } = setup(
      { mode: 'COMPONENTS_V2', components: [] },
      'COMPONENTS_V2',
    )

    editor.addComponentBlock('slot', 'container')
    editor.addContainerChild('slot', 0, 'link')

    const container = (presentations.value.slot.components as Array<Record<string, unknown>>)[0]
    expect(container?.accent_color).toBe(0x5865f2)
    expect(editor.componentCount('slot')).toBe(3)
    expect(editor.containerChildren(container ?? {})).toMatchObject([
      {
        type: 1,
        components: [{ type: 2, style: 5 }],
      },
    ])
  })

  it('preserves multi-part Sections and stores button emoji in Discord format', () => {
    const { editor, presentations } = setup(
      {
        mode: 'COMPONENTS_V2',
        components: [
          {
            type: 9,
            components: [
              { type: 10, content: 'First' },
              { type: 10, content: 'Second' },
            ],
            accessory: { type: 2, style: 5, label: 'Open', url: 'https://example.com' },
          },
        ],
      },
      'COMPONENTS_V2',
    )

    editor.updateSectionText('slot', 0, 1, 'Updated second')
    editor.updateSectionAccessory('slot', 0, 'emoji', '<a:wave:123456789012345678>')

    expect(presentations.value.slot.components).toMatchObject([
      {
        components: [
          { type: 10, content: 'First' },
          { type: 10, content: 'Updated second' },
        ],
        accessory: {
          type: 2,
          label: 'Open',
          url: 'https://example.com',
          emoji: { animated: true, name: 'wave', id: '123456789012345678' },
        },
      },
    ])
  })
})
