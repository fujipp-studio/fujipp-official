import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import { i18n, loadRouteMessages } from './i18n'
import router from './router'
import { useAuthStore } from './stores'
import './style.css'

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
const auth = useAuthStore(pinia)
auth.initializeGuestState()

async function mount() {
  await loadRouteMessages(window.location.pathname)
  app.use(i18n)
  app.use(router)
  await router.isReady()
  app.mount('#app')
  if (!auth.initialized) void auth.initialize()
}
void mount()
