<script setup lang="ts">
import { computed, defineAsyncComponent, onBeforeUnmount, ref, watch } from 'vue'
import { FlaskConical } from 'lucide-vue-next'
import AppButton from '@/shared/ui/buttons/AppButton.vue'
import AppFileField from '@/shared/ui/fields/AppFileField.vue'
import AppTextField from '@/shared/ui/fields/AppTextField.vue'
import FeatureSettingsCard from './FeatureSettingsCard.vue'
import PriceReaderPreview from './PriceReaderPreview.vue'
import { useFeatureEditor } from '../composables/featureEditorContext'
import { priceReaderRuntimeConfig } from '../config/price-reader-base'
import { buildResultValues } from '@price-reader/result-presentation'
import { usePriceReaderGeminiTest } from '../composables/usePriceReaderGeminiTest'

const { text, values, license, previewBot, secrets, priceReaderHelpers } = useFeatureEditor()
const gemini = computed(() => license.value?.version.startsWith('3.'))
const classified = computed(() => Boolean(values.value.PRICE_READER_PRICING_MODE))
const selectedCount = ref('')
const PriceReaderCountConfirmation = defineAsyncComponent(
  () => import('./PriceReaderCountConfirmation.vue'),
)
const readResult = (data: unknown) =>
  priceReaderHelpers.value?.readPriceReaderResult(
    data,
    config.value,
    selectedCount.value ? Number(selectedCount.value) : undefined,
  )
const testGemini = usePriceReaderGeminiTest()
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
    : gemini.value
      ? readResult(JSON.parse(rawText.value))
      : priceReaderHelpers.value?.readPriceReaderOcrResult?.(
          rawText.value,
          config.value,
          license.value?.version ?? '2.0.0',
        ),
)
const samples = computed<Record<string, string>>(() => {
  if (result.value)
    return (priceReaderHelpers.value?.priceReaderBuildResultValues ?? buildResultValues)(
      [result.value],
      config.value,
      license.value?.version ?? '',
      previewBot.value?.discordGuildId,
    )
  return (
    priceReaderHelpers.value?.priceReaderSampleValues(
      values.value,
      license.value?.version ?? '',
      previewBot.value?.discordGuildId,
      scenario.value,
    ) ?? {}
  )
})
let controller: AbortController | undefined
function cancel() {
  controller?.abort()
}
watch(
  [
    file,
    () => license.value?.id,
    () => values.value.PRICE_READER_GEMINI_MODEL,
    () => secrets.value.GEMINI_API_KEY,
  ],
  () => {
    cancel()
    rawText.value = null
    selectedCount.value = ''
    error.value = ''
  },
)
onBeforeUnmount(cancel)
async function testImage() {
  if (!file.value || busy.value) return
  controller = new AbortController()
  const signal = controller.signal
  busy.value = true
  error.value = ''
  progress.value = 0
  rawText.value = null
  selectedCount.value = ''
  try {
    if (gemini.value) {
      const result = await testGemini(signal, file.value)
      if (!signal.aborted && result) {
        readResult(result)
        rawText.value = JSON.stringify(result, null, 2)
      }
    } else {
      const { recognizePriceReaderImage } = await import('../models/price-reader-ocr')
      const result = await recognizePriceReaderImage(file.value, signal, (value) => {
        progress.value = value
      })
      if (!signal.aborted) rawText.value = result
    }
  } catch (cause) {
    if (!signal.aborted)
      error.value =
        gemini.value && cause instanceof Error
          ? cause.message
          : text(
              'Read failed. Check the file and connection, then retry.',
              'อ่านไม่สำเร็จ ตรวจไฟล์และการเชื่อมต่อ แล้วลองอีกครั้ง',
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
          'Uses your draft without saving or posting to Discord.',
          'ใช้ค่าที่แก้ไข โดยไม่บันทึกหรือส่งเข้า Discord',
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
            gemini
              ? text(
                  'Sends the image to Google Gemini using your key and quota. The bot may resize it.',
                  'ส่งรูปไป Google Gemini ด้วย key และโควตาของคุณ บอทอาจย่อรูปก่อนอ่าน',
                )
              : text(
                  'OCR runs locally, downloading languages on first use. Image preparation differs from the bot; matching and message rules are shared.',
                  'OCR อ่านในเบราว์เซอร์และโหลดภาษาครั้งแรก เตรียมรูปต่างจากบอท แต่ใช้กฎจับคู่ราคาและข้อความเดียวกัน',
                )
          }}
        </p>
      </div>
    </FeatureSettingsCard>
    <PriceReaderCountConfirmation
      v-if="result?.pending_read || selectedCount"
      v-model="selectedCount"
      :raw-text="rawText || '{}'"
    />
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
        <div v-if="classified">
          <dt class="text-text-muted">
            {{ text('Product type / pricing mode', 'ประเภทสินค้า / โหมดราคา') }}
          </dt>
          <dd>{{ result.item_type }} · {{ result.pricing_mode }}</dd>
        </div>
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
