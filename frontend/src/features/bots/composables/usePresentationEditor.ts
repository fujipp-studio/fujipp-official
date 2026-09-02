import type { Ref } from 'vue'
import { walletActionDefaults, coFeatureCatalog } from '../config/feature-editor'
import { clone, type PresentationMode } from '../models/presentation'

interface Options {
  presentations: Ref<Record<string, Record<string, unknown>>>
  presentationJson: Ref<Record<string, string>>
  presentationMode: Ref<PresentationMode>
  t: (key: string) => string
  text: (english: string, thai: string) => string
  availableCoFeatures: Ref<typeof coFeatureCatalog>
  draggedComponent: Ref<{ slotKey: string; index: number } | null>
  advancedSlots: Ref<Set<string>>
}

export function usePresentationEditor({
  presentations,
  presentationJson,
  presentationMode,
  text,
  t,
  availableCoFeatures,
  draggedComponent,
  advancedSlots,
}: Options) {
  function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
  }

  function normalizedMode(value: unknown): Exclude<PresentationMode, null> {
    return String(value).toUpperCase() === 'COMPONENTS_V2' ? 'COMPONENTS_V2' : 'EMBED'
  }

  function requestedMode(definition: Record<string, unknown>) {
    return presentationMode.value ?? normalizedMode(definition.mode)
  }

  function nestedKeyFor(mode: Exclude<PresentationMode, null>) {
    return mode === 'EMBED' ? 'embed' : 'components_v2'
  }

  function firstEmbed(definition: Record<string, unknown>) {
    const embed = Array.isArray(definition.embeds) ? definition.embeds[0] : null
    return isRecord(embed) ? embed : null
  }

  function mediaUrl(value: unknown) {
    if (typeof value === 'string') return value
    return isRecord(value) && typeof value.url === 'string' ? value.url : ''
  }

  function embedArrayDefinition(definition: Record<string, unknown>): Record<string, unknown> {
    const embed = firstEmbed(definition) ?? {}
    return {
      ...definition,
      ...embed,
      image_url: mediaUrl(embed.image ?? definition.image_url),
      thumbnail_url: mediaUrl(embed.thumbnail ?? definition.thumbnail_url),
    }
  }

  type PresentationStorage =
    { kind: 'root' } | { kind: 'nested'; key: 'embed' | 'components_v2' } | { kind: 'embed-array' }

  function presentationStorage(
    definition: Record<string, unknown>,
    mode: Exclude<PresentationMode, null>,
  ): PresentationStorage {
    const nestedKey = nestedKeyFor(mode)
    if (isRecord(definition[nestedKey])) return { kind: 'nested', key: nestedKey }
    if (mode === normalizedMode(definition.mode)) {
      if (mode === 'EMBED' && firstEmbed(definition)) return { kind: 'embed-array' }
      return { kind: 'root' }
    }
    return { kind: 'nested', key: nestedKey }
  }

  function nestedSeed(
    definition: Record<string, unknown>,
    mode: Exclude<PresentationMode, null>,
  ): Record<string, unknown> {
    const source =
      mode === 'EMBED' && firstEmbed(definition) ? embedArrayDefinition(definition) : definition
    const keys =
      mode === 'EMBED'
        ? [
            'content',
            'title',
            'url',
            'description',
            'color',
            'author',
            'fields',
            'image_url',
            'thumbnail_url',
            'footer',
            'timestamp',
            'links',
            'actions',
            'action_overrides',
          ]
        : [
            'title',
            'description',
            'image_url',
            'thumbnail_url',
            'footer',
            'components',
            'links',
            'actions',
            'action_overrides',
          ]
    return Object.fromEntries(
      keys.filter((key) => source[key] !== undefined).map((key) => [key, clone(source[key])]),
    )
  }

  function updateEmbedArray(
    slotKey: string,
    definition: Record<string, unknown>,
    key: string,
    value: unknown,
  ) {
    if (['content', 'links', 'actions', 'action_overrides', 'co_features'].includes(key)) {
      presentations.value[slotKey] = { ...definition, [key]: value }
      return
    }
    const embeds = Array.isArray(definition.embeds)
      ? definition.embeds.map((embed) => clone(embed))
      : []
    const embed = isRecord(embeds[0]) ? embeds[0] : {}
    if (key === 'image_url' || key === 'thumbnail_url') {
      embed[key === 'image_url' ? 'image' : 'thumbnail'] = value ? { url: value } : undefined
    } else if (key === 'color') embed.color = discordColor(value)
    else embed[key] = value
    embeds[0] = embed
    presentations.value[slotKey] = { ...definition, embeds }
  }

  function updatePresentation(slotKey: string, key: string, value: unknown) {
    const definition = presentations.value[slotKey] ?? {}
    if (key === 'mode') {
      presentations.value[slotKey] = { ...definition, mode: value }
      presentationJson.value[slotKey] = JSON.stringify(presentations.value[slotKey], null, 2)
      return
    }
    const mode = requestedMode(definition)
    const storage = presentationStorage(definition, mode)
    if (storage.kind === 'root') presentations.value[slotKey] = { ...definition, [key]: value }
    else if (storage.kind === 'embed-array') updateEmbedArray(slotKey, definition, key, value)
    else {
      const nested = isRecord(definition[storage.key])
        ? (definition[storage.key] as Record<string, unknown>)
        : nestedSeed(definition, mode)
      presentations.value[slotKey] = {
        ...definition,
        [storage.key]: { ...nested, [key]: value },
      }
    }
    presentationJson.value[slotKey] = JSON.stringify(presentations.value[slotKey], null, 2)
  }

  function embedColor(slotKey: string) {
    const value = visualDefinition(slotKey).color
    if (typeof value === 'number' && Number.isInteger(value))
      return `#${value.toString(16).padStart(6, '0').slice(-6)}`
    const normalized = String(value ?? '').trim()
    return /^#[0-9a-f]{6}$/i.test(normalized) ? normalized : '#5865f2'
  }

  function updateEmbedColor(slotKey: string, value: string) {
    const normalized = value.trim()
    if (/^#[0-9a-f]{6}$/i.test(normalized)) updatePresentation(slotKey, 'color', normalized)
  }

  function embedObject(slotKey: string, key: 'author' | 'footer') {
    const value = visualDefinition(slotKey)[key]
    if (value && typeof value === 'object' && !Array.isArray(value))
      return value as Record<string, unknown>
    return key === 'footer' && typeof value === 'string' ? { text: value } : {}
  }

  function updateEmbedObject(
    slotKey: string,
    key: 'author' | 'footer',
    field: string,
    value: string,
  ) {
    updatePresentation(slotKey, key, { ...embedObject(slotKey, key), [field]: value })
  }

  function fixedActions(slotKey: string) {
    const definition = visualDefinition(slotKey)
    const actions = Array.isArray(definition.actions) ? definition.actions.map(String) : []
    const overrides =
      definition.action_overrides &&
      typeof definition.action_overrides === 'object' &&
      !Array.isArray(definition.action_overrides)
        ? (definition.action_overrides as Record<string, Record<string, unknown>>)
        : {}
    return actions.flatMap((action) => {
      const defaults = walletActionDefaults[action]
      if (!defaults) return []
      return [{ action, defaults, override: overrides[action] ?? {} }]
    })
  }

  const defaultActionLabel = (labels: [string, string]) => text(labels[0], labels[1])

  function updateActionOverride(slotKey: string, action: string, key: string, value: string) {
    const definition = visualDefinition(slotKey)
    const current =
      definition.action_overrides &&
      typeof definition.action_overrides === 'object' &&
      !Array.isArray(definition.action_overrides)
        ? clone(definition.action_overrides as Record<string, unknown>)
        : {}
    const override =
      current[action] && typeof current[action] === 'object' && !Array.isArray(current[action])
        ? (current[action] as Record<string, unknown>)
        : {}
    current[action] = { ...override, [key]: value }
    updatePresentation(slotKey, 'action_overrides', current)
  }

  function visualArray(slotKey: string, key: string) {
    const value = visualDefinition(slotKey)[key]
    return Array.isArray(value) ? (value as Array<Record<string, unknown>>) : []
  }

  function updateVisualArray(slotKey: string, key: string, value: Array<Record<string, unknown>>) {
    updatePresentation(slotKey, key, value)
  }

  function addEmbedField(slotKey: string) {
    updateVisualArray(slotKey, 'fields', [
      ...visualArray(slotKey, 'fields'),
      { name: t('botSettings.fieldName'), value: t('botSettings.details'), inline: false },
    ])
  }

  function updateEmbedField(slotKey: string, index: number, key: string, value: unknown) {
    const fields = visualArray(slotKey, 'fields').map((field) => ({ ...field }))
    if (fields[index]) fields[index][key] = value
    updateVisualArray(slotKey, 'fields', fields)
  }

  function removeEmbedField(slotKey: string, index: number) {
    updateVisualArray(
      slotKey,
      'fields',
      visualArray(slotKey, 'fields').filter((_, itemIndex) => itemIndex !== index),
    )
  }

  function addLink(slotKey: string) {
    updateVisualArray(slotKey, 'links', [
      ...visualArray(slotKey, 'links'),
      { label: t('botSettings.openLink'), url: 'https://example.com', emoji: '🔗' },
    ])
  }

  function updateLink(slotKey: string, index: number, key: string, value: string) {
    const links = visualArray(slotKey, 'links').map((link) => ({ ...link }))
    if (links[index]) links[index][key] = value
    updateVisualArray(slotKey, 'links', links)
  }

  function removeLink(slotKey: string, index: number) {
    updateVisualArray(
      slotKey,
      'links',
      visualArray(slotKey, 'links').filter((_, itemIndex) => itemIndex !== index),
    )
  }

  function componentBlocks(slotKey: string) {
    const raw = visualDefinition(slotKey).components
    if (!Array.isArray(raw)) return [] as Array<Record<string, unknown>>
    return raw as Array<Record<string, unknown>>
  }

  function supportsBlockBuilder(slotKey: string) {
    if (presentationMode.value === 'COMPONENTS_V2') return true
    const components = visualDefinition(slotKey).components
    return !components || Array.isArray(components)
  }

  function updateRootPresentation(slotKey: string, key: string, value: unknown) {
    presentations.value[slotKey] = { ...presentations.value[slotKey], [key]: value }
    presentationJson.value[slotKey] = JSON.stringify(presentations.value[slotKey], null, 2)
  }

  function systemComponents(slotKey: string) {
    const value = presentations.value[slotKey]?.components
    if (!value || typeof value !== 'object' || Array.isArray(value)) return []
    return Object.entries(value as Record<string, unknown>).flatMap(([role, config]) =>
      config && typeof config === 'object' && !Array.isArray(config)
        ? [{ role, config: config as Record<string, unknown> }]
        : [],
    )
  }

  function updateSystemComponent(slotKey: string, role: string, key: string, value: string) {
    const current = presentations.value[slotKey]?.components
    if (!current || typeof current !== 'object' || Array.isArray(current)) return
    const components = clone(current as Record<string, unknown>)
    const config = components[role]
    if (!config || typeof config !== 'object' || Array.isArray(config)) return
    ;(config as Record<string, unknown>)[key] = value
    updateRootPresentation(slotKey, 'components', components)
  }

  function coFeatureComponents(slotKey: string) {
    const value = presentations.value[slotKey]?.co_features
    return Array.isArray(value)
      ? value.filter((item): item is Record<string, unknown> =>
          Boolean(item && typeof item === 'object' && !Array.isArray(item)),
        )
      : []
  }

  function addCoFeature(slotKey: string, action: string) {
    const source = availableCoFeatures.value.find((item) => item.action === action)
    if (!source || coFeatureComponents(slotKey).some((item) => item.action === action)) return
    updateRootPresentation(slotKey, 'co_features', [...coFeatureComponents(slotKey), { ...source }])
  }

  function removeCoFeature(slotKey: string, action: string) {
    updateRootPresentation(
      slotKey,
      'co_features',
      coFeatureComponents(slotKey).filter((item) => item.action !== action),
    )
  }

  function updateCoFeature(slotKey: string, action: string, key: string, value: string) {
    updateRootPresentation(
      slotKey,
      'co_features',
      coFeatureComponents(slotKey).map((item) =>
        item.action === action ? { ...item, [key]: value } : item,
      ),
    )
  }

  function availableCoFeatureOptions(slotKey: string) {
    return availableCoFeatures.value
      .filter(
        (option) => !coFeatureComponents(slotKey).some((added) => added.action === option.action),
      )
      .map((item) => ({ value: item.action, label: item.label }))
  }

  function setComponentBlocks(slotKey: string, blocks: Array<Record<string, unknown>>) {
    updatePresentation(slotKey, 'components', blocks)
  }

  function containerChildren(block: Record<string, unknown>) {
    return Array.isArray(block.components)
      ? block.components.filter((item): item is Record<string, unknown> =>
          Boolean(item && typeof item === 'object' && !Array.isArray(item)),
        )
      : []
  }

  function componentTreeSize(block: Record<string, unknown>): number {
    const children = Array.isArray(block.components)
      ? block.components
          .filter(isRecord)
          .reduce((total, child) => total + componentTreeSize(child), 0)
      : 0
    return 1 + children + (isRecord(block.accessory) ? 1 : 0)
  }

  function componentCount(slotKey: string) {
    return componentBlocks(slotKey).reduce((total, block) => total + componentTreeSize(block), 0)
  }

  function componentColor(value: unknown) {
    if (typeof value === 'number' && Number.isInteger(value))
      return `#${value.toString(16).padStart(6, '0').slice(-6)}`
    const normalized = String(value ?? '').trim()
    return /^#[0-9a-f]{6}$/i.test(normalized) ? normalized : '#5865f2'
  }

  function discordColor(value: unknown) {
    const normalized = String(value ?? '')
      .trim()
      .replace(/^#/, '')
    return /^[0-9a-f]{6}$/i.test(normalized) ? Number.parseInt(normalized, 16) : undefined
  }

  function updateContainerBlock(
    slotKey: string,
    blockIndex: number,
    key: 'spoiler' | 'accent_color',
    value: unknown,
  ) {
    const blocks = componentBlocks(slotKey).map((block) => clone(block))
    if (blocks[blockIndex]) {
      blocks[blockIndex][key] = key === 'accent_color' ? discordColor(value) : value
    }
    setComponentBlocks(slotKey, blocks)
  }

  function createComponentBlock(
    type: 'text' | 'container' | 'section' | 'media' | 'separator' | 'link',
  ) {
    if (type === 'text') return { type: 10, content: t('botSettings.newContent') }
    if (type === 'container')
      return { type: 17, accent_color: 0x5865f2, spoiler: false, components: [] }
    if (type === 'section')
      return {
        type: 9,
        components: [{ type: 10, content: t('botSettings.sectionContent') }],
        accessory: {
          type: 11,
          media: { url: 'https://example.com/image.png' },
          description: t('botSettings.accessoryImage'),
        },
      }
    if (type === 'media')
      return {
        type: 12,
        items: [
          {
            media: { url: 'https://example.com/image.png' },
            description: t('botSettings.accessoryImage'),
          },
        ],
      }
    if (type === 'separator') return { type: 14, divider: true, spacing: 1 }
    return {
      type: 1,
      components: [
        { type: 2, style: 5, label: t('botSettings.openLink'), url: 'https://example.com' },
      ],
    }
  }

  function sectionTextBlocks(block: Record<string, unknown>) {
    return Array.isArray(block.components)
      ? block.components.filter((item) => isRecord(item) && item.type === 10)
      : []
  }

  function updateSectionText(
    slotKey: string,
    blockIndex: number,
    textIndex: number,
    value: string,
  ) {
    const blocks = componentBlocks(slotKey).map((block) => clone(block))
    const block = blocks[blockIndex]
    if (!block || block.type !== 9) return
    const texts = sectionTextBlocks(block).map((text) => clone(text))
    if (!texts[textIndex]) return
    texts[textIndex].content = value
    block.components = texts
    setComponentBlocks(slotKey, blocks)
  }

  function addSectionText(slotKey: string, blockIndex: number) {
    const blocks = componentBlocks(slotKey).map((block) => clone(block))
    const block = blocks[blockIndex]
    if (!block || block.type !== 9) return
    const texts = sectionTextBlocks(block)
    if (texts.length >= 3 || componentCount(slotKey) >= 40) return
    block.components = [...texts, { type: 10, content: t('botSettings.newContent') }]
    setComponentBlocks(slotKey, blocks)
  }

  function removeSectionText(slotKey: string, blockIndex: number, textIndex: number) {
    const blocks = componentBlocks(slotKey).map((block) => clone(block))
    const block = blocks[blockIndex]
    if (!block || block.type !== 9) return
    const texts = sectionTextBlocks(block)
    if (texts.length <= 1) return
    block.components = texts.filter((_, index) => index !== textIndex)
    setComponentBlocks(slotKey, blocks)
  }

  function sectionAccessory(block: Record<string, unknown>) {
    return isRecord(block.accessory) ? block.accessory : {}
  }

  function sectionAccessoryType(block: Record<string, unknown>) {
    return sectionAccessory(block).type === 2 ? 'link' : 'thumbnail'
  }

  function setSectionAccessory(slotKey: string, blockIndex: number, type: string) {
    const blocks = componentBlocks(slotKey).map((block) => clone(block))
    const block = blocks[blockIndex]
    if (!block || block.type !== 9 || sectionAccessoryType(block) === type) return
    block.accessory =
      type === 'link'
        ? { type: 2, style: 5, label: t('botSettings.openLink'), url: 'https://example.com' }
        : {
            type: 11,
            media: { url: 'https://example.com/image.png' },
            description: t('botSettings.accessoryImage'),
          }
    setComponentBlocks(slotKey, blocks)
  }

  function updateSectionAccessory(
    slotKey: string,
    blockIndex: number,
    key: 'url' | 'label' | 'emoji' | 'description',
    value: string,
  ) {
    const blocks = componentBlocks(slotKey).map((block) => clone(block))
    const block = blocks[blockIndex]
    if (!block || block.type !== 9) return
    const accessory = sectionAccessory(block)
    if (accessory.type === 2) accessory[key] = key === 'emoji' ? discordEmoji(value) : value
    else if (key === 'url') accessory.media = { url: value }
    else accessory[key] = value
    block.accessory = accessory
    setComponentBlocks(slotKey, blocks)
  }

  function mediaItems(block: Record<string, unknown>) {
    return Array.isArray(block.items)
      ? (block.items.filter((item) => item && typeof item === 'object') as Array<
          Record<string, unknown>
        >)
      : []
  }

  function mediaItemUrl(item: Record<string, unknown>) {
    return item.media && typeof item.media === 'object' && 'url' in item.media
      ? String(item.media.url ?? '')
      : ''
  }

  function mediaItemDescription(item: Record<string, unknown>) {
    return String(item.description ?? '')
  }

  function updateMediaItem(slotKey: string, blockIndex: number, itemIndex: number, value: string) {
    const blocks = componentBlocks(slotKey).map((block) => clone(block))
    const block = blocks[blockIndex]
    if (!block || block.type !== 12) return
    const items = mediaItems(block).map((item) => clone(item))
    items[itemIndex] = { ...items[itemIndex], media: { url: value } }
    block.items = items
    setComponentBlocks(slotKey, blocks)
  }

  function addMediaItem(slotKey: string, blockIndex: number) {
    const blocks = componentBlocks(slotKey).map((block) => clone(block))
    const block = blocks[blockIndex]
    if (!block || block.type !== 12) return
    if (mediaItems(block).length >= 10) return
    block.items = [...mediaItems(block), { media: { url: 'https://example.com/image.png' } }]
    setComponentBlocks(slotKey, blocks)
  }

  function updateMediaItemField(
    slotKey: string,
    blockIndex: number,
    itemIndex: number,
    key: 'description' | 'spoiler',
    value: string | boolean,
  ) {
    const blocks = componentBlocks(slotKey).map((block) => clone(block))
    const block = blocks[blockIndex]
    if (!block || block.type !== 12) return
    const items = mediaItems(block).map((item) => clone(item))
    if (!items[itemIndex]) return
    items[itemIndex][key] = value
    block.items = items
    setComponentBlocks(slotKey, blocks)
  }

  function removeMediaItem(slotKey: string, blockIndex: number, itemIndex: number) {
    const blocks = componentBlocks(slotKey).map((block) => clone(block))
    const block = blocks[blockIndex]
    if (!block || block.type !== 12) return
    block.items = mediaItems(block).filter((_, index) => index !== itemIndex)
    setComponentBlocks(slotKey, blocks)
  }

  function actionRowButtons(block: Record<string, unknown>) {
    return Array.isArray(block.components) ? block.components.filter(isRecord) : []
  }

  function componentEmoji(value: unknown) {
    if (typeof value === 'string') return value
    if (!isRecord(value)) return ''
    const name = String(value.name ?? '')
    const id = String(value.id ?? '')
    if (!id) return name
    return `<${value.animated === true ? 'a' : ''}:${name || 'emoji'}:${id}>`
  }

  function discordEmoji(value: string) {
    const normalized = value.trim()
    if (!normalized) return undefined
    const custom = normalized.match(/^<(a?):([\w~]+):(\d+)>$/)
    if (custom) return { animated: custom[1] === 'a', name: custom[2], id: custom[3] }
    return { name: normalized }
  }

  function updateActionRowButton(
    slotKey: string,
    blockIndex: number,
    buttonIndex: number,
    key: 'label' | 'emoji' | 'url',
    value: string,
  ) {
    const blocks = componentBlocks(slotKey).map((block) => clone(block))
    const block = blocks[blockIndex]
    if (!block || block.type !== 1) return
    const buttons = actionRowButtons(block).map((button) => clone(button))
    if (!buttons[buttonIndex]) return
    buttons[buttonIndex][key] = key === 'emoji' ? discordEmoji(value) : value
    block.components = buttons
    setComponentBlocks(slotKey, blocks)
  }

  function addActionRowButton(slotKey: string, blockIndex: number) {
    const blocks = componentBlocks(slotKey).map((block) => clone(block))
    const block = blocks[blockIndex]
    if (!block || block.type !== 1) return
    const buttons = actionRowButtons(block)
    if (buttons.length >= 5 || componentCount(slotKey) >= 40) return
    block.components = [
      ...buttons,
      { type: 2, style: 5, label: t('botSettings.openLink'), url: 'https://example.com' },
    ]
    setComponentBlocks(slotKey, blocks)
  }

  function removeActionRowButton(slotKey: string, blockIndex: number, buttonIndex: number) {
    const blocks = componentBlocks(slotKey).map((block) => clone(block))
    const block = blocks[blockIndex]
    if (!block || block.type !== 1) return
    block.components = actionRowButtons(block).filter((_, index) => index !== buttonIndex)
    setComponentBlocks(slotKey, blocks)
  }

  function updateSeparator(
    slotKey: string,
    blockIndex: number,
    key: 'divider' | 'spacing',
    value: boolean | number,
  ) {
    const blocks = componentBlocks(slotKey).map((block) => clone(block))
    if (blocks[blockIndex]) blocks[blockIndex][key] = value
    setComponentBlocks(slotKey, blocks)
  }

  function addComponentBlock(
    slotKey: string,
    type: 'text' | 'container' | 'section' | 'media' | 'separator' | 'link',
  ) {
    const blocks = [...componentBlocks(slotKey)]
    const block = createComponentBlock(type)
    if (componentCount(slotKey) + componentTreeSize(block) > 40) return
    blocks.push(block)
    setComponentBlocks(slotKey, blocks)
  }

  function addContainerChild(
    slotKey: string,
    blockIndex: number,
    type: 'text' | 'section' | 'media' | 'separator' | 'link',
  ) {
    const blocks = componentBlocks(slotKey).map((block) => clone(block))
    const container = blocks[blockIndex]
    if (!container || container.type !== 17) return
    const children = containerChildren(container)
    const child = createComponentBlock(type)
    if (componentCount(slotKey) + componentTreeSize(child) > 40) return
    container.components = [...children, child]
    setComponentBlocks(slotKey, blocks)
  }

  function removeContainerChild(slotKey: string, blockIndex: number, childIndex: number) {
    const blocks = componentBlocks(slotKey).map((block) => clone(block))
    const container = blocks[blockIndex]
    if (!container || container.type !== 17) return
    container.components = containerChildren(container).filter((_, index) => index !== childIndex)
    setComponentBlocks(slotKey, blocks)
  }

  function moveContainerChild(
    slotKey: string,
    blockIndex: number,
    childIndex: number,
    direction: -1 | 1,
  ) {
    const blocks = componentBlocks(slotKey).map((block) => clone(block))
    const container = blocks[blockIndex]
    if (!container || container.type !== 17) return
    const children = containerChildren(container)
    const target = childIndex + direction
    if (target < 0 || target >= children.length) return
    ;[children[childIndex], children[target]] = [children[target]!, children[childIndex]!]
    container.components = children
    setComponentBlocks(slotKey, blocks)
  }

  function updateContainerChildContent(
    slotKey: string,
    blockIndex: number,
    childIndex: number,
    value: string,
  ) {
    const blocks = componentBlocks(slotKey).map((block) => clone(block))
    const container = blocks[blockIndex]
    if (!container || container.type !== 17) return
    const children = containerChildren(container)
    const child = children[childIndex]
    if (!child) return
    if (child.type === 10) child.content = value
    else if (child.type === 9) {
      const texts = sectionTextBlocks(child).map((text) => clone(text))
      if (texts[0]) texts[0].content = value
      else texts.push({ type: 10, content: value })
      child.components = texts
    }
    container.components = children
    setComponentBlocks(slotKey, blocks)
  }

  function updateContainerChild(
    slotKey: string,
    blockIndex: number,
    childIndex: number,
    key: 'accessoryUrl' | 'mediaUrl' | 'label' | 'emoji' | 'url' | 'divider' | 'spacing',
    value: string | boolean | number,
  ) {
    const blocks = componentBlocks(slotKey).map((block) => clone(block))
    const container = blocks[blockIndex]
    if (!container || container.type !== 17) return
    const children = containerChildren(container)
    const child = children[childIndex]
    if (!child) return
    if (key === 'accessoryUrl') {
      child.accessory = {
        type: 11,
        media: { url: value },
        description: t('botSettings.accessoryImage'),
      }
    } else if (key === 'mediaUrl') {
      child.items = [{ media: { url: value }, description: t('botSettings.accessoryImage') }]
    } else if (key === 'divider' || key === 'spacing') child[key] = value
    else {
      const row = Array.isArray(child.components) ? child.components : []
      const button = isRecord(row[0]) ? row[0] : { type: 2, style: 5 }
      button[key] = key === 'emoji' ? discordEmoji(String(value)) : value
      child.components = [button]
    }
    container.components = children
    setComponentBlocks(slotKey, blocks)
  }

  function removeComponentBlock(slotKey: string, index: number) {
    setComponentBlocks(
      slotKey,
      componentBlocks(slotKey).filter((_, itemIndex) => itemIndex !== index),
    )
  }

  function updateComponentBlock(
    slotKey: string,
    index: number,
    key: 'content' | 'mediaUrl' | 'sectionContent' | 'accessoryUrl' | 'label' | 'emoji' | 'url',
    value: string,
  ) {
    const blocks = componentBlocks(slotKey).map(
      (block) => JSON.parse(JSON.stringify(block)) as Record<string, unknown>,
    )
    const block = blocks[index]
    if (!block) return
    if (key === 'content') block.content = value
    if (key === 'sectionContent') {
      const texts = sectionTextBlocks(block).map((text) => clone(text))
      if (texts[0]) texts[0].content = value
      else texts.push({ type: 10, content: value })
      block.components = texts
    }
    if (key === 'accessoryUrl')
      block.accessory = {
        type: 11,
        media: { url: value },
        description: t('botSettings.accessoryImage'),
      }
    if (key === 'mediaUrl')
      block.items = [{ media: { url: value }, description: t('botSettings.accessoryImage') }]
    if (key === 'label' || key === 'emoji' || key === 'url') {
      const row = Array.isArray(block.components) ? block.components : []
      const button =
        row[0] && typeof row[0] === 'object'
          ? (row[0] as Record<string, unknown>)
          : { type: 2, style: 5 }
      button[key] = key === 'emoji' ? discordEmoji(value) : value
      block.components = [button]
    }
    setComponentBlocks(slotKey, blocks)
  }

  function componentBlockValue(
    block: Record<string, unknown>,
    key: 'mediaUrl' | 'sectionContent' | 'accessoryUrl' | 'label' | 'emoji' | 'url',
  ) {
    if (key === 'mediaUrl' && Array.isArray(block.items)) {
      const item = block.items[0]
      if (
        item &&
        typeof item === 'object' &&
        'media' in item &&
        item.media &&
        typeof item.media === 'object' &&
        'url' in item.media
      )
        return String(item.media.url ?? '')
    }
    if (key === 'sectionContent' && Array.isArray(block.components)) {
      const text = block.components[0]
      if (text && typeof text === 'object' && 'content' in text) return String(text.content ?? '')
    }
    if (
      key === 'accessoryUrl' &&
      block.accessory &&
      typeof block.accessory === 'object' &&
      'media' in block.accessory &&
      block.accessory.media &&
      typeof block.accessory.media === 'object' &&
      'url' in block.accessory.media
    )
      return String(block.accessory.media.url ?? '')
    if ((key === 'label' || key === 'emoji' || key === 'url') && Array.isArray(block.components)) {
      const button = block.components[0]
      if (button && typeof button === 'object' && key in button)
        return key === 'emoji' ? componentEmoji(button[key]) : String(button[key] ?? '')
    }
    return ''
  }

  function moveComponentBlock(slotKey: string, index: number, direction: -1 | 1) {
    const blocks = [...componentBlocks(slotKey)]
    const target = index + direction
    if (target < 0 || target >= blocks.length) return
    ;[blocks[index], blocks[target]] = [blocks[target]!, blocks[index]!]
    setComponentBlocks(slotKey, blocks)
  }

  function dropComponentBlock(slotKey: string, targetIndex: number) {
    const source = draggedComponent.value
    draggedComponent.value = null
    if (!source || source.slotKey !== slotKey || source.index === targetIndex) return
    const blocks = [...componentBlocks(slotKey)]
    const [moved] = blocks.splice(source.index, 1)
    if (!moved) return
    blocks.splice(targetIndex, 0, moved)
    setComponentBlocks(slotKey, blocks)
  }

  function blockSummary(block: Record<string, unknown>) {
    if (block.type === 10) return `Content · ${String(block.content ?? '').slice(0, 60)}`
    if (block.type === 9) return 'Section with accessory'
    if (block.type === 12) return 'Media gallery'
    if (block.type === 14) return 'Separator'
    if (block.type === 1) return 'Link button row'
    if (block.type === 17) return `Container · ${containerChildren(block).length} components`
    return `Component type ${String(block.type ?? '?')}`
  }

  function visualDefinition(slotKey: string): Record<string, unknown> {
    const definition = presentations.value[slotKey] ?? {}
    const mode = requestedMode(definition)
    const storage = presentationStorage(definition, mode)
    if (storage.kind === 'embed-array') return embedArrayDefinition(definition)
    if (storage.kind === 'nested') {
      const nested = isRecord(definition[storage.key])
        ? (definition[storage.key] as Record<string, unknown>)
        : nestedSeed(definition, mode)
      return { ...definition, ...nested }
    }
    return definition
  }

  function variableToken(variable: string) {
    return `{{${variable}}}`
  }

  function toggleAdvanced(slotKey: string) {
    const next = new Set(advancedSlots.value)
    if (next.has(slotKey)) next.delete(slotKey)
    else next.add(slotKey)
    advancedSlots.value = next
  }

  function previewAdvancedJson(slotKey: string) {
    try {
      const parsed = JSON.parse(presentationJson.value[slotKey] ?? '{}') as unknown
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        presentations.value[slotKey] = parsed as Record<string, unknown>
      }
    } catch {
      // Keep the latest valid preview while JSON is incomplete during typing.
    }
  }
  return {
    updatePresentation,
    embedColor,
    updateEmbedColor,
    embedObject,
    updateEmbedObject,
    fixedActions,
    defaultActionLabel,
    updateActionOverride,
    visualArray,
    updateVisualArray,
    addEmbedField,
    updateEmbedField,
    removeEmbedField,
    addLink,
    updateLink,
    removeLink,
    componentBlocks,
    supportsBlockBuilder,
    updateRootPresentation,
    systemComponents,
    updateSystemComponent,
    coFeatureComponents,
    addCoFeature,
    removeCoFeature,
    updateCoFeature,
    availableCoFeatureOptions,
    setComponentBlocks,
    containerChildren,
    componentCount,
    componentColor,
    updateContainerBlock,
    createComponentBlock,
    sectionTextBlocks,
    updateSectionText,
    addSectionText,
    removeSectionText,
    sectionAccessory,
    sectionAccessoryType,
    setSectionAccessory,
    updateSectionAccessory,
    mediaItems,
    mediaItemUrl,
    mediaItemDescription,
    updateMediaItem,
    addMediaItem,
    updateMediaItemField,
    removeMediaItem,
    actionRowButtons,
    componentEmoji,
    updateActionRowButton,
    addActionRowButton,
    removeActionRowButton,
    updateSeparator,
    addComponentBlock,
    addContainerChild,
    removeContainerChild,
    moveContainerChild,
    updateContainerChildContent,
    updateContainerChild,
    removeComponentBlock,
    updateComponentBlock,
    componentBlockValue,
    moveComponentBlock,
    dropComponentBlock,
    blockSummary,
    visualDefinition,
    variableToken,
    toggleAdvanced,
    previewAdvancedJson,
  }
}
