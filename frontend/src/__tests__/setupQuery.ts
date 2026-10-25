import { config } from '@vue/test-utils'
import { VueQueryPlugin, type QueryClient } from '@tanstack/vue-query'
import { beforeEach, afterEach } from 'vitest'
import { createApiQueryClient } from '@/shared/api/queryClient'

const plugins = [...config.global.plugins]
export let testQueryClient: QueryClient
beforeEach(() => {
  testQueryClient = createApiQueryClient()
  config.global.plugins = [...plugins, [VueQueryPlugin, { queryClient: testQueryClient }]]
})
afterEach(() => {
  testQueryClient.clear()
})
