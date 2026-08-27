import { createMemoryHistory, createRouter } from 'vue-router'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import WalletTopupDesignView from '../features/topup/views/WalletTopupDesignView.vue'
import { i18n } from '../i18n'

describe('WalletTopupDesignView', () => {
  it('shows all three non-functional top-up design sections together', async () => {
    const router=createRouter({history:createMemoryHistory(),routes:[
      {path:'/components',component:{template:'<div>Components</div>'}},
      {path:'/components/topup',component:WalletTopupDesignView},
    ]})
    await router.push('/components/topup')
    await router.isReady()
    i18n.global.locale.value = 'en'

    const wrapper=mount(WalletTopupDesignView,{global:{plugins:[router, i18n]}})

    expect(wrapper.findAll('.desk-section')).toHaveLength(3)
    expect(wrapper.text()).toContain('Amount')
    expect(wrapper.text()).toContain('Scan')
    expect(wrapper.text()).toContain('Slip')
    expect(wrapper.text()).toContain('No real payment')
    expect(wrapper.get('.fake-qr').text()).toContain('PREVIEW')

    i18n.global.locale.value = 'th'
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).toContain('จำนวน')
    expect(wrapper.text()).toContain('สแกน')
    expect(wrapper.text()).toContain('สลิป')
    expect(wrapper.text()).toContain('ไม่มีการชำระเงินจริง')
  })
})
