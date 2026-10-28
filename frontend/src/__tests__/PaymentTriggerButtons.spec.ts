import { mount } from '@vue/test-utils'
import { nextTick, ref } from 'vue'
import { createI18n } from 'vue-i18n'
import { describe, expect, it, vi } from 'vitest'
import PresentationSystemComponentsEditor from '../features/bots/components/PresentationSystemComponentsEditor.vue'
import AppTextField from '../shared/ui/fields/AppTextField.vue'
import { featureEditorKey } from '../features/bots/composables/featureEditorContext'
import { paymentTriggerFixture } from './fixtures/paymentTrigger'

describe('Payment Trigger buttons on existing saved designs', () => {
  it.each(['nested', 'flat'])(
    'shows envelope defaults without changing a %s saved design until edited',
    async (storage) => {
      const messageSlot = paymentTriggerFixture().config.presentations[0]!
      const saved = structuredClone(messageSlot.defaultDefinition)
      delete (saved.components as Record<string, unknown>).voucher_button
      if (storage === 'flat') {
        saved.components = (saved.components_v2 as Record<string, unknown>).components
        delete saved.components_v2
      }
      const presentations = ref<Record<string, Record<string, unknown>>>({ method_selector: saved })
      const presentationJson = ref<Record<string, string>>({
        method_selector: JSON.stringify(saved),
      })
      const original = structuredClone(saved)
      const systemComponents = () =>
        Object.entries(
          Array.isArray(presentations.value.method_selector!.components)
            ? {}
            : (presentations.value.method_selector!.components as Record<
                string,
                Record<string, unknown>
              >),
        ).map(([role, config]) => ({ role, config }))
      const updateSystemComponent = vi.fn<
        (slot: string, role: string, key: string, value: string) => void
      >((slot: string, role: string, key: string, value: string) => {
        ;(presentations.value[slot]!.components as Record<string, Record<string, unknown>>)[role]![
          key
        ] = value
      })
      const wrapper = mount(PresentationSystemComponentsEditor, {
        props: { messageSlot },
        global: {
          plugins: [
            createI18n({
              legacy: false,
              locale: 'en',
              missingWarn: false,
              fallbackWarn: false,
              messages: { en: {} },
            }),
          ],
          provide: {
            [featureEditorKey as symbol]: {
              presentations,
              presentationJson,
              text: (english: string) => english,
              license: ref({ featureCode: 'payment-trigger' }),
              systemComponents,
              updateSystemComponent,
              componentStyleOptions: [],
            },
          },
        },
      })
      const envelope = wrapper.get('[data-system-component="voucher_button"]')
      expect(envelope.text()).toContain('Envelope button')
      expect(presentations.value.method_selector).toEqual(original)
      envelope.findComponent(AppTextField).vm.$emit('update:modelValue', 'Pay by envelope')
      await nextTick()
      expect(updateSystemComponent).toHaveBeenCalledWith(
        'method_selector',
        'voucher_button',
        'label',
        'Pay by envelope',
      )
      const buttons = presentations.value.method_selector!.components as Record<string, unknown>
      expect(buttons.voucher_button).toEqual({
        label: 'Pay by envelope',
        emoji: '🧧',
        style: 'danger',
      })
      expect(buttons.bank_button).toEqual(
        (original.components as Record<string, unknown>).bank_button,
      )
      const originalBlocks =
        storage === 'flat'
          ? original.components
          : (original.components_v2 as Record<string, unknown>).components
      expect(
        (presentations.value.method_selector!.components_v2 as Record<string, unknown>).components,
      ).toEqual(originalBlocks)
    },
  )
})
