<script setup lang="ts">
import { computed, ref, useId, watch } from 'vue'
import { CreditCard, MessageSquareText, Wallet } from 'lucide-vue-next'
import AppTextField from '@/shared/ui/fields/AppTextField.vue'
import FeatureSettingsCategories from './FeatureSettingsCategories.vue'
import FeatureSettingsLayout from './FeatureSettingsLayout.vue'
import FeatureSettingsCard from './FeatureSettingsCard.vue'
import FeatureConfigField from './FeatureConfigField.vue'
import { paymentTriggerSampleValues } from '../config/payment-trigger'
import { useFeatureEditor } from '../composables/featureEditorContext'

const { text, configuration, values } = useFeatureEditor()
const id = useId()
const activeCategory = ref('trigger')
const field = (key: string) => configuration.value?.fields.find((item) => item.key === key)
const value = (key: string) => String(values.value[key] ?? '')
const categories = computed(() =>
  [
    {
      key: 'trigger',
      label: text('Trigger', 'Trigger'),
      icon: MessageSquareText,
      show: Boolean(field('PAYMENT_TRIGGER_PREFIX')),
    },
    {
      key: 'bank',
      label: text('Bank QR', 'QR ธนาคาร'),
      icon: CreditCard,
      show: Boolean(field('BANK_QR_IMAGE_URL')),
    },
    {
      key: 'wallet',
      label: 'Wallet',
      icon: Wallet,
      show: ['WALLET_NUMBER', 'WALLET_FEE_SATANG'].some((key) => field(key)),
    },
  ].filter((category) => category.show),
)
watch(
  categories,
  (list) => {
    if (!list.some((category) => category.key === activeCategory.value))
      activeCategory.value = list[0]?.key ?? ''
  },
  { immediate: true },
)
const prefixError = computed(() =>
  !/^[a-zA-Z]{1,10}$/.test(value('PAYMENT_TRIGGER_PREFIX'))
    ? text(
        'Use 1–10 English letters without spaces.',
        'ใช้ตัวอักษร a–z หรือ A–Z จำนวน 1–10 ตัว โดยไม่เว้นวรรค',
      )
    : '',
)
const walletError = computed(() =>
  !/^[0-9]{10}$/.test(value('WALLET_NUMBER'))
    ? text('Enter a 10-digit Wallet number.', 'กรอกหมายเลข Wallet เป็นตัวเลข 10 หลัก')
    : '',
)
const qrError = computed(() => {
  try {
    const url = new URL(value('BANK_QR_IMAGE_URL'))
    if (
      /^https:\/\/.+/.test(value('BANK_QR_IMAGE_URL')) &&
      url.protocol === 'https:' &&
      url.hostname
    )
      return ''
  } catch {
    /* An incomplete URL remains editable. */
  }
  return text('Enter an HTTPS image URL.', 'กรอก URL รูปภาพที่ขึ้นต้นด้วย https://')
})
const sample = computed(() => paymentTriggerSampleValues(values.value))
const feeValid = computed(
  () =>
    value('WALLET_FEE_SATANG') !== '' &&
    Number.isSafeInteger(Number(values.value.WALLET_FEE_SATANG)) &&
    Number(values.value.WALLET_FEE_SATANG) >= 0 &&
    Number(values.value.WALLET_FEE_SATANG) <= 100000,
)
</script>

<template>
  <div class="space-y-lg" data-payment-trigger-config>
    <FeatureSettingsCategories
      v-model="activeCategory"
      :id-prefix="id"
      :label="text('Settings category', 'หมวดการตั้งค่า')"
      :categories="categories"
    />
    <FeatureSettingsLayout>
      <section
        v-for="category in categories"
        v-show="activeCategory === category.key"
        :id="id + '-panel-' + category.key"
        :key="category.key"
        role="tabpanel"
        :aria-labelledby="id + '-tab-' + category.key"
        class="min-w-0"
      >
        <FeatureSettingsCard
          v-if="category.key === 'trigger'"
          :title="text('Payment trigger', 'ข้อความเรียกหน้าชำระเงิน')"
          :icon="MessageSquareText"
          :description="
            text(
              'An administrator types the prefix followed by an amount to post payment options.',
              'แอดมินพิมพ์คำนำหน้าตามด้วยยอดเงิน เพื่อแสดงช่องทางชำระเงิน',
            )
          "
        >
          <AppTextField
            :model-value="value('PAYMENT_TRIGGER_PREFIX')"
            :label="text('Trigger prefix', 'คำนำหน้า Trigger')"
            placeholder="p"
            :maxlength="10"
            pattern="[a-zA-Z]{1,10}"
            :required="field('PAYMENT_TRIGGER_PREFIX')?.required"
            :state="prefixError ? 'error' : 'default'"
            :support-text="
              prefixError || text('Matching ignores letter case.', 'ไม่สนตัวพิมพ์เล็ก–ใหญ่')
            "
            @update:model-value="values.PAYMENT_TRIGGER_PREFIX = $event"
          />
          <div class="mt-lg border-t border-border-subtle pt-md">
            <h3 class="text-sm font-medium">{{ text('How to use', 'วิธีใช้งาน') }}</h3>
            <p class="mt-sm text-sm text-text-secondary">
              {{
                text(
                  'Only members with Administrator permission can start a payment. The bot attempts to delete the trigger before posting payment options.',
                  'ผู้ส่งต้องมีสิทธิ์ Administrator บอทจะพยายามลบข้อความ Trigger ก่อนส่งตัวเลือกชำระเงิน',
                )
              }}
            </p>
            <p class="mt-sm text-xs text-text-muted">
              {{
                text(
                  'Enter an amount directly after the prefix: greater than 0, up to 1,000,000 THB, with at most 2 decimal places.',
                  'ใส่ยอดเงินติดกับคำนำหน้า ยอดต้องมากกว่า 0 และไม่เกิน 1,000,000 บาท รองรับทศนิยมไม่เกิน 2 ตำแหน่ง',
                )
              }}
            </p>
          </div>
        </FeatureSettingsCard>
        <FeatureSettingsCard
          v-else-if="category.key === 'bank'"
          :title="text('Bank QR payment', 'ชำระผ่าน QR ธนาคาร')"
          :icon="CreditCard"
          :description="
            text(
              'Use your bank QR image for the original payment amount.',
              'ใช้รูป QR ของธนาคารและแสดงยอดชำระตั้งต้น',
            )
          "
        >
          <AppTextField
            :model-value="value('BANK_QR_IMAGE_URL')"
            input-type="url"
            :label="text('Bank QR image URL', 'URL รูป QR ธนาคาร')"
            placeholder="https://example.com/payment-qr.png"
            :maxlength="2000"
            :required="field('BANK_QR_IMAGE_URL')?.required"
            :state="qrError ? 'error' : 'default'"
            :support-text="
              qrError ||
              text(
                'Use an HTTPS image URL accessible to the recipient.',
                'ใช้ลิงก์รูป HTTPS ที่ผู้รับเปิดดูได้',
              )
            "
            @update:model-value="values.BANK_QR_IMAGE_URL = $event"
          />
        </FeatureSettingsCard>
        <FeatureSettingsCard
          v-else-if="category.key === 'wallet'"
          :title="text('Wallet payment', 'ชำระผ่าน Wallet')"
          :icon="Wallet"
          :description="
            text(
              'Receiving number and a fixed fee added to the original amount.',
              'หมายเลขรับเงินและค่าธรรมเนียมคงที่ที่บวกจากยอดตั้งต้น',
            )
          "
        >
          <div class="space-y-md">
            <AppTextField
              v-if="field('WALLET_NUMBER')"
              :model-value="value('WALLET_NUMBER')"
              input-type="tel"
              :label="text('Wallet number', 'หมายเลข Wallet')"
              placeholder="0812345678"
              :maxlength="10"
              pattern="[0-9]{10}"
              :required="field('WALLET_NUMBER')?.required"
              :state="walletError ? 'error' : 'default'"
              :support-text="
                walletError ||
                text('Payment is sent to this number.', 'หมายเลขที่ลูกค้าต้องโอนเงินไป')
              "
              @update:model-value="values.WALLET_NUMBER = $event"
            />
            <FeatureConfigField
              field-key="WALLET_FEE_SATANG"
              :label="text('Wallet fee', 'ค่าธรรมเนียม Wallet')"
            />
          </div>
        </FeatureSettingsCard>
      </section>
      <template #summary>
        <FeatureSettingsCard
          as="aside"
          :title="text('Payment example', 'ตัวอย่างการชำระเงิน')"
          compact
        >
          <p class="text-xs text-text-muted">
            {{ text('Sample amount: 10 THB', 'ตัวอย่างยอดตั้งต้น 10 บาท') }}
          </p>
          <code
            class="mt-sm block rounded-lg border border-border-subtle bg-bg-default p-md text-sm font-medium [overflow-wrap:anywhere]"
            data-payment-trigger-example
            >{{ prefixError ? '—' : sample.trigger + '10' }}</code
          >
          <dl class="mt-lg space-y-sm text-sm" data-payment-amount-preview>
            <div class="flex justify-between gap-sm">
              <dt class="text-text-secondary">{{ text('Bank QR', 'QR ธนาคาร') }}</dt>
              <dd>10 {{ text('THB', 'บาท') }}</dd>
            </div>
            <div v-if="field('WALLET_FEE_SATANG')" class="flex justify-between gap-sm">
              <dt class="text-text-secondary">{{ text('Wallet fee', 'ค่าธรรมเนียม Wallet') }}</dt>
              <dd>{{ feeValid ? sample.fee_amount : '—' }} {{ text('THB', 'บาท') }}</dd>
            </div>
            <div class="flex justify-between gap-sm border-t border-border-subtle pt-sm">
              <dt class="font-medium">{{ text('Wallet total', 'ยอดรวม Wallet') }}</dt>
              <dd class="font-semibold">
                {{ feeValid ? sample.total_amount : '—' }} {{ text('THB', 'บาท') }}
              </dd>
            </div>
          </dl>
          <p class="mt-lg border-t border-border-subtle pt-md text-xs text-text-muted">
            {{
              text(
                'Preview uses sample data. Save all includes changes from every category.',
                'ตัวอย่างใช้ข้อมูลสมมติ บันทึกทั้งหมดจะรวมการแก้ไขจากทุกหมวด',
              )
            }}
          </p>
          <details class="mt-lg border-t border-border-subtle pt-md">
            <summary class="cursor-pointer text-sm font-medium">
              {{ text('Bot permissions', 'สิทธิ์ของบอท') }}
            </summary>
            <p class="mt-sm text-xs text-text-secondary">
              {{
                text(
                  'Enable Message Content Intent in the Developer Portal. Allow View Channel and Send Messages; Manage Messages lets the bot delete triggers. Embed messages also need Embed Links.',
                  'เปิด Message Content Intent ใน Developer Portal ให้สิทธิ์ View Channel และ Send Messages ส่วน Manage Messages ใช้ลบ Trigger และข้อความ Embed ต้องมี Embed Links ด้วย',
                )
              }}
            </p>
          </details>
        </FeatureSettingsCard>
      </template>
    </FeatureSettingsLayout>
  </div>
</template>
