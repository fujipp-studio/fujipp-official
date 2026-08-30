import { computed, inject, onScopeDispose, ref, watch, type InjectionKey, type Ref } from 'vue'
import { useAuthStore } from '@/stores'
import {
  controlBot,
  fetchBots,
  fetchFeatureLicenses,
  type FeatureLicense,
  type UserBot,
} from '../api'
import { fetchRuntimeSubscriptions, type RuntimeSubscription } from '../runtime-api'
import {
  controlAdminBot,
  fetchAdminBotLicenses,
  fetchAdminBotSettings,
} from '@/features/admin/api/bots'
import type { BotControlAction } from '../runtime-status'

interface Options {
  botId: Ref<string>
  adminMode: Ref<boolean>
  licenseId?: Ref<string>
}

/** One instance per settings flow, shared by the shell and its routed children. */
export function createBotSettingsData(options: Options) {
  const auth = useAuthStore()
  const bots = ref<UserBot[]>([])
  const licenses = ref<FeatureLicense[]>([])
  const runtimeSubscriptions = ref<RuntimeSubscription[]>([])
  const loading = ref(false)
  const error = ref('')
  const controlAction = ref<BotControlAction | null>(null)
  const controlling = computed(() => controlAction.value !== null)
  const bot = computed(() => {
    const installedId = licenses.value
      .find((item) => item.id === options.licenseId?.value)
      ?.installations.find((item) => item.status === 'ACTIVE')?.botId
    return bots.value.find((item) => item.id === (options.botId.value || installedId)) ?? null
  })
  let generation = 0
  let mutationVersion = 0
  let pending: Promise<void> | undefined
  let loaded = false
  let disposed = false
  let controller: AbortController | undefined
  let pollTimer: ReturnType<typeof setTimeout> | undefined

  function setBot(next: UserBot) {
    mutationVersion += 1
    const index = bots.value.findIndex((item) => item.id === next.id)
    if (index < 0) bots.value.push(next)
    else bots.value[index] = next
  }

  function load(force = false): Promise<void> {
    if (pending) return pending
    if (disposed || (loaded && !force)) return Promise.resolve()
    const version = generation
    const targetId = options.botId.value
    const adminMode = options.adminMode.value
    controller = new AbortController()
    const signal = controller.signal
    loading.value = true
    error.value = ''
    const request = (async () => {
      if (!auth.initialized) await auth.initialize()
      const session = auth.session
      if (!session) throw new Error('Please sign in to load bot settings.')
      const result = adminMode
        ? await Promise.all([
            fetchAdminBotSettings(targetId, session).then((item) => [item]),
            fetchAdminBotLicenses(targetId, session),
            Promise.resolve([] as RuntimeSubscription[]),
          ])
        : await Promise.all([
            fetchBots(session, signal),
            fetchFeatureLicenses(session, signal),
            fetchRuntimeSubscriptions(session),
          ])
      if (disposed || version !== generation) return
      ;[bots.value, licenses.value, runtimeSubscriptions.value] = result
      loaded = true
    })()
      .catch((cause) => {
        if (!disposed && version === generation && !signal.aborted) {
          error.value = cause instanceof Error ? cause.message : 'Unable to load bot settings.'
        }
      })
      .finally(() => {
        if (version === generation) {
          pending = undefined
          loading.value = false
        }
      })
    pending = request
    return request
  }

  async function refreshBot() {
    const session = auth.session
    if (!session || !loaded || controlling.value || pending || disposed || document.hidden) return
    const version = generation
    const mutation = mutationVersion
    const targetId = bot.value?.id
    if (!targetId) return
    try {
      const next = options.adminMode.value
        ? await fetchAdminBotSettings(targetId, session)
        : (await fetchBots(session, controller?.signal)).find((item) => item.id === targetId)
      if (
        next &&
        !disposed &&
        version === generation &&
        mutation === mutationVersion &&
        !controlling.value
      )
        setBot(next)
    } catch {
      // Keep the last known status; the next scheduled poll retries.
    }
  }

  async function poll() {
    await refreshBot()
    if (!disposed) pollTimer = setTimeout(() => void poll(), 3000)
  }

  async function runControl(action: BotControlAction) {
    const session = auth.session
    const target = bot.value
    if (!session || !target || controlling.value) return
    const version = generation
    mutationVersion += 1
    controlAction.value = action
    error.value = ''
    try {
      let next: UserBot
      if (options.adminMode.value) {
        await controlAdminBot(target.id, action, session)
        next = await fetchAdminBotSettings(target.id, session)
      } else next = await controlBot(target.id, action, session)
      if (!disposed && version === generation) setBot(next)
    } catch (cause) {
      if (!disposed && version === generation)
        error.value = cause instanceof Error ? cause.message : 'Unable to control bot.'
    } finally {
      if (version === generation) controlAction.value = null
    }
  }

  watch([options.botId, options.adminMode, () => auth.session?.user?.id], () => {
    generation += 1
    controller?.abort()
    pending = undefined
    loaded = false
    bots.value = []
    licenses.value = []
    runtimeSubscriptions.value = []
    controlAction.value = null
    void load()
  })
  pollTimer = setTimeout(() => void poll(), 3000)
  onScopeDispose(() => {
    disposed = true
    generation += 1
    controller?.abort()
    clearTimeout(pollTimer)
  })

  return {
    bots,
    bot,
    licenses,
    runtimeSubscriptions,
    loading,
    error,
    controlAction,
    controlling,
    load,
    setBot,
    runControl,
  }
}

export type BotSettingsData = ReturnType<typeof createBotSettingsData>
export const botSettingsDataKey: InjectionKey<BotSettingsData> = Symbol('bot-settings-data')

export function useBotSettingsData(options: Options) {
  return inject(botSettingsDataKey, null) ?? createBotSettingsData(options)
}
