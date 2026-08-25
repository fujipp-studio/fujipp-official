import { readonly, ref } from 'vue'

const STORAGE_KEY = 'fujipp-admin-tools-visible'
const visible = ref(true)
let initialized = false

export function useAdminToolsVisibility() {
  function initialize() {
    if (initialized) return
    initialized = true
    try {
      visible.value = localStorage.getItem(STORAGE_KEY) !== 'false'
    } catch {
      visible.value = true
    }
  }

  function setVisible(value: boolean) {
    visible.value = value
    try {
      localStorage.setItem(STORAGE_KEY, String(value))
    } catch {
      // The preference remains active for this session when storage is unavailable.
    }
  }

  return { visible: readonly(visible), initialize, setVisible }
}
