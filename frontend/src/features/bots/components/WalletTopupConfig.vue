<script setup lang="ts">
import { computed, ref, useId, watch } from 'vue'
import { CreditCard, Hash, ShieldCheck, Terminal, Trophy, Wallet } from 'lucide-vue-next'
import FeatureSettingsLayout from './FeatureSettingsLayout.vue'
import FeatureSettingsCategories from './FeatureSettingsCategories.vue'
import FeatureSettingsCard from './FeatureSettingsCard.vue'
import FeatureCommandsSettings from './FeatureCommandsSettings.vue'
import FeatureCommandList from './FeatureCommandList.vue'
import FeatureConfigField from './FeatureConfigField.vue'
import WalletMilestonesEditor from './WalletMilestonesEditor.vue'
import { walletTopupCommands } from '../config/feature-commands'
import { useFeatureEditor } from '../composables/featureEditorContext'

const { configuration, values, license, text } = useFeatureEditor()
const id = useId()
const activeCategory = ref('payments')
const field = (key: string) => configuration.value?.fields.find((item) => item.key === key)
const hasAny = (keys: string[]) => keys.some((key) => field(key))
const promptpay = [
  'PROMPTPAY_ID',
  'PROMPTPAY_ACCOUNT_NAME',
  'MIN_TOPUP_SATANG',
  'PROMPTPAY_QR_EXPIRY_MINUTES',
]
const truemoney = [
  'TRUEMONEY_PHONE',
  'TRUEMONEY_FEE_MODE',
  'TRUEMONEY_FEE_SATANG',
  'TRUEMONEY_FEE_PERCENT',
]
const slipok = ['SLIPOK_BRANCH_ID', 'SLIPOK_API_KEY']
const channels = ['SLIP_CHANNEL_ID', 'SLIP_SUBMITTER_ROLE_ID', 'TOPUP_NOTIFICATION_CHANNEL_ID']
const roles = ['WALLET_ADMIN_ROLE_ID', 'TOPUP_MEMBER_ROLE_ID']
const ranking = [
  'TOP_SPENDER_TOP1_ROLE_ID',
  'TOP_SPENDER_TOP10_ROLE_ID',
  'TOP_SPENDER_LEADERBOARD_CHANNEL_ID',
]
const categories = computed(() =>
  [
    {
      key: 'payments',
      label: text('Payment methods', 'ช่องทางชำระเงิน'),
      icon: CreditCard,
      visible: hasAny([...promptpay, ...truemoney, ...slipok]),
    },
    {
      key: 'discord',
      label: text('Channels & roles', 'ห้องและยศ'),
      icon: Hash,
      visible: hasAny([...channels, ...roles]),
    },
    {
      key: 'rewards',
      label: text('Ranking & rewards', 'อันดับและรางวัล'),
      icon: Trophy,
      visible: hasAny([...ranking, 'TOP_SPENDER_MILESTONE_ROLES']),
    },
    {
      key: 'commands',
      label: text('Commands', 'คำสั่ง'),
      icon: Terminal,
      visible: hasAny(['PANEL_COMMAND_NAME', 'WALLET_HISTORY_DEFAULT_LIMIT']),
    },
  ].filter((category) => category.visible),
)
watch(
  categories,
  (items) => {
    if (!items.some((item) => item.key === activeCategory.value))
      activeCategory.value = items[0]?.key ?? ''
  },
  { immediate: true },
)
const panelName = computed(() => String(values.value.PANEL_COMMAND_NAME ?? 'wallet-panel'))
const commands = computed(() =>
  walletTopupCommands(panelName.value.trim().toLowerCase() || 'wallet-panel'),
)
const percentFee = computed(() => values.value.TRUEMONEY_FEE_MODE === 'PERCENT')
const money = (value: unknown) =>
  Number.isFinite(Number(value)) && value !== '' && value != null
    ? (Number(value) / 100).toFixed(2)
    : '—'
const qrMinutes = computed(() => values.value.PROMPTPAY_QR_EXPIRY_MINUTES ?? 5)
const feePreview = computed(() =>
  percentFee.value
    ? String(values.value.TRUEMONEY_FEE_PERCENT ?? 0) + '%'
    : money(values.value.TRUEMONEY_FEE_SATANG) + text(' THB', ' บาท'),
)
const milestones = computed(() => {
  try {
    const rows: unknown = JSON.parse(String(values.value.TOP_SPENDER_MILESTONE_ROLES ?? '[]'))
    return Array.isArray(rows) ? rows.length : 0
  } catch {
    return 0
  }
})
</script>

<template>
  <div class="space-y-lg">
    <FeatureSettingsCategories
      v-if="categories.length > 1"
      v-model="activeCategory"
      :id-prefix="id"
      :label="text('Configuration category', 'หมวดการตั้งค่า')"
      :categories="categories"
    />
    <FeatureSettingsLayout>
      <section
        v-for="category in categories"
        v-show="activeCategory === category.key"
        :id="id + '-panel-' + category.key"
        :key="category.key"
        :role="categories.length > 1 ? 'tabpanel' : undefined"
        :aria-labelledby="categories.length > 1 ? id + '-tab-' + category.key : undefined"
        :aria-label="categories.length === 1 ? category.label : undefined"
        tabindex="0"
        class="min-w-0 space-y-lg"
      >
        <template v-if="category.key === 'payments'">
          <FeatureSettingsCard
            v-if="hasAny(promptpay)"
            title="PromptPay"
            :icon="CreditCard"
            :description="
              text(
                'Receiving account, minimum amount and QR lifetime.',
                'บัญชีรับเงิน ยอดเติมขั้นต่ำ และอายุ QR',
              )
            "
          >
            <div class="grid gap-md tablet:grid-cols-2">
              <FeatureConfigField v-for="key in promptpay" :key="key" :field-key="key" />
            </div>
          </FeatureSettingsCard>
          <FeatureSettingsCard
            v-if="hasAny(truemoney)"
            title="TrueMoney"
            :icon="Wallet"
            :description="
              text(
                'Voucher recipient and the fee deducted on success.',
                'ผู้รับซองของขวัญและค่าธรรมเนียมที่หักเมื่อเติมสำเร็จ',
              )
            "
          >
            <div class="grid gap-md tablet:grid-cols-2">
              <FeatureConfigField field-key="TRUEMONEY_PHONE" />
              <FeatureConfigField field-key="TRUEMONEY_FEE_MODE" />
              <FeatureConfigField
                v-if="field('TRUEMONEY_FEE_SATANG')"
                v-show="!percentFee"
                field-key="TRUEMONEY_FEE_SATANG"
              />
              <FeatureConfigField
                v-if="field('TRUEMONEY_FEE_PERCENT')"
                v-show="percentFee"
                field-key="TRUEMONEY_FEE_PERCENT"
              />
            </div>
          </FeatureSettingsCard>
          <FeatureSettingsCard
            v-if="hasAny(slipok)"
            :title="text('Slip verification · SlipOK', 'ตรวจสอบสลิป · SlipOK')"
            :icon="ShieldCheck"
            :description="
              text(
                'Credentials for checking PromptPay transfer slips.',
                'ข้อมูลเชื่อมต่อสำหรับตรวจสอบสลิปพร้อมเพย์',
              )
            "
          >
            <div class="grid gap-md tablet:grid-cols-2">
              <FeatureConfigField v-for="key in slipok" :key="key" :field-key="key" />
            </div>
          </FeatureSettingsCard>
        </template>
        <template v-else-if="category.key === 'discord'">
          <FeatureSettingsCard
            v-if="hasAny(channels)"
            :title="text('Slip submission & notifications', 'ส่งสลิปและแจ้งเตือน')"
            :icon="Hash"
            :description="
              text(
                'Choose the slip channel, temporary access role and audit channel.',
                'กำหนดห้องส่งสลิป ยศเข้าใช้งานชั่วคราว และห้องแจ้งเตือน',
              )
            "
          >
            <div class="space-y-md">
              <FeatureConfigField v-for="key in channels" :key="key" :field-key="key" />
            </div>
          </FeatureSettingsCard>
          <FeatureSettingsCard
            v-if="hasAny(roles)"
            :title="text('Wallet roles', 'ยศกระเป๋าเงิน')"
            :icon="ShieldCheck"
          >
            <div class="space-y-md">
              <FeatureConfigField v-for="key in roles" :key="key" :field-key="key" />
            </div>
          </FeatureSettingsCard>
        </template>
        <template v-else-if="category.key === 'rewards'">
          <FeatureSettingsCard
            v-if="hasAny(ranking)"
            :title="text('Top-up leaderboard', 'อันดับยอดเติมเงิน')"
            :icon="Trophy"
            :description="
              text(
                'Lifetime top-ups determine the rankings. Manual balance changes are excluded.',
                'จัดอันดับจากยอดเติมสำเร็จสะสม โดยไม่นับการปรับยอดเงินด้วยคำสั่ง',
              )
            "
          >
            <div class="space-y-md">
              <FeatureConfigField v-for="key in ranking" :key="key" :field-key="key" />
            </div>
          </FeatureSettingsCard>
          <FeatureSettingsCard
            v-if="field('TOP_SPENDER_MILESTONE_ROLES')"
            :title="text('Milestone roles', 'ยศตามยอดเติมสะสม')"
            :description="
              text(
                'Set the total top-up amount in baht and the role to grant.',
                'กำหนดยอดเติมสะสมเป็นบาทและยศที่จะมอบเมื่อถึงเกณฑ์',
              )
            "
            :icon="Trophy"
          >
            <WalletMilestonesEditor
              :model-value="String(values.TOP_SPENDER_MILESTONE_ROLES ?? '[]')"
              @update:model-value="values.TOP_SPENDER_MILESTONE_ROLES = $event"
            />
          </FeatureSettingsCard>
        </template>
        <template v-else-if="category.key === 'commands'">
          <FeatureCommandsSettings
            v-if="field('PANEL_COMMAND_NAME')"
            :model-value="panelName"
            default-name="wallet-panel"
            :required="field('PANEL_COMMAND_NAME')?.required"
            :commands="[]"
            :description="
              text(
                'Name the panel command. The other wallet command names are fixed.',
                'ตั้งชื่อคำสั่งส่งแผงเติมเงิน คำสั่งกระเป๋าเงินอื่นใช้ชื่อคงที่',
              )
            "
            :permission-note="
              text(
                'Wallet administration requires Administrator or the Wallet administrator role. Bot Permissions can add restrictions.',
                'คำสั่งจัดการกระเป๋าเงินต้องมี Administrator หรือยศผู้ดูแลกระเป๋าเงิน โดย Bot Permissions ใช้จำกัดสิทธิ์เพิ่มเติมได้',
              )
            "
            @update:model-value="values.PANEL_COMMAND_NAME = $event"
          >
            <h3 :id="id + '-commands'" class="mt-lg text-sm font-medium">
              {{ text('Available commands', 'คำสั่งที่ใช้งานได้') }}
            </h3>
            <FeatureCommandList
              class="mt-sm"
              :commands="commands.slice(0, 2)"
              :labelledby="id + '-commands'"
            />
            <details class="mt-lg border-t border-border-subtle pt-md">
              <summary class="cursor-pointer text-sm font-medium">
                {{ text('Wallet administrator commands', 'คำสั่งผู้ดูแลกระเป๋าเงิน') }}
              </summary>
              <FeatureCommandList class="mt-md" :commands="commands.slice(2)" />
              <p v-if="license?.version === '2.1.0'" class="mt-sm text-xs text-text-muted">
                {{
                  text(
                    'For add, remove and set, choose a member and enter the amount and reason in the modal.',
                    'สำหรับ add, remove และ set ให้เลือกสมาชิก แล้วกรอกจำนวนเงินและเหตุผลในหน้าต่างยืนยัน',
                  )
                }}
              </p>
            </details>
          </FeatureCommandsSettings>
          <FeatureSettingsCard
            v-if="field('WALLET_HISTORY_DEFAULT_LIMIT')"
            :title="text('Wallet history', 'ประวัติกระเป๋าเงิน')"
            ><FeatureConfigField field-key="WALLET_HISTORY_DEFAULT_LIMIT"
          /></FeatureSettingsCard>
        </template>
      </section>
      <template #summary>
        <FeatureSettingsCard
          as="aside"
          compact
          :title="text('Settings summary', 'สรุปการตั้งค่า')"
          :icon="Wallet"
        >
          <dl class="space-y-md text-sm" data-wallet-summary>
            <template v-if="activeCategory === 'payments'">
              <div v-if="field('MIN_TOPUP_SATANG')">
                <dt class="text-xs text-text-muted">
                  {{ text('PromptPay minimum', 'ยอดเติมขั้นต่ำผ่านพร้อมเพย์') }}
                </dt>
                <dd class="mt-xs font-medium">
                  {{ money(values.MIN_TOPUP_SATANG) }} {{ text('THB', 'บาท') }}
                </dd>
              </div>
              <div v-if="field('PROMPTPAY_QR_EXPIRY_MINUTES')">
                <dt class="text-xs text-text-muted">{{ text('QR lifetime', 'อายุ QR') }}</dt>
                <dd class="mt-xs">{{ qrMinutes }} {{ text('minutes', 'นาที') }}</dd>
              </div>
              <div v-if="hasAny(['TRUEMONEY_FEE_SATANG', 'TRUEMONEY_FEE_PERCENT'])">
                <dt class="text-xs text-text-muted">
                  {{ text('TrueMoney fee', 'ค่าธรรมเนียม TrueMoney') }}
                </dt>
                <dd class="mt-xs">{{ feePreview }}</dd>
              </div>
            </template>
            <template v-else-if="activeCategory === 'discord'">
              <div v-for="key in ['SLIP_CHANNEL_ID', 'TOPUP_NOTIFICATION_CHANNEL_ID']" :key="key">
                <dt class="text-xs text-text-muted">
                  {{
                    key === 'SLIP_CHANNEL_ID'
                      ? text('Slip channel', 'ห้องส่งสลิป')
                      : text('Notification channel', 'ห้องแจ้งเตือน')
                  }}
                </dt>
                <dd class="mt-xs break-all font-mono text-xs">
                  {{ values[key] || text('Not set', 'ยังไม่ได้ระบุ') }}
                </dd>
              </div>
              <div>
                <dt class="text-xs text-text-muted">
                  {{ text('Wallet access', 'ผู้ดูแลกระเป๋าเงิน') }}
                </dt>
                <dd class="mt-xs">
                  {{
                    values.WALLET_ADMIN_ROLE_ID
                      ? text('Administrator + configured role', 'Administrator และยศที่กำหนด')
                      : 'Administrator'
                  }}
                </dd>
              </div>
            </template>
            <template v-else-if="activeCategory === 'rewards'">
              <div>
                <dt class="text-xs text-text-muted">
                  {{ text('Milestones', 'เกณฑ์ยอดเติมสะสม') }}
                </dt>
                <dd class="mt-xs">{{ milestones }} {{ text('milestones', 'เกณฑ์') }}</dd>
              </div>
              <div>
                <dt class="text-xs text-text-muted">
                  {{ text('Ranking basis', 'ยอดที่ใช้จัดอันดับ') }}
                </dt>
                <dd class="mt-xs">
                  {{ text('Successful lifetime top-ups', 'ยอดเติมเงินสำเร็จสะสม') }}
                </dd>
              </div>
            </template>
            <template v-else
              ><div>
                <dt class="text-xs text-text-muted">
                  {{ text('Panel command', 'คำสั่งส่งแผงเติมเงิน') }}
                </dt>
                <dd class="mt-xs font-mono [overflow-wrap:anywhere]">
                  /{{ panelName || 'wallet-panel' }}
                </dd>
              </div></template
            >
          </dl>
          <p class="mt-lg border-t border-border-subtle pt-md text-xs text-text-muted">
            {{
              text(
                'Save all includes changes from every category.',
                'บันทึกทั้งหมดจะรวมการแก้ไขจากทุกหมวด',
              )
            }}
          </p>
        </FeatureSettingsCard>
      </template>
    </FeatureSettingsLayout>
  </div>
</template>
