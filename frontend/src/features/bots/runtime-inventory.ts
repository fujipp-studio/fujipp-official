import type { RuntimeSubscription } from './runtime-api'

function canManageRuntime(runtime: RuntimeSubscription) {
  return runtime.status === 'ACTIVE' || runtime.status === 'GRACE'
}

export function filterRuntimeInventory(
  subscriptions: RuntimeSubscription[],
  search = '',
  localizedSearchText: (runtime: RuntimeSubscription) => string = () => '',
) {
  const query = search.trim().toLocaleLowerCase()

  return subscriptions.filter((runtime) => {
    if (!canManageRuntime(runtime)) return false

    return `${runtime.planName} SLOT-${runtime.slotNumber} ${runtime.botName ?? ''} ${localizedSearchText(runtime)}`
      .toLocaleLowerCase()
      .includes(query)
  })
}

export function runtimeBotSelections(subscriptions: RuntimeSubscription[]) {
  return Object.fromEntries(subscriptions.map((runtime) => [runtime.id, runtime.botId ?? '']))
}
