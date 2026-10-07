import { defineComponent, h, nextTick, ref } from 'vue'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { describe, expect, it } from 'vitest'
import CommandPermissionsEditor from '../features/bots/components/CommandPermissionsEditor.vue'

function setup(value: string) {
  const model = ref(value)
  const Harness = defineComponent({
    setup: () => () =>
      h(CommandPermissionsEditor, {
        modelValue: model.value,
        'onUpdate:modelValue': (value: string) => {
          model.value = value
        },
      }),
  })
  const wrapper = mount(Harness, {
    global: { plugins: [createI18n({ legacy: false, locale: 'en', messages: { en: {} } })] },
  })
  return { wrapper, model }
}

describe('CommandPermissionsEditor input and data preservation', () => {
  it('keeps typed delimiters while storing IDs as arrays and preserves extra rule properties', async () => {
    const { wrapper, model } = setup(
      JSON.stringify([
        { command: 'spending/add', roleIds: [], userIds: [], metadata: { keep: true } },
      ]),
    )
    const input = wrapper.get('input[placeholder="Paste Role IDs separated by commas"]')
    await input.setValue('123456789012345678, ')
    expect((input.element as HTMLInputElement).value).toBe('123456789012345678, ')
    await input.setValue('123456789012345678, 987654321098765432')
    expect(JSON.parse(model.value)).toEqual([
      {
        command: 'spending/add',
        roleIds: ['123456789012345678', '987654321098765432'],
        userIds: [],
        metadata: { keep: true },
      },
    ])
    model.value = JSON.stringify([{ command: '*', roleIds: [], userIds: ['111111111111111111'] }])
    await nextTick()
    expect((input.element as HTMLInputElement).value).toBe('')
    expect(
      wrapper.get('input[placeholder="Paste User IDs separated by commas"]').element,
    ).toHaveProperty('value', '111111111111111111')
  })
  it.each(['{', '[{"command":"x","roleIds":null,"userIds":[]}]'])(
    'preserves unreadable data until it is corrected: %s',
    async (value) => {
      const { wrapper, model } = setup(value)
      expect(wrapper.find('[role="alert"]').exists()).toBe(true)
      expect(wrapper.get('button[data-add-rule]').attributes('disabled')).toBeDefined()
      expect(model.value).toBe(value)
      await wrapper.get('textarea').setValue('[]')
      expect(wrapper.find('[role="alert"]').exists()).toBe(false)
      await wrapper.get('button[data-add-rule]').trigger('click')
      expect(JSON.parse(model.value)).toEqual([{ command: '', roleIds: [], userIds: [] }])
    },
  )
})
