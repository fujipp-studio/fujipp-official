// Test-only bootstrap. This entry is never referenced by the production index.html.
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from '../../src/App.vue'
import router from '../../src/router'
import { i18n } from '../../src/i18n'
import { useAuthStore } from '../../src/stores'
import { session, user } from '../../src/__tests__/fixtures/domain'
import '../../src/style.css'
const app = createApp(App)
const pinia = createPinia()
app.use(pinia)
const auth = useAuthStore(pinia)
const role = new URLSearchParams(location.search).get('role')
auth.initialized = true
if (role !== 'GUEST') {
  auth.session = session
  auth.currentUser = { ...user, role: role === 'USER' ? 'USER' : 'ADMIN' }
}
app.use(router).use(i18n).mount('#app')
