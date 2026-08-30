<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Cpu, Plus, RefreshCw, Pencil } from 'lucide-vue-next'
import { storeToRefs } from 'pinia'
import {
  AppButton,
  AppModal,
  AppSectionIndicator,
  AppTextField,
  AppToggle,
} from '../../../shared/ui'
import { useAuthStore } from '../../../stores'
import {
  fetchAdminRuntimePlans,
  fetchAdminRuntimeSubscriptions,
  grantAdminRuntime,
  updateAdminRuntime,
  updateAdminRuntimePlan,
  type AdminRuntimePlan,
  type AdminRuntimeSubscription,
} from '@/features/admin/api/runtime'
import { AdminLayout, AdminPageHeader, AdminPanel, AdminStatusBadge } from '../components'
const auth = useAuthStore()
const { session } = storeToRefs(auth)
const plans = ref<AdminRuntimePlan[]>([]),
  subs = ref<AdminRuntimeSubscription[]>([]),
  loading = ref(false),
  saving = ref(false),
  error = ref('')
const { t } = useI18n()
const sections = computed(() => [
  { id: 'admin-runtime-plans', label: t('admin.sections.plans') },
  { id: 'admin-runtime-subscriptions', label: t('admin.sections.subscriptions') },
])
const plan = ref<AdminRuntimePlan | null>(null),
  sub = ref<AdminRuntimeSubscription | null>(null),
  grantOpen = ref(false)
const planForm = ref({ name: '', days: '', price: '', active: true, sort: '0' }),
  runtimeForm = ref({
    ownerId: '',
    planId: '',
    botId: '',
    status: 'ACTIVE',
    periodEnd: '',
    autoRenew: false,
    renewalPrice: '',
  })
function localDate(value: string) {
  const d = new Date(value)
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
}
async function load() {
  if (!session.value) return
  loading.value = true
  error.value = ''
  try {
    ;[plans.value, subs.value] = await Promise.all([
      fetchAdminRuntimePlans(session.value),
      fetchAdminRuntimeSubscriptions(session.value),
    ])
  } catch (e) {
    error.value = e instanceof Error ? e.message : t('admin.page.loadError')
  } finally {
    loading.value = false
  }
}
function editPlan(x: AdminRuntimePlan) {
  plan.value = x
  planForm.value = {
    name: x.name,
    days: String(x.durationDays),
    price: String(x.priceSatang / 100),
    active: x.active,
    sort: String(x.sortOrder),
  }
}
function openGrant() {
  grantOpen.value = true
  runtimeForm.value = {
    ownerId: '',
    planId: plans.value[0]?.id ?? '',
    botId: '',
    status: 'ACTIVE',
    periodEnd: '',
    autoRenew: false,
    renewalPrice: '',
  }
}
function editSub(x: AdminRuntimeSubscription) {
  sub.value = x
  runtimeForm.value = {
    ownerId: x.ownerUserId,
    planId: x.planId,
    botId: x.botId ?? '',
    status: x.status,
    periodEnd: localDate(x.periodEnd),
    autoRenew: x.autoRenew,
    renewalPrice: x.renewalPriceSatang == null ? '' : String(x.renewalPriceSatang / 100),
  }
}
function closeRuntimeModal() {
  grantOpen.value = false
  sub.value = null
}
async function savePlan() {
  if (!session.value || !plan.value) return
  saving.value = true
  try {
    await updateAdminRuntimePlan(
      plan.value.id,
      {
        name: planForm.value.name,
        durationDays: Number(planForm.value.days),
        priceSatang: Math.round(Number(planForm.value.price) * 100),
        active: planForm.value.active,
        sortOrder: Number(planForm.value.sort),
      },
      session.value,
    )
    plan.value = null
    await load()
  } catch (e) {
    error.value = e instanceof Error ? e.message : t('admin.page.saveError')
  } finally {
    saving.value = false
  }
}
async function saveRuntime() {
  if (!session.value) return
  saving.value = true
  try {
    if (sub.value)
      await updateAdminRuntime(
        sub.value.id,
        {
          status: runtimeForm.value.status,
          planId: runtimeForm.value.planId,
          botId: runtimeForm.value.botId || null,
          periodEnd: new Date(runtimeForm.value.periodEnd).toISOString(),
          autoRenew: runtimeForm.value.autoRenew,
          renewalPriceSatang: runtimeForm.value.renewalPrice
            ? Math.round(Number(runtimeForm.value.renewalPrice) * 100)
            : null,
        },
        session.value,
      )
    else
      await grantAdminRuntime(
        {
          ownerUserId: runtimeForm.value.ownerId,
          planId: runtimeForm.value.planId,
          botId: runtimeForm.value.botId || undefined,
          periodEnd: runtimeForm.value.periodEnd
            ? new Date(runtimeForm.value.periodEnd).toISOString()
            : undefined,
          autoRenew: runtimeForm.value.autoRenew,
          renewalPriceSatang: runtimeForm.value.renewalPrice
            ? Math.round(Number(runtimeForm.value.renewalPrice) * 100)
            : null,
        },
        session.value,
      )
    sub.value = null
    grantOpen.value = false
    await load()
  } catch (e) {
    error.value = e instanceof Error ? e.message : t('admin.page.saveError')
  } finally {
    saving.value = false
  }
}
onMounted(load)
</script>
<template>
  <AdminLayout
    ><div class="space-y-3xl">
      <AdminPageHeader
        :title="t('admin.page.runtimeTitle')"
        :description="t('admin.page.runtimeDescription')"
        :icon="Cpu"
        ><template #actions
          ><AppButton class="!w-auto" @click="openGrant"
            ><Plus class="size-4" />{{ t('admin.page.addRuntime') }}</AppButton
          ><AppButton class="!w-auto" variant="secondary" :disabled="loading" @click="load"
            ><RefreshCw class="size-4" />{{ t('admin.common.refresh') }}</AppButton
          ></template
        ></AdminPageHeader
      >
      <div
        v-if="error"
        class="rounded-xl border border-error-border bg-error-bg p-md text-error-text"
      >
        {{ error }}
      </div>
      <section id="admin-runtime-plans">
        <AdminPanel
          :title="t('admin.page.runtimePlans')"
          :description="t('admin.page.planCount', { count: plans.length })"
          ><div class="grid gap-md desktop:grid-cols-3">
            <article
              v-for="x in plans"
              :key="x.id"
              class="group flex min-h-52 flex-col rounded-2xl border border-border-subtle bg-bg-elevated p-lg transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:border-border-default hover:shadow-lg"
            >
              <div>
                <h3 class="text-base font-bold text-text-primary">{{ x.name }}</h3>
                <div class="mt-xxs flex flex-wrap items-center gap-xs text-xs text-text-muted">
                  <span>{{ x.code }}</span>
                  <span class="size-1 rounded-full bg-border-default" aria-hidden="true" />
                  <AdminStatusBadge
                    appearance="indicator"
                    :value="x.active ? 'ACTIVE' : 'DISABLED'"
                    :label="x.active ? t('admin.common.active') : t('admin.common.inactive')"
                  />
                </div>
              </div>
              <div class="mt-lg">
                <p class="flex items-baseline gap-xxs text-text-primary">
                  <span class="text-sm font-semibold">฿</span>
                  <span class="text-3xl font-extrabold tracking-tight">{{
                    (x.priceSatang / 100).toLocaleString()
                  }}</span>
                </p>
                <p class="mt-xxs text-xs text-text-secondary">
                  {{ t('admin.page.durationDays', { count: x.durationDays }) }}
                  <span class="mx-xxs text-text-muted">·</span>
                  {{ t('admin.page.order', { count: x.sortOrder }) }}
                </p>
              </div>
              <div class="mt-auto border-t border-border-subtle pt-md">
                <AppButton class="!w-auto" @click="editPlan(x)"
                  ><Pencil class="size-4" />{{ t('admin.page.editPlan') }}</AppButton
                >
              </div>
            </article>
          </div></AdminPanel
        >
      </section>
      <section id="admin-runtime-subscriptions">
        <AdminPanel
          :title="t('admin.sections.subscriptions')"
          :description="t('admin.page.subscriptionCount', { count: subs.length })"
          ><div class="admin-table-scroll overflow-x-auto">
            <table class="w-full min-w-[760px] text-left text-sm">
              <thead class="text-xs text-text-muted">
                <tr>
                  <th class="pb-sm">{{ t('admin.page.slotOwner') }}</th>
                  <th class="pb-sm">{{ t('admin.page.planBot') }}</th>
                  <th class="pb-sm">{{ t('admin.common.status') }}</th>
                  <th class="pb-sm">{{ t('admin.page.expires') }}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody class="divide-y divide-border-subtle">
                <tr v-for="x in subs" :key="x.id">
                  <td class="py-md">
                    <b class="text-text-primary">Slot {{ x.slotNumber }}</b>
                    <p class="text-xs text-text-muted">{{ x.ownerDisplayName }}</p>
                  </td>
                  <td>
                    <b class="text-text-primary">{{ x.planName }}</b>
                    <p class="text-xs text-text-muted">
                      {{ x.botName ?? t('admin.page.unassignedBot') }}
                    </p>
                    <p class="text-xs text-text-accent">
                      {{
                        t('admin.page.renewalPriceValue', {
                          price: (x.effectiveRenewalPriceSatang / 100).toLocaleString(),
                        })
                      }}
                    </p>
                  </td>
                  <td><AdminStatusBadge :value="x.status" /></td>
                  <td class="text-text-secondary">{{ new Date(x.periodEnd).toLocaleString() }}</td>
                  <td>
                    <button
                      class="rounded-md p-xs text-text-secondary hover:bg-bg-surface-hover"
                      :aria-label="t('admin.page.updateTitle')"
                      @click="editSub(x)"
                    >
                      <Pencil class="size-4" />
                    </button>
                  </td>
                </tr>
              </tbody>
            </table></div
        ></AdminPanel>
      </section>
      <AppSectionIndicator :sections="sections" :aria-label="t('admin.sections.navigation')" />
      <AppModal
        :open="Boolean(plan)"
        :title="t('admin.page.editPlan')"
        :disabled="saving"
        @update:open="
          (v) => {
            if (!v) plan = null
          }
        "
        ><div class="grid gap-md tablet:grid-cols-2">
          <AppTextField v-model="planForm.name" :label="t('admin.page.planName')" /><AppTextField
            v-model="planForm.days"
            input-type="number"
            :label="t('admin.page.days')"
          /><AppTextField
            v-model="planForm.price"
            input-type="number"
            unit="฿"
            :label="t('admin.page.price')"
          /><AppTextField
            v-model="planForm.sort"
            input-type="number"
            :label="t('admin.page.sortOrder')"
          /><AppToggle :model-value="planForm.active" @change="(v) => (planForm.active = v)">{{
            t('admin.page.selling')
          }}</AppToggle>
        </div>
        <template #actions
          ><AppButton variant="primary" :disabled="saving" @click="plan = null">{{
            t('admin.common.cancel')
          }}</AppButton
          ><AppButton variant="secondary" :disabled="saving" @click="savePlan">{{
            t('admin.common.save')
          }}</AppButton></template
        ></AppModal
      >
      <AppModal
        :open="grantOpen || Boolean(sub)"
        :title="sub ? t('admin.page.updateTitle') : t('admin.page.grantTitle')"
        :disabled="saving"
        @update:open="
          (v) => {
            if (!v) {
              grantOpen = false
              sub = null
            }
          }
        "
        ><div class="grid gap-md tablet:grid-cols-2">
          <AppTextField
            v-if="!sub"
            v-model="runtimeForm.ownerId"
            label="Owner User ID"
          /><AppTextField
            v-model="runtimeForm.planId"
            variant="dropdown"
            :label="t('admin.page.plan')"
            :options="plans.map((x) => ({ value: x.id, label: x.name }))"
          /><AppTextField
            v-model="runtimeForm.botId"
            :label="t('admin.page.botIdOptional')"
          /><AppTextField
            v-if="sub"
            v-model="runtimeForm.status"
            variant="dropdown"
            :label="t('admin.common.status')"
            :options="
              ['ACTIVE', 'GRACE', 'EXPIRED', 'CANCELLED'].map((x) => ({ value: x, label: x }))
            "
          /><AppTextField
            v-model="runtimeForm.periodEnd"
            input-type="date"
            :label="t('admin.page.expiry')"
          /><AppTextField
            v-model="runtimeForm.renewalPrice"
            input-type="number"
            unit="฿"
            :label="t('admin.page.renewalPriceOverride')"
            :placeholder="
              t('admin.page.renewalPriceDefault', {
                price: (
                  (plans.find((x) => x.id === runtimeForm.planId)?.priceSatang ?? 0) / 100
                ).toLocaleString(),
              })
            "
            :support-text="t('admin.page.renewalPriceHelp')"
          /><AppToggle
            :model-value="runtimeForm.autoRenew"
            @change="(v) => (runtimeForm.autoRenew = v)"
            >{{ t('admin.page.autoRenew') }}</AppToggle
          >
        </div>
        <template #actions
          ><AppButton variant="primary" :disabled="saving" @click="closeRuntimeModal">{{
            t('admin.common.cancel')
          }}</AppButton
          ><AppButton variant="secondary" :disabled="saving" @click="saveRuntime">{{
            t('admin.page.saveRuntime')
          }}</AppButton></template
        ></AppModal
      >
    </div></AdminLayout
  >
</template>
