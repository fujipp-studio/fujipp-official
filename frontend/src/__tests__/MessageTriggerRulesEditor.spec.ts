import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { describe, expect, it } from 'vitest'
import MessageTriggerRulesEditor from '../features/bots/components/MessageTriggerRulesEditor.vue'
import AppTextField from '../shared/ui/fields/AppTextField.vue'

const global = { plugins: [createI18n({ legacy: false, locale: 'en', messages: { en: {} } })] }
const templates = [
  { value: 'template_1', label: 'Template 1' },
  { value: 'template_2', label: 'Template 2' },
]
const original = {
  categoryId: '123456789012345678',
  template: 'template_1',
  future: { retained: true },
}

describe('Message trigger rules', () => {
  it('adds and edits an administrator trigger with a selected template', async () => {
    const wrapper = mount(MessageTriggerRulesEditor, {
      global,
      props: { modelValue: '[]', kind: 'admin-message', templates },
    })
    await wrapper.get('[data-add-trigger]').trigger('click')
    const added = String(wrapper.emitted('update:modelValue')?.at(-1)?.[0])
    expect(JSON.parse(added)).toEqual([{ trigger: '', template: 'template_1' }])
    await wrapper.setProps({ modelValue: added })
    await wrapper.get('input').setValue('pay')
    const edited = String(wrapper.emitted('update:modelValue')?.at(-1)?.[0])
    expect(JSON.parse(edited)).toEqual([{ trigger: 'pay', template: 'template_1' }])
    await wrapper.setProps({ modelValue: edited })
    await wrapper.findAllComponents(AppTextField)[1]!.vm.$emit('update:modelValue', 'template_2')
    expect(JSON.parse(String(wrapper.emitted('update:modelValue')?.at(-1)?.[0]))).toEqual([
      { trigger: 'pay', template: 'template_2' },
    ])
    wrapper.unmount()
  })
  it('preserves metadata and other rules when changing a target or template', async () => {
    const other = { categoryId: '111111111111111111', template: 'template_2', future: 'keep' }
    const wrapper = mount(MessageTriggerRulesEditor, {
      global,
      props: { kind: 'channel-create', templates, modelValue: JSON.stringify([original, other]) },
    })
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    expect(wrapper.find('select').exists()).toBe(false)
    await wrapper
      .findAllComponents(AppTextField)[0]!
      .vm.$emit('update:modelValue', '222222222222222222')
    const edited = String(wrapper.emitted('update:modelValue')?.at(-1)?.[0])
    await wrapper.setProps({ modelValue: edited })
    await wrapper.findAllComponents(AppTextField)[1]!.vm.$emit('update:modelValue', 'template_2')
    expect(JSON.parse(String(wrapper.emitted('update:modelValue')?.at(-1)?.[0]))).toEqual([
      { ...original, categoryId: '222222222222222222', template: 'template_2' },
      other,
    ])
    wrapper.unmount()
  })

  it('warns about later duplicate triggers using runtime case and whitespace matching', async () => {
    const wrapper = mount(MessageTriggerRulesEditor, {
      global,
      props: {
        kind: 'admin-message',
        templates,
        modelValue: JSON.stringify([
          { trigger: 'pay', template: 'template_1' },
          { trigger: ' PAY ', template: 'template_2' },
          { trigger: 'pay now', template: 'template_1' },
        ]),
      },
    })
    expect(wrapper.findAll('[role="status"]')).toHaveLength(1)
    expect(wrapper.findAll('[data-trigger-rule]')[1]!.text()).toContain('first matching rule')
    expect(wrapper.findAllComponents(AppTextField)[0]!.props('maxlength')).toBe(100)
    wrapper.unmount()
  })

  it('validates targets and missing templates without substituting or deleting saved values', () => {
    const wrapper = mount(MessageTriggerRulesEditor, {
      global,
      props: {
        kind: 'channel-create',
        templates,
        modelValue: JSON.stringify([
          { categoryId: 'bad-id', template: 'template_missing', future: 'keep' },
        ]),
      },
    })
    expect(wrapper.findAllComponents(AppTextField).map((field) => field.props('state'))).toEqual([
      'error',
      'error',
    ])
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    wrapper.unmount()
  })

  it('enforces the rule limit and keeps metadata aligned after a deletion', async () => {
    const other = { categoryId: '111111111111111111', template: 'template_2', future: 'second' }
    const wrapper = mount(MessageTriggerRulesEditor, {
      global,
      props: {
        kind: 'channel-create',
        templates,
        limit: 2,
        modelValue: JSON.stringify([original, other]),
      },
    })
    expect(wrapper.get('[data-add-trigger]').attributes('disabled')).toBeDefined()
    await wrapper.get('button[aria-label="Delete rule 1"]').trigger('click')
    const removed = String(wrapper.emitted('update:modelValue')?.at(-1)?.[0])
    expect(JSON.parse(removed)).toEqual([other])
    await wrapper.setProps({ modelValue: removed })
    await wrapper.get('[data-add-trigger]').trigger('click')
    expect(JSON.parse(String(wrapper.emitted('update:modelValue')?.at(-1)?.[0]))).toEqual([
      other,
      { categoryId: '', template: 'template_1' },
    ])
    wrapper.unmount()
  })
})
