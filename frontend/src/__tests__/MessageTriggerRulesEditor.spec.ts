import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import MessageTriggerRulesEditor from '@/features/bots/components/MessageTriggerRulesEditor.vue'

const templates = [
  { value: 'template_1', label: 'Message Template 1' },
  { value: 'template_2', label: 'Message Template 2' },
]

describe('MessageTriggerRulesEditor', () => {
  it('adds and edits an administrator trigger with a selected template', async () => {
    const wrapper = mount(MessageTriggerRulesEditor, {
      props: { modelValue: '[]', kind: 'admin-message', templates },
    })

    await wrapper.get('.trigger-add').trigger('click')
    const added = JSON.parse(String(wrapper.emitted('update:modelValue')?.at(-1)?.[0]))
    expect(added).toEqual([{ trigger: '', template: 'template_1' }])

    await wrapper.setProps({ modelValue: JSON.stringify(added) })
    await wrapper.get('input').setValue('pay')
    const withTrigger = JSON.parse(String(wrapper.emitted('update:modelValue')?.at(-1)?.[0]))
    expect(withTrigger).toEqual([{ trigger: 'pay', template: 'template_1' }])

    await wrapper.setProps({ modelValue: JSON.stringify(withTrigger) })
    await wrapper.get('select').setValue('template_2')
    const selected = JSON.parse(String(wrapper.emitted('update:modelValue')?.at(-1)?.[0]))
    expect(selected).toEqual([{ trigger: 'pay', template: 'template_2' }])
  })

  it('stores a category id for channel-created rules', async () => {
    const wrapper = mount(MessageTriggerRulesEditor, {
      props: { modelValue: '[]', kind: 'channel-create', templates },
    })
    await wrapper.get('.trigger-add').trigger('click')
    const added = JSON.parse(String(wrapper.emitted('update:modelValue')?.at(-1)?.[0]))
    expect(added).toEqual([{ categoryId: '', template: 'template_1' }])
  })
})
