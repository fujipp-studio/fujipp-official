<script setup lang="ts">
import { computed, ref, useId } from 'vue'
import AppTextField from '@/shared/ui/fields/AppTextField.vue'
import AppButton from '@/shared/ui/buttons/AppButton.vue'
import FeatureSettingsCard from './FeatureSettingsCard.vue'
import { useFeatureEditor } from '../composables/featureEditorContext'
import {
  plainWalletQr,
  readWalletQrWatermark,
  walletQrWatermarkValid,
  type WalletQrWatermark,
} from '../models/wallet-qr-watermark'
import { prepareWalletQrLogo } from '../models/wallet-qr-logo'

const { values, previewBot, text } = useFeatureEditor()
const id = useId(),
  uploading = ref(false),
  error = ref('')
const raw = computed(() => values.value.PROMPTPAY_QR_WATERMARK)
const current = computed(() => readWalletQrWatermark(raw.value) ?? plainWalletQr)
const valid = computed(() => walletQrWatermarkValid(raw.value))
const shopName = computed(
  () =>
    previewBot.value?.discordUsername || previewBot.value?.name || text('Shop name', 'ชื่อร้าน'),
)
const modes = computed(() => [
  { value: 'NONE', label: text('No watermark', 'ไม่ใส่ลายน้ำ') },
  { value: 'TEXT', label: text('Shop name / text', 'ชื่อร้าน / ข้อความ') },
  { value: 'LOGO', label: text('Uploaded logo', 'โลโก้ที่อัปโหลด') },
])
function update(patch: Partial<WalletQrWatermark>) {
  values.value.PROMPTPAY_QR_WATERMARK = JSON.stringify({ ...current.value, ...patch })
  error.value = ''
}
async function upload(event: Event) {
  const input = event.target as HTMLInputElement,
    file = input.files?.[0]
  if (!file) return
  uploading.value = true
  update({ logoDataUri: '', mode: 'LOGO' })
  try {
    update({ logoDataUri: await prepareWalletQrLogo(file), mode: 'LOGO' })
  } catch {
    error.value = text(
      'Choose a readable PNG, JPEG or WebP up to 2 MB (16 megapixels).',
      'เลือกรูป PNG, JPEG หรือ WebP ที่อ่านได้ ขนาดไม่เกิน 2 MB และ 16 ล้านพิกเซล',
    )
  } finally {
    uploading.value = false
    input.value = ''
  }
}
</script>

<template>
  <FeatureSettingsCard
    :title="text('QR watermark (optional)', 'ลายน้ำ QR (ไม่บังคับ)')"
    data-wallet-qr-watermark
  >
    <div class="space-y-lg">
      <p class="text-sm text-text-secondary">
        {{
          text(
            'Generate the payment QR on our server. Branding is placed below the code so its payment data and white border stay intact.',
            'สร้าง QR ชำระเงินบนเซิร์ฟเวอร์ของเรา ลายน้ำจะอยู่ใต้โค้ด โดยคงข้อมูลชำระเงินและขอบขาวรอบ QR ไว้ครบ',
          )
        }}
      </p>
      <AppTextField
        :model-value="current.mode"
        variant="dropdown"
        :label="text('Watermark type', 'รูปแบบลายน้ำ')"
        :options="modes"
        @update:model-value="update({ mode: $event as WalletQrWatermark['mode'] })"
      />
      <AppTextField
        v-if="current.mode === 'TEXT'"
        :model-value="current.text"
        :label="text('Watermark text', 'ข้อความลายน้ำ')"
        :placeholder="shopName"
        :maxlength="60"
        :support-text="
          text(
            'Optional. Leave blank to use this bot’s name. Up to 60 characters.',
            'ไม่บังคับ เว้นว่างเพื่อใช้ชื่อบอทนี้ สูงสุด 60 ตัวอักษร',
          )
        "
        @update:model-value="update({ text: $event })"
      />
      <div v-if="current.mode === 'LOGO'" class="space-y-sm">
        <label :for="id + '-logo'" class="block text-sm font-medium">{{
          text('Upload watermark logo', 'อัปโหลดโลโก้ลายน้ำ')
        }}</label>
        <input
          :id="id + '-logo'"
          type="file"
          accept="image/png,image/jpeg,image/webp"
          :disabled="uploading"
          class="field-control min-w-0 max-w-full py-sm"
          @change="upload"
        />
        <p class="text-xs text-text-secondary">
          {{
            text(
              'PNG, JPEG or WebP up to 2 MB. The logo is resized and saved with these settings.',
              'PNG, JPEG หรือ WebP ไม่เกิน 2 MB ระบบย่อรูปและบันทึกพร้อมค่าตั้งค่านี้',
            )
          }}
        </p>
        <p v-if="uploading" role="status" class="text-sm text-text-secondary">
          {{ text('Preparing logo…', 'กำลังเตรียมโลโก้…') }}
        </p>
        <AppButton
          v-if="current.logoDataUri"
          variant="secondary"
          @click="update({ logoDataUri: '', mode: 'NONE' })"
          >{{ text('Remove logo', 'ลบโลโก้') }}</AppButton
        >
      </div>
      <p v-if="error || !valid" role="status" class="text-sm text-error-text">
        {{
          error ||
          text(
            'Enter a single line of up to 60 characters, or upload a valid logo.',
            'กรอกข้อความหนึ่งบรรทัดไม่เกิน 60 ตัวอักษร หรืออัปโหลดโลโก้ที่ถูกต้อง',
          )
        }}
      </p>
      <figure
        class="w-full max-w-80 overflow-hidden rounded-lg border border-border-default bg-(--semantic-color-qr-paper) text-(--semantic-color-qr-ink)"
        data-watermark-preview
      >
        <img
          src="/images/preview/promptpay-qr.svg"
          :alt="text('Example QR, not for payment', 'QR ตัวอย่าง ไม่ใช้ชำระเงินจริง')"
          class="block w-full"
        />
        <figcaption
          v-if="current.mode === 'TEXT'"
          class="flex min-h-16 items-center justify-center px-md py-sm text-center text-sm break-words"
        >
          {{ current.text.trim() || shopName }}
        </figcaption>
        <div
          v-else-if="current.mode === 'LOGO' && current.logoDataUri"
          class="flex min-h-16 items-center justify-center p-sm"
        >
          <img
            :src="current.logoDataUri"
            :alt="text('Watermark logo', 'โลโก้ลายน้ำ')"
            class="max-h-10 max-w-40 object-contain"
          />
        </div>
      </figure>
      <p class="text-xs text-text-muted">
        {{
          text(
            'Example placement. Changes apply to newly created payment QR codes after saving.',
            'ตัวอย่างตำแหน่งลายน้ำ การเปลี่ยนแปลงมีผลกับ QR ชำระเงินที่สร้างใหม่หลังบันทึก',
          )
        }}
      </p>
    </div>
  </FeatureSettingsCard>
</template>
