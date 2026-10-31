<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { Wallet, RefreshCw, Users, ArrowDownToLine, CircleAlert } from 'lucide-vue-next'
import { AppButton, AppTextField } from '@/shared/ui'
import AppRequestError from '@/shared/ui/feedback/AppRequestError.vue'
import { useAuthStore } from '@/stores'
import {
  fetchMoney,
  formatWalletMoney,
  type MoneyOverview,
  type MoneyCustomer,
  type MoneyTopup,
  type MoneyPage,
} from '../money-api'

const route = useRoute()
const auth = useAuthStore()
const { session } = storeToRefs(auth)
const { locale } = useI18n()
const text = (en: string, th: string) => (locale.value === 'th' ? th : en)
const botId = computed(() => String(route.params.botId ?? ''))
const admin = computed(() => route.path.startsWith('/admin/'))
const tab = ref<'customers' | 'topups' | 'review'>('customers')
const provider = ref('')
const search = ref('')
const member = ref('')
const overview = ref<MoneyOverview | null>(null)
const customers = ref<MoneyCustomer[]>([])
const topups = ref<MoneyTopup[]>([])
const next = ref<string | null>(null)
const loading = ref(false)
const error = ref('')
let request: AbortController | undefined
let summaryRequest: AbortController | undefined
const money = (value: string | null) => formatWalletMoney(value, locale.value)
const tabs = computed(() => [
  { key: 'customers' as const, label: text('Customers', 'ลูกค้า'), icon: Users },
  {
    key: 'topups' as const,
    label: text('Top-up history', 'ประวัติเติมเงิน'),
    icon: ArrowDownToLine,
  },
  { key: 'review' as const, label: text('Needs review', 'รอตรวจสอบ'), icon: CircleAlert },
])
function status(value: MoneyTopup['status']) {
  const labels = {
    CREDITED: text('Credited', 'เพิ่มยอดแล้ว'),
    RECEIVED_PENDING_CREDIT: text('Received · credit pending', 'รับเงินแล้ว · รอเพิ่มยอด'),
    REVIEW_REQUIRED: text('Needs review · do not retry', 'รอตรวจสอบ · อย่าส่งซ้ำ'),
    PROCESSING: text('Processing', 'กำลังดำเนินการ'),
    REJECTED: text('Rejected before receipt', 'ไม่ผ่านการตรวจสอบ'),
    LEGACY_RECORD: text('Historical record', 'รายการจากระบบเดิม'),
  }
  return labels[value] ?? value
}
function date(value: string | null) {
  return value
    ? new Date(value).toLocaleString(locale.value === 'th' ? 'th-TH' : 'en-GB', {
        timeZone: 'Asia/Bangkok',
      })
    : '—'
}
async function load(append = false) {
  request?.abort()
  const controller = new AbortController()
  request = controller
  loading.value = true
  error.value = ''
  if (!append) {
    customers.value = []
    topups.value = []
    next.value = null
  }
  try {
    await auth.initialize()
    if (controller.signal.aborted || !session.value) return
    const isCustomers = tab.value === 'customers'
    const result = await fetchMoney<MoneyPage<MoneyCustomer> | MoneyPage<MoneyTopup>>(
      botId.value,
      admin.value,
      isCustomers ? 'customers' : 'topups',
      session.value,
      {
        member: member.value,
        provider: isCustomers ? '' : provider.value,
        review: String(tab.value === 'review'),
        cursor: append ? (next.value ?? '') : '',
      },
      controller.signal,
    )
    if (controller.signal.aborted) return
    if (isCustomers)
      customers.value = [...(append ? customers.value : []), ...(result.items as MoneyCustomer[])]
    else topups.value = [...(append ? topups.value : []), ...(result.items as MoneyTopup[])]
    next.value = result.nextCursor
  } catch (cause) {
    if (!controller.signal.aborted)
      error.value =
        cause instanceof Error
          ? cause.message
          : text('Unable to load Wallet data.', 'โหลดข้อมูลเงินไม่สำเร็จ')
  } finally {
    if (!controller.signal.aborted) loading.value = false
  }
}
async function refresh() {
  summaryRequest?.abort()
  const controller = new AbortController()
  summaryRequest = controller
  const list = load()
  try {
    await auth.initialize()
    if (controller.signal.aborted || !session.value) return
    const result = await fetchMoney<MoneyOverview>(
      botId.value,
      admin.value,
      'overview',
      session.value,
      {},
      controller.signal,
    )
    if (!controller.signal.aborted) overview.value = result
  } catch (cause) {
    if (!controller.signal.aborted)
      error.value =
        cause instanceof Error
          ? cause.message
          : text('Unable to load summary.', 'โหลดสรุปไม่สำเร็จ')
  }
  await list
}
function applySearch() {
  member.value = search.value.trim()
  void load()
}
watch([tab, provider], () => void load())
watch(
  [botId, admin, () => session.value?.user.id],
  () => {
    request?.abort()
    summaryRequest?.abort()
    overview.value = null
    search.value = ''
    member.value = ''
    void refresh()
  },
  { immediate: true },
)
onBeforeUnmount(() => {
  request?.abort()
  summaryRequest?.abort()
})
</script>

<template>
  <section data-bot-money class="space-y-lg" :aria-label="text('Money', 'เงิน')">
    <header class="flex flex-wrap items-start justify-between gap-md">
      <div class="space-y-xs">
        <h2 class="flex items-center gap-sm text-2xl font-bold">
          <Wallet aria-hidden="true" />{{ text('Money', 'เงิน') }}
        </h2>
        <p class="text-sm text-text-secondary">
          {{
            text(
              'One Wallet per customer in this bot. Top-ups are separated by payment channel.',
              'ลูกค้าแต่ละคนใช้ Wallet เดียวภายในบอทนี้ และแยกประวัติตามช่องทางเติมเงิน',
            )
          }}
        </p>
      </div>
      <AppButton class="tablet:!w-auto" variant="secondary" :disabled="loading" @click="refresh"
        ><RefreshCw :size="16" aria-hidden="true" />{{ text('Refresh', 'รีเฟรช') }}</AppButton
      >
    </header>
    <div
      v-if="overview"
      class="grid gap-md tablet:grid-cols-2 desktop:grid-cols-4"
      aria-live="polite"
    >
      <div class="money-summary">
        <p>{{ text('Customer Wallet balance', 'ยอด Wallet คงเหลือรวม') }}</p>
        <strong>{{ money(overview.balanceSatang) }}</strong
        ><small
          >{{ overview.customerCount.toLocaleString() }} {{ text('customers', 'ลูกค้า') }}</small
        >
      </div>
      <div class="money-summary">
        <p>TrueMoney</p>
        <strong>{{ money(overview.trueMoneyTopupSatang) }}</strong
        ><small>{{
          text('Total credited after fees', 'ยอดเพิ่มเข้ากระเป๋าหลังหักค่าธรรมเนียม')
        }}</small>
      </div>
      <div class="money-summary">
        <p>SlipOK</p>
        <strong>{{ money(overview.slipOkTopupSatang) }}</strong
        ><small>{{ text('Total credited', 'ยอดเพิ่มเข้ากระเป๋ารวม') }}</small>
      </div>
      <div class="money-summary">
        <p>{{ text('Needs review / pending credit', 'รอตรวจสอบ / รอเพิ่มยอด') }}</p>
        <strong>{{ overview.reviewCount.toLocaleString() }}</strong
        ><small>{{ text('New-system TrueMoney attempts', 'รายการ TrueMoney ในระบบใหม่') }}</small>
      </div>
    </div>
    <div class="rounded-xl border border-border-subtle bg-bg-surface p-md tablet:p-lg">
      <nav class="flex flex-wrap gap-xs" :aria-label="text('Wallet sections', 'หมวดข้อมูลเงิน')">
        <AppButton
          class="tablet:!w-auto"
          v-for="item in tabs"
          :key="item.key"
          :variant="tab === item.key ? 'primary' : 'secondary'"
          :aria-pressed="tab === item.key"
          @click="tab = item.key"
          ><component :is="item.icon" :size="16" aria-hidden="true" />{{ item.label }}</AppButton
        >
      </nav>
      <form
        class="my-lg flex flex-col gap-sm tablet:flex-row tablet:items-end"
        @submit.prevent="applySearch"
      >
        <AppTextField
          v-model="search"
          :label="text('Customer Discord ID', 'Discord ID ลูกค้า')"
          input-type="tel"
          pattern="[0-9]{15,30}"
          :maxlength="30"
          :placeholder="text('All customers', 'ลูกค้าทั้งหมด')"
          class="min-w-0 tablet:flex-1"
        />
        <label v-if="tab !== 'customers'" class="flex flex-col gap-xs text-sm font-medium"
          >{{ text('Payment channel', 'ช่องทางเติมเงิน') }}
          <select
            v-model="provider"
            class="rounded-md border border-border-default bg-bg-surface p-sm text-text-primary"
          >
            <option value="">{{ text('All channels', 'ทุกช่องทาง') }}</option>
            <option value="TRUEMONEY">TrueMoney</option>
            <option value="SLIPOK">SlipOK</option>
          </select>
        </label>
        <AppButton class="tablet:!w-auto" type="submit" variant="secondary">{{
          text('Search', 'ค้นหา')
        }}</AppButton>
      </form>
      <p v-if="tab === 'review'" class="mb-md text-sm text-text-secondary">
        {{
          text(
            'A pending credit is recovered from a verified receipt. Uncertain receipts require investigation. Historical records are never automatically credited.',
            'รายการที่รับเงินแล้วจะเพิ่มยอดต่อจากหลักฐานเดิม รายการที่ยืนยันผลรับเงินไม่ได้ต้องตรวจสอบก่อน และรายการจากระบบเดิมจะไม่ถูกเพิ่มยอดอัตโนมัติ',
          )
        }}
      </p>
      <AppRequestError v-if="error" :message="error" :busy="loading" @retry="refresh" />
      <p
        v-if="loading && !customers.length && !topups.length"
        role="status"
        class="py-xl text-center text-text-secondary"
      >
        {{ text('Loading Wallet data…', 'กำลังโหลดข้อมูลเงิน…') }}
      </p>
      <p
        v-else-if="!error && !(tab === 'customers' ? customers.length : topups.length)"
        role="status"
        class="rounded-lg border border-dashed border-border-default p-xl text-center text-text-secondary"
      >
        {{ text('No matching records.', 'ไม่พบรายการที่ตรงกับเงื่อนไข') }}
      </p>
      <div v-if="tab === 'customers'" class="space-y-sm">
        <article
          v-for="customer in customers"
          :key="customer.memberDiscordId"
          data-money-customer
          class="money-row tablet:grid-cols-[2fr_1fr_1fr] tablet:items-center"
        >
          <div class="min-w-0 space-y-xs">
            <span class="text-xs text-text-secondary">Discord ID</span>
            <p class="break-all font-mono text-sm">{{ customer.memberDiscordId }}</p>
            <p class="text-xs text-text-secondary">
              {{ text('Last top-up', 'เติมเงินล่าสุด') }}: {{ date(customer.lastTopupAt) }}
            </p>
          </div>
          <div>
            <p class="text-xs text-text-secondary">{{ text('Wallet balance', 'ยอดคงเหลือ') }}</p>
            <p class="text-xl font-semibold">{{ money(customer.balanceSatang) }}</p>
          </div>
          <div>
            <p class="text-xs text-text-secondary">{{ text('Total top-ups', 'เติมเงินสะสม') }}</p>
            <p class="font-semibold">{{ money(customer.totalTopupSatang) }}</p>
          </div>
        </article>
      </div>
      <div v-else class="space-y-sm">
        <article
          v-for="topup in topups"
          :key="topup.id"
          data-money-topup
          class="space-y-md rounded-lg border border-border-subtle p-md"
        >
          <div class="flex flex-wrap items-center justify-between gap-sm">
            <span class="font-semibold">{{
              topup.provider === 'TRUEMONEY' ? 'TrueMoney' : 'SlipOK'
            }}</span
            ><span
              class="rounded-md bg-bg-surface-hover px-sm py-xs text-sm"
              :class="topup.status === 'CREDITED' ? 'text-success-text' : 'text-text-secondary'"
              >{{ status(topup.status) }}</span
            >
          </div>
          <div class="grid min-w-0 gap-md tablet:grid-cols-2 desktop:grid-cols-4">
            <div class="min-w-0">
              <p class="text-xs text-text-secondary">Discord ID</p>
              <p class="break-all font-mono text-sm">{{ topup.memberDiscordId }}</p>
            </div>
            <div>
              <p class="text-xs text-text-secondary">{{ text('Received', 'ยอดรับ') }}</p>
              <p>{{ money(topup.grossSatang) }}</p>
            </div>
            <div>
              <p class="text-xs text-text-secondary">{{ text('Fee', 'ค่าธรรมเนียม') }}</p>
              <p>{{ money(topup.feeSatang) }}</p>
            </div>
            <div>
              <p class="text-xs text-text-secondary">{{ text('Credited', 'เพิ่มเข้ากระเป๋า') }}</p>
              <p class="font-semibold">{{ money(topup.creditedSatang) }}</p>
            </div>
          </div>
          <div class="space-y-xs break-all text-xs text-text-secondary">
            <p>{{ date(topup.createdAt) }} · {{ text('Record', 'รายการ') }} {{ topup.id }}</p>
            <p v-if="topup.reference">{{ text('Reference', 'อ้างอิง') }}: {{ topup.reference }}</p>
            <p v-if="topup.failureCode">{{ text('Code', 'รหัส') }}: {{ topup.failureCode }}</p>
            <p v-if="topup.legacy">
              {{
                text(
                  'Historical record. Check Admin adjustments before any manual correction.',
                  'รายการจากระบบเดิม โปรดตรวจสอบประวัติปรับยอดโดยแอดมินก่อนแก้ไขยอด',
                )
              }}
            </p>
          </div>
        </article>
      </div>
      <AppButton
        v-if="next"
        class="mt-lg tablet:!w-auto"
        variant="secondary"
        :disabled="loading"
        @click="load(true)"
        >{{ text('Load more', 'โหลดเพิ่มเติม') }}</AppButton
      >
    </div>
  </section>
</template>

<style scoped>
:deep(.app-button__label) {
  display: inline-flex;
  align-items: center;
  gap: var(--space-xs);
}
.money-summary {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
  border: 1px solid var(--color-border-subtle);
  border-radius: var(--radius-lg);
  background: var(--color-bg-surface);
  padding: var(--space-md);
  min-width: 0;
  overflow-wrap: anywhere;
}
.money-summary p,
.money-summary small {
  color: var(--color-text-secondary);
  font-size: var(--font-size-body-small);
}
.money-summary strong {
  font-size: var(--font-size-heading-h1);
  font-weight: var(--typography-font-weight-bold);
}
.money-row {
  display: grid;
  gap: var(--space-md);
  border-bottom: 1px solid var(--color-border-subtle);
  padding: var(--space-md) 0;
}
</style>
