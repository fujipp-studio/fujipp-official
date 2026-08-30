<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { ref, watch } from 'vue'
import {
  CheckCircle2,
  ChevronDown,
  Gamepad2,
  KeyRound,
  Plus,
  ShieldCheck,
  Trash2,
} from 'lucide-vue-next'
import { AppButton, AppTextField } from '../../../shared/ui'

const { t } = useI18n()

export interface GroupBlock {
  id: string
  key: string
  name: string
  groupId: number | ''
  cookie: string
  totpSecret: string
  openCloudApiKey: string
  showCookie?: boolean
  showTotp?: boolean
}

const props = defineProps<{
  groupsJson: string
  credentialsConfigured?: boolean
  credentialsJson: string
  showMembershipLookup?: boolean
}>()

const emit = defineEmits<{
  (e: 'update:groupsJson', value: string): void
  (e: 'update:credentialsJson', value: string): void
}>()

const groups = ref<GroupBlock[]>([])
const initialized = ref(false)

function createEmptyGroup(index: number): GroupBlock {
  const key = index === 1 ? 'main' : `group-${index}`
  return {
    id: `group-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    key,
    name: `Group ${index}`,
    groupId: '',
    cookie: '',
    totpSecret: '',
    openCloudApiKey: '',
    showCookie: false,
    showTotp: false,
  }
}

function parseInitialData() {
  if (initialized.value) return
  let parsedGroups: Array<Record<string, unknown>> = []
  try {
    const raw = JSON.parse(props.groupsJson)
    if (Array.isArray(raw)) parsedGroups = raw.filter((item) => item && typeof item === 'object')
  } catch {
    /* invalid or empty JSON */
  }

  let parsedCreds: Record<
    string,
    { cookie?: string; totpSecret?: string; openCloudApiKey?: string }
  > = {}
  try {
    if (props.credentialsJson) {
      const raw = JSON.parse(props.credentialsJson)
      if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
        parsedCreds = raw as Record<
          string,
          { cookie?: string; totpSecret?: string; openCloudApiKey?: string }
        >
      }
    }
  } catch {
    /* invalid or empty JSON */
  }

  if (parsedGroups.length > 0) {
    groups.value = parsedGroups.map((g, idx) => {
      const key = String(g.key ?? `group-${idx + 1}`)
      const cred = parsedCreds[key] ?? {}
      return {
        id: `group-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 7)}`,
        key,
        name: String(g.name ?? `Group ${idx + 1}`),
        groupId: typeof g.groupId === 'number' ? g.groupId : Number(g.groupId) || '',
        cookie: cred.cookie ?? '',
        totpSecret: cred.totpSecret ?? '',
        openCloudApiKey: cred.openCloudApiKey ?? '',
        showCookie: false,
        showTotp: false,
      }
    })
  } else {
    groups.value = [createEmptyGroup(1)]
  }

  initialized.value = true
}

function emitChanges() {
  if (!initialized.value) return

  const groupsPayload = groups.value.map((g, idx) => ({
    key: (g.key || `group-${idx + 1}`).trim(),
    name: (g.name || `Group ${idx + 1}`).trim(),
    groupId: typeof g.groupId === 'number' ? g.groupId : Number(g.groupId) || 0,
  }))

  const credentialsPayload: Record<
    string,
    { cookie?: string; totpSecret?: string; openCloudApiKey?: string }
  > = {}
  for (const g of groups.value) {
    const key = (g.key || 'group').trim()
    if (!key) continue
    const cred: { cookie?: string; totpSecret?: string; openCloudApiKey?: string } = {}
    if (g.cookie.trim()) cred.cookie = g.cookie.trim()
    if (g.totpSecret.trim()) cred.totpSecret = g.totpSecret.trim()
    if (g.openCloudApiKey.trim()) cred.openCloudApiKey = g.openCloudApiKey.trim()
    if (Object.keys(cred).length > 0) {
      credentialsPayload[key] = cred
    }
  }

  emit('update:groupsJson', JSON.stringify(groupsPayload, null, 2))
  emit(
    'update:credentialsJson',
    Object.keys(credentialsPayload).length ? JSON.stringify(credentialsPayload) : '',
  )
}

watch([() => props.groupsJson, () => props.credentialsJson], () => parseInitialData(), {
  immediate: true,
})
watch(groups, () => emitChanges(), { deep: true })

function addGroup() {
  const nextNum = groups.value.length + 1
  groups.value.push(createEmptyGroup(nextNum))
}

function removeGroup(index: number) {
  if (groups.value.length <= 1) return
  groups.value.splice(index, 1)
}

function sanitizeKey(group: GroupBlock) {
  group.key = group.key.toLowerCase().replace(/[^a-z0-9_-]/g, '')
}

function updateGroupId(group: GroupBlock, value: string) {
  group.groupId = value ? Number(value) || '' : ''
}

function groupReady(group: GroupBlock) {
  return Boolean(group.name.trim() && group.key.trim() && Number(group.groupId) > 0)
}
</script>

<template>
  <section class="roblox-groups">
    <header class="roblox-groups__header">
      <div class="roblox-groups__title">
        <span class="roblox-groups__icon"><Gamepad2 /></span>
        <div>
          <h3>{{ t('botSettings.robloxGroups') }}</h3>
          <p>{{ t('botSettings.connectEachPayoutGroupWithItsOwn') }}</p>
        </div>
      </div>
      <AppButton class="roblox-groups__add" @click="addGroup">
        <Plus class="size-4" /> {{ t('botSettings.addGroup') }}
      </AppButton>
    </header>

    <div class="roblox-groups__summary">
      <span
        ><strong>{{ groups.length }}</strong> {{ t('botSettings.groups') }}</span
      >
      <span v-if="credentialsConfigured"
        ><CheckCircle2 class="size-4" /> {{ t('botSettings.credentialsSaved') }}</span
      >
    </div>

    <div class="roblox-groups__list">
      <details v-for="(group, index) in groups" :key="group.id" class="roblox-group" open>
        <summary class="roblox-group__summary">
          <ChevronDown class="roblox-group__chevron" />
          <span class="roblox-group__number">{{ index + 1 }}</span>
          <span class="roblox-group__identity">
            <strong>{{ group.name || t('botSettings.unnamedGroup') }}</strong>
            <small>{{ group.key || t('botSettings.noKey') }} · {{ group.groupId || '—' }}</small>
          </span>
          <span
            :class="['roblox-group__status', { 'roblox-group__status--ready': groupReady(group) }]"
          >
            {{ groupReady(group) ? t('botSettings.ready') : t('botSettings.setupRequired') }}
          </span>
        </summary>

        <div class="roblox-group__body">
          <div class="roblox-group__section">
            <div class="roblox-group__section-title">
              <Gamepad2 class="size-4" />
              <div>
                <strong>{{ t('botSettings.groupInformation') }}</strong
                ><small>{{ t('botSettings.publicIdentifiersUsedByThePanel') }}</small>
              </div>
            </div>
            <div class="roblox-group__grid">
              <AppTextField
                v-model="group.name"
                :label="t('botSettings.groupName')"
                :placeholder="t('botSettings.mainGroup')"
                required
              />
              <AppTextField
                :model-value="group.key"
                :label="t('botSettings.groupKey')"
                placeholder="main"
                :support-text="t('botSettings.lowercaseLettersNumbersHyphensAndUnderscoresOnly')"
                required
                @update:model-value="
                  (value) => {
                    group.key = value
                    sanitizeKey(group)
                  }
                "
              />
              <AppTextField
                :model-value="String(group.groupId)"
                label="Roblox Group ID"
                placeholder="34777878"
                input-type="number"
                :support-text="t('botSettings.findItInTheRobloxCommunityUrl')"
                required
                @update:model-value="(value) => updateGroupId(group, value)"
              />
            </div>
          </div>

          <div class="roblox-group__section roblox-group__section--security">
            <div class="roblox-group__section-title">
              <ShieldCheck class="size-4" />
              <div>
                <strong>{{ t('botSettings.securityCredentials') }}</strong
                ><small>{{ t('botSettings.storedSecurelyAndNeverShownAgainAfter') }}</small>
              </div>
            </div>
            <div class="roblox-group__grid">
              <AppTextField
                v-model="group.cookie"
                class="roblox-group__cookie"
                variant="secret"
                label="Roblox Cookie (.ROBLOSECURITY)"
                :placeholder="
                  credentialsConfigured
                    ? t('botSettings.savedPasteANewCookieToReplace')
                    : t('botSettings.pasteTheRoblosecurityCookie')
                "
                :support-text="t('botSettings.useAnAccountPermittedToTransferGroup')"
                autocomplete="new-password"
              />
              <AppTextField
                v-model="group.totpSecret"
                variant="secret"
                label="2FA Secret Key (TOTP)"
                placeholder="JBSWY3DPEHPK3PXP"
                :support-text="t('botSettings.optionalRequiredOnlyWhenAuthenticator2faIs')"
                autocomplete="new-password"
              />
              <AppTextField
                v-if="showMembershipLookup"
                v-model="group.openCloudApiKey"
                class="roblox-group__open-cloud-key"
                variant="secret"
                label="Roblox Open Cloud API Key"
                :placeholder="
                  credentialsConfigured
                    ? t('botSettings.savedPasteANewKeyToReplace')
                    : t('botSettings.pasteThisGroupSOpenCloudApi')
                "
                :support-text="t('botSettings.useASeparateKeyWithGroupRead')"
                autocomplete="new-password"
              />
            </div>
          </div>

          <div class="roblox-group__footer">
            <span
              ><KeyRound class="size-4" />
              {{ t('botSettings.secretsAreUpdatedOnlyWhenANew') }}</span
            >
            <AppButton
              v-if="groups.length > 1"
              class="roblox-group__delete"
              variant="secondary"
              @click="removeGroup(index)"
            >
              <Trash2 class="size-4" /> {{ t('botSettings.deleteGroup') }}
            </AppButton>
          </div>
        </div>
      </details>
    </div>

    <button type="button" class="roblox-groups__add-another" @click="addGroup">
      <Plus class="size-5" />
      <span
        ><strong>{{ t('botSettings.addAnotherRobloxGroup') }}</strong
        ><small>{{ t('botSettings.configureASeparatePayoutSource') }}</small></span
      >
    </button>
  </section>
</template>

<style scoped>
.roblox-groups {
  display: grid;
  gap: var(--space-md);
  padding-top: var(--space-lg);
  border-top: 1px solid var(--semantic-color-border-border-subtle);
}
.roblox-groups__header,
.roblox-group__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-md);
}
.roblox-groups__title {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}
.roblox-groups__icon {
  display: grid;
  width: 2.75rem;
  height: 2.75rem;
  place-items: center;
  border: 1px solid var(--semantic-color-border-border-default);
  border-radius: var(--corner-radius-md);
  background: var(--semantic-color-background-bg-elevated);
}
.roblox-groups__icon svg {
  width: var(--icon-size-24);
}
.roblox-groups h3 {
  font-size: var(--font-size-heading-small);
  font-weight: var(--typography-font-weight-bold);
}
.roblox-groups p,
.roblox-group small {
  color: var(--semantic-color-text-text-secondary);
  font-size: var(--font-size-body-small);
}
.roblox-groups__add {
  width: auto;
}
.roblox-groups__summary {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-xs);
}
.roblox-groups__summary span {
  display: inline-flex;
  align-items: center;
  gap: var(--space-xxs);
  padding: var(--space-xxs) var(--space-xs);
  border: 1px solid var(--semantic-color-border-border-subtle);
  border-radius: var(--radius-full);
  background: var(--semantic-color-background-bg-surface);
  font-size: var(--font-size-label-small);
}
.roblox-groups__list {
  display: grid;
  gap: var(--space-sm);
}
.roblox-group {
  overflow: hidden;
  border: 1px solid var(--semantic-color-border-border-subtle);
  border-radius: var(--corner-radius-lg);
  background: var(--semantic-color-background-bg-surface);
  box-shadow: var(--effect-shadow-sm);
}
.roblox-group__summary {
  display: flex;
  min-height: 4.5rem;
  align-items: center;
  gap: var(--space-sm);
  padding: var(--space-md);
  cursor: pointer;
  list-style: none;
}
.roblox-group__summary::-webkit-details-marker {
  display: none;
}
.roblox-group__chevron {
  flex: none;
  transition: transform 160ms ease;
}
.roblox-group[open] .roblox-group__chevron {
  transform: rotate(180deg);
}
.roblox-group__number {
  display: grid;
  width: 2rem;
  height: 2rem;
  flex: none;
  place-items: center;
  border-radius: var(--radius-full);
  background: var(--semantic-color-action-backgrounds-bg-secondary);
  font-weight: var(--typography-font-weight-bold);
}
.roblox-group__identity {
  display: grid;
  min-width: 0;
  flex: 1;
}
.roblox-group__identity strong,
.roblox-group__identity small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.roblox-group__status {
  padding: var(--space-xxs) var(--space-xs);
  border-radius: var(--radius-full);
  background: var(--semantic-color-background-bg-elevated);
  color: var(--semantic-color-text-text-secondary);
  font-size: var(--font-size-label-small);
}
.roblox-group__status--ready {
  color: var(--semantic-color-success-success-text);
}
.roblox-group__body {
  display: grid;
  gap: var(--space-md);
  padding: 0 var(--space-md) var(--space-md);
  border-top: 1px solid var(--semantic-color-border-border-subtle);
}
.roblox-group__section {
  display: grid;
  gap: var(--space-md);
  padding-top: var(--space-md);
}
.roblox-group__section--security {
  padding: var(--space-md);
  border: 1px solid var(--semantic-color-border-border-subtle);
  border-radius: var(--corner-radius-md);
  background: var(--semantic-color-background-bg-elevated);
}
.roblox-group__section-title {
  display: flex;
  align-items: flex-start;
  gap: var(--space-xs);
}
.roblox-group__section-title > div {
  display: grid;
}
.roblox-group__grid {
  display: grid;
  gap: var(--space-md);
}
.roblox-group__footer {
  color: var(--semantic-color-text-text-secondary);
  font-size: var(--font-size-body-small);
}
.roblox-group__footer > span {
  display: flex;
  align-items: center;
  gap: var(--space-xxs);
}
.roblox-group__delete {
  width: auto;
  color: var(--semantic-color-error-error-text);
}
.roblox-groups__add-another {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-sm);
  padding: var(--space-md);
  border: 1px dashed var(--semantic-color-border-border-default);
  border-radius: var(--corner-radius-lg);
  background: transparent;
  color: var(--semantic-color-text-text-primary);
  text-align: left;
}
.roblox-groups__add-another:hover {
  background: var(--semantic-color-background-bg-surface-hover);
}
.roblox-groups__add-another span {
  display: grid;
}
@media (min-width: 48rem) {
  .roblox-group__grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .roblox-group__cookie,
  .roblox-group__open-cloud-key {
    grid-column: 1 / -1;
  }
}
@media (max-width: 47.99rem) {
  .roblox-groups__header,
  .roblox-group__footer {
    align-items: stretch;
    flex-direction: column;
  }
  .roblox-groups__add,
  .roblox-group__delete {
    width: 100%;
  }
  .roblox-group__status {
    display: none;
  }
}
@media (prefers-reduced-motion: reduce) {
  .roblox-group__chevron {
    transition: none;
  }
}
</style>
