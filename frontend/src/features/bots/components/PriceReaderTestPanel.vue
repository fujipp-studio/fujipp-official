<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { FlaskConical } from 'lucide-vue-next'
import AppButton from '@/shared/ui/buttons/AppButton.vue'
import AppFileField from '@/shared/ui/fields/AppFileField.vue'
import AppTextField from '@/shared/ui/fields/AppTextField.vue'
import FeatureSettingsCard from './FeatureSettingsCard.vue'
import PriceReaderPreview from './PriceReaderPreview.vue'
import { useFeatureEditor } from '../composables/featureEditorContext'
import { priceReaderRuntimeConfig, priceReaderSampleValues } from '../config/price-reader'
import { recognizePriceReaderImage } from '../models/price-reader-ocr'
import { buildResultValues, readImageResult } from '@price-reader/results'

const { text, values, license, previewBot } = useFeatureEditor()
const file = ref<File | null>(null)
const rawText = ref<string | null>(null)
const busy = ref(false)
const progress = ref(0)
const error = ref('')
const scenario = ref<'success' | 'mixed' | 'error' | 'ocr_error' | 'unmatched'>('success')
const options = computed(() => [
  { value: 'success', label: text('All images read', 'อ่านสำเร็จทุกรูป') },
  { value: 'mixed', label: text('Some images failed', 'บางรูปอ่านไม่สำเร็จ') },
  { value: 'error', label: text('No price detected', 'อ่านไม่พบราคาทุกรูป') },
  { value: 'ocr_error', label: text('Image processing failed', 'ประมวลผลรูปผิดพลาด') },
  { value: 'unmatched', label: text('No price map match', 'อ่านได้แต่ไม่มีคู่ราคา') },
])
const config = computed(() => priceReaderRuntimeConfig(values.value))
const result = computed(() =>
  rawText.value === null
    ? null
    : readImageResult(rawText.value, config.value, license.value?.version ?? '2.0.0'),
)
const samples = computed(() =>
  result.value
    ? buildResultValues(
        [result.value],
        config.value,
        license.value?.version ?? '',
        previewBot.value?.discordGuildId,
      )
    : priceReaderSampleValues(
        values.value,
        license.value?.version ?? '',
        previewBot.value?.discordGuildId,
        scenario.value,
      ),
)
let controller: AbortController | undefined
function cancel() {
  controller?.abort()
}
watch(file, () => {
  cancel()
  rawText.value = null
  error.value = ''
})
onBeforeUnmount(cancel)
async function testImage() {
  if (!file.value || busy.value) return
  controller = new AbortController()
  const signal = controller.signal
  busy.value = true
  error.value = ''
  progress.value = 0
  rawText.value = null
  try {
    rawText.value = await recognizePriceReaderImage(file.value, signal, (value) => {
      progress.value = value
    })
  } catch (cause) {
    if (!signal.aborted)
      error.value = text(
        'Unable to read this image. Choose a PNG, JPEG or WebP up to 10 MB and check your connection, then try again.',
        'อ่านรูปไม่สำเร็จ เลือก PNG, JPEG หรือ WebP ไม่เกิน 10 MB ตรวจสอบการเชื่อมต่อ แล้วลองอีกครั้ง',
      )
    if (cause instanceof Error && cause.name === 'AbortError') return
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="space-y-lg" data-price-reader-test>
    <FeatureSettingsCard
      :icon="FlaskConical"
      :title="text('Test before saving', 'ทดสอบก่อนบันทึก')"
      :description="
        text(
          'Uses your current draft. No settings are saved and no messages are sent to Discord.',
          'ใช้ค่าที่กำลังแก้ไข โดยไม่บันทึกค่าและไม่ส่งข้อความเข้า Discord',
        )
      "
    >
      <div class="space-y-lg">
        <AppFileField
          v-model="file"
          :label="text('Discord Shop screenshot', 'รูป Discord Shop สำหรับทดสอบ')"
          accept="image/png,image/jpeg,image/webp"
          :disabled="busy"
          :placeholder="text('Choose an image', 'เลือกรูปภาพ')"
          :support-text="text('PNG, JPEG, WebP · up to 10 MB', 'PNG, JPEG, WebP · ไม่เกิน 10 MB')"
        />
        <div class="flex flex-wrap gap-sm">
          <AppButton class="!w-auto" :disabled="!file || busy" @click="testImage">{{
            text('Read test image', 'อ่านรูปทดสอบ')
          }}</AppButton>
          <AppButton v-if="busy" variant="secondary" class="!w-auto" @click="cancel">{{
            text('Cancel', 'ยกเลิก')
          }}</AppButton>
          <AppButton
            v-if="rawText !== null"
            variant="secondary"
            class="!w-auto"
            @click="rawText = null"
            >{{ text('Show examples', 'ดูตัวอย่างสถานะ') }}</AppButton
          >
        </div>
        <p v-if="busy" role="status" class="text-sm text-text-secondary">
          {{
            progress
              ? text(`Reading ${progress}%`, `กำลังอ่าน ${progress}%`)
              : text('Preparing the reader…', 'กำลังเตรียมตัวอ่านรูป…')
          }}
        </p>
        <p v-if="error" role="alert" class="text-sm text-error-text">{{ error }}</p>
        <p class="text-xs text-text-muted">
          {{
            text(
              'Images stay in this browser. The first run downloads OCR language files. Image preprocessing differs from the bot, so OCR results may differ; price matching and message rules are shared.',
              'รูปประมวลผลในเบราว์เซอร์ ครั้งแรกจะดาวน์โหลดไฟล์ภาษา OCR การเตรียมรูปต่างจากบอทจึงอาจอ่านได้ต่างกัน แต่ใช้กฎจับคู่ราคาและสร้างข้อความชุดเดียวกัน',
            )
          }}
        </p>
      </div>
    </FeatureSettingsCard>
    <FeatureSettingsCard :title="text('Message preview', 'ตัวอย่างข้อความ')" compact>
      <AppTextField
        v-if="rawText === null"
        v-model="scenario"
        :label="text('Example scenario', 'สถานะตัวอย่าง')"
        variant="dropdown"
        :options="options"
      />
      <dl
        v-if="result?.status === 'success'"
        class="my-md grid gap-md tablet:grid-cols-3 text-sm"
        data-price-test-match
      >
        <div>
          <dt class="text-text-muted">{{ text('Detected price', 'ราคาที่อ่านได้') }}</dt>
          <dd>{{ result.discord_price }} {{ text('THB', 'บาท') }}</dd>
        </div>
        <div>
          <dt class="text-text-muted">
            {{ text('Matched Discord price', 'ราคา Discord ที่จับคู่') }}
          </dt>
          <dd>{{ result.matched_discord_price || '—' }}</dd>
        </div>
        <div>
          <dt class="text-text-muted">{{ text('Shop price', 'ราคาร้าน') }}</dt>
          <dd>{{ result.shop_price_text }}</dd>
        </div>
      </dl>
      <div class="mt-lg min-w-0"><PriceReaderPreview :samples="samples" /></div>
      <details v-if="rawText !== null" class="mt-lg border-t border-border-subtle pt-md">
        <summary class="cursor-pointer text-sm font-medium">
          {{ text('Recognized text', 'ข้อความที่อ่านได้จากรูป') }}
        </summary>
        <pre class="mt-sm whitespace-pre-wrap break-words text-xs text-text-secondary">{{
          rawText || text('(No text found)', '(ไม่พบข้อความ)')
        }}</pre>
      </details>
    </FeatureSettingsCard>
  </div>
</template>
