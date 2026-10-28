import type { Ref } from 'vue'
import { clone } from '../models/presentation'
type Block = Record<string, unknown>
interface Options {
  componentBlocks: (slot: string) => Block[]
  setComponentBlocks: (slot: string, blocks: Block[]) => void
  containerChildren: (block: Block) => Block[]
  componentCount: (slot: string) => number
  actionRowButtons: (block: Block) => Block[]
  featureButtons: (slot: string) => Array<{ value: string; label: string; button: Block }>
  updateButtonFields: (
    slot: string,
    block: number,
    index: number,
    key: 'label' | 'emoji' | 'url',
    value: string,
    child?: number,
  ) => void
  text: (english: string, thai: string) => string
  draggedComponent: Ref<{ slotKey: string; index: number; childIndex?: number } | null>
}
/** Loaded with the layout editor; configuration-only screens do not need placement controls. */
export function useComponentLayout({
  componentBlocks,
  setComponentBlocks,
  containerChildren,
  componentCount,
  actionRowButtons,
  updateButtonFields,
  featureButtons,
  text,
  draggedComponent,
}: Options) {
  function updateActionRowButton(
    slotKey: string,
    blockIndex: number,
    buttonIndex: number,
    key: 'label' | 'emoji' | 'url' | 'action' | 'style',
    value: string,
    childIndex?: number,
  ) {
    if (key !== 'action' && key !== 'style')
      return updateButtonFields(slotKey, blockIndex, buttonIndex, key, value, childIndex)
    const blocks = componentBlocks(slotKey).map((block) => clone(block))
    const parent = blocks[blockIndex]
    const row = childIndex === undefined ? parent : parent && containerChildren(parent)[childIndex]
    if (!row || row.type !== 1) return
    const buttons = actionRowButtons(row)
    if (!buttons[buttonIndex] || buttons.some((item) => item.type !== 2)) return
    if (key === 'style') {
      if (![1, 2, 3, 4].includes(Number(value)) || !buttons[buttonIndex]!.action) return
      buttons[buttonIndex]!.style = Number(value)
    } else {
      const choice = featureButtons(slotKey).find((item) => item.value === value)
      if (choice) buttons[buttonIndex] = clone(choice.button)
      else if (value === 'link')
        buttons[buttonIndex] = {
          type: 2,
          style: 5,
          label: text('Open link', 'เปิดลิงก์'),
          url: 'https://example.com',
        }
      else return
    }
    row.components = buttons
    setComponentBlocks(slotKey, blocks)
  }

  function addFeatureButton(
    slotKey: string,
    action: string,
    blockIndex?: number,
    childIndex?: number,
  ) {
    const choice = featureButtons(slotKey).find((item) => item.value === action)
    if (!choice) return
    const button = clone(choice.button)
    if (blockIndex === undefined) {
      if (componentCount(slotKey) + 2 > 40) return
      setComponentBlocks(slotKey, [...componentBlocks(slotKey), { type: 1, components: [button] }])
    } else if (childIndex === undefined && componentBlocks(slotKey)[blockIndex]?.type === 17) {
      if (componentCount(slotKey) + 2 > 40) return
      const blocks = componentBlocks(slotKey).map((block) => clone(block))
      const container = blocks[blockIndex]!
      container.components = [...containerChildren(container), { type: 1, components: [button] }]
      setComponentBlocks(slotKey, blocks)
    } else {
      if (componentCount(slotKey) >= 40) return
      const blocks = componentBlocks(slotKey).map((block) => clone(block))
      const parent = blocks[blockIndex]
      const row =
        childIndex === undefined ? parent : parent && containerChildren(parent)[childIndex]
      if (!row || row.type !== 1) return
      const buttons = actionRowButtons(row)
      if (buttons.length >= 5 || buttons.some((item) => item.type !== 2)) return
      row.components = [...buttons, button]
      setComponentBlocks(slotKey, blocks)
    }
  }

  /** Move a block into a container or out to the message root without changing its action. */
  function relocateComponentBlock(
    slotKey: string,
    blockIndex: number,
    childIndex: number | undefined,
    destination: string,
  ) {
    if (destination !== 'root' && !/^\d+$/.test(destination)) return
    const blocks = componentBlocks(slotKey).map((block) => clone(block))
    const sourceParent = blocks[blockIndex]
    const source =
      childIndex === undefined
        ? sourceParent
        : sourceParent && containerChildren(sourceParent)[childIndex]
    const targetIndex = destination === 'root' ? -1 : Number(destination)
    const target = targetIndex >= 0 ? blocks[targetIndex] : undefined
    if (
      !source ||
      (targetIndex >= 0 && (!target || target.type !== 17 || source.type === 17)) ||
      (childIndex !== undefined && blockIndex === targetIndex) ||
      (childIndex === undefined && targetIndex === -1)
    )
      return
    if (childIndex === undefined) blocks.splice(blockIndex, 1)
    else
      sourceParent!.components = containerChildren(sourceParent!).filter(
        (_, index) => index !== childIndex,
      )
    if (target) target.components = [...containerChildren(target), source]
    else blocks.push(source)
    setComponentBlocks(slotKey, blocks)
  }

  function componentDestinations(slotKey: string, blockIndex: number, childIndex?: number) {
    const options =
      childIndex === undefined
        ? []
        : [{ value: 'root', label: text('Outside container', 'นอก Container') }]
    for (const [index, block] of componentBlocks(slotKey).entries()) {
      if (block.type === 17 && index !== blockIndex)
        options.push({ value: String(index), label: `Container ${index + 1}` })
    }
    return options
  }

  function dropComponentBlock(slotKey: string, targetIndex: number, targetChildIndex?: number) {
    const source = draggedComponent.value
    draggedComponent.value = null
    if (
      !source ||
      source.slotKey !== slotKey ||
      (source.index === targetIndex && source.childIndex === targetChildIndex)
    )
      return
    const blocks = componentBlocks(slotKey).map((block) => clone(block))
    const sourceParent = blocks[source.index]
    const target = targetChildIndex === undefined ? undefined : blocks[targetIndex]
    const moved =
      source.childIndex === undefined
        ? sourceParent
        : sourceParent && containerChildren(sourceParent)[source.childIndex]
    if (
      !moved ||
      (targetChildIndex !== undefined && (!target || target.type !== 17 || moved.type === 17))
    )
      return
    if (source.childIndex === undefined) blocks.splice(source.index, 1)
    else
      sourceParent!.components = containerChildren(sourceParent!).filter(
        (_, index) => index !== source.childIndex,
      )
    if (target) {
      const children = [...containerChildren(target)]
      children.splice(targetChildIndex! < 0 ? children.length : targetChildIndex!, 0, moved)
      target.components = children
    } else blocks.splice(targetIndex, 0, moved)
    setComponentBlocks(slotKey, blocks)
  }

  return {
    updateActionRowButton,
    addFeatureButton,
    relocateComponentBlock,
    componentDestinations,
    dropComponentBlock,
  }
}
