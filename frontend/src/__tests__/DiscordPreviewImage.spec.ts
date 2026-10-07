import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { describe, expect, it } from 'vitest'
import DiscordPreviewImage from '../features/bots/components/DiscordPreviewImage.vue'

const expired =
  'https://media.discordapp.net/attachments/1/2/image.png?ex=6abe0f04&is=6abcbd84&hm=test&width=700'
const global = {
  plugins: [createI18n({ legacy: false, locale: 'en', messages: { en: {}, th: {} } })],
}
describe('Discord preview media', () => {
  it('loads an old signed URL without labeling it expired', async () => {
    const wrapper = mount(DiscordPreviewImage, { global, props: { src: expired } })
    await wrapper.get('img').trigger('load')
    expect(wrapper.get('img').attributes('src')).toBe(expired)
    expect(wrapper.find('[data-preview-image-error]').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('expired')
    wrapper.unmount()
  })

  it('reports a load failure without guessing its cause and retries the exact same URL', async () => {
    const wrapper = mount(DiscordPreviewImage, {
      global,
      props: { src: expired },
      attrs: { class: 'preview-image' },
    })
    expect(wrapper.get('img').attributes('src')).toBe(expired)
    await wrapper.get('img').trigger('error')
    expect(wrapper.text()).toContain('Image could not be loaded in this preview')
    expect(wrapper.text()).not.toContain('expired')
    expect(wrapper.find('img').exists()).toBe(false)
    expect(wrapper.get('[data-preview-image-error]').classes()).toContain('preview-image')
    await wrapper.get('button').trigger('click')
    expect(wrapper.get('img').attributes('src')).toBe(expired)
    expect(wrapper.find('[data-preview-image-error]').exists()).toBe(false)
    await wrapper.get('img').trigger('error')
    await wrapper.setProps({ src: '/new-image.png' })
    expect(wrapper.find('[data-preview-image-error]').exists()).toBe(false)
    expect(wrapper.get('img').attributes('src')).toBe('/new-image.png')
    wrapper.unmount()
  })

  it('uses a neutral message for other failures and an accessible compact thumbnail', async () => {
    const wrapper = mount(DiscordPreviewImage, {
      global,
      props: { src: 'https://example.invalid/image.png', compact: true },
    })
    await wrapper.get('img').trigger('error')
    expect(wrapper.get('[role="img"]').attributes('aria-label')).toContain(
      'Image could not be loaded',
    )
    expect(wrapper.get('[role="img"]').attributes('aria-label')).not.toContain('expired')
    expect(wrapper.find('p').exists()).toBe(false)
    wrapper.unmount()
  })
})
