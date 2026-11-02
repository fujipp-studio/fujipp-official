<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import AppButton from '@/shared/ui/buttons/AppButton.vue'
import FeatureConfigField from './FeatureConfigField.vue'
import FeatureSettingsCard from './FeatureSettingsCard.vue'
import { useFeatureEditor } from '../composables/featureEditorContext'
import { usePriceReaderGeminiTest } from '../composables/usePriceReaderGeminiTest'

const { text, secrets, values, license } = useFeatureEditor()
const test = usePriceReaderGeminiTest()
const busy = ref(false)
const message = ref('')
const failed = ref(false)
let controller: AbortController | undefined
function reset() {
  controller?.abort()
  message.value = ''
}
watch(
  [
    () => secrets.value.GEMINI_API_KEY,
    () => values.value.PRICE_READER_GEMINI_MODEL,
    () => license.value?.id,
  ],
  reset,
)
onBeforeUnmount(reset)
async function testConnection() {
  if (busy.value) return
  controller = new AbortController()
  const signal = controller.signal
  busy.value = true
  message.value = ''
  failed.value = false
  try {
    await test(signal)
    if (!signal.aborted)
      message.value = text(
        'Connected. The selected model returned a valid response.',
        'เชื่อมต่อสำเร็จ โมเดลที่เลือกตอบกลับได้ถูกต้อง',
      )
  } catch (error) {
    if (!signal.aborted) {
      failed.value = true
      message.value =
        error instanceof Error
          ? error.message
          : text('Unable to test Gemini.', 'ทดสอบ Gemini ไม่สำเร็จ')
    }
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <FeatureSettingsCard
    :title="text('Gemini AI', 'Gemini AI')"
    :description="
      text('Use your own Google AI Studio API key.', 'ใช้ API key ของคุณจาก Google AI Studio')
    "
  >
    <div class="space-y-lg" data-price-reader-gemini>
      <FeatureConfigField
        field-key="GEMINI_API_KEY"
        :format-error="text('Check the API key format.', 'ตรวจสอบรูปแบบ API key')"
      />
      <FeatureConfigField field-key="PRICE_READER_GEMINI_MODEL" />
      <a
        href="https://aistudio.google.com/apikey"
        target="_blank"
        rel="noopener noreferrer"
        class="inline-block text-sm text-text-secondary underline"
      >
        {{ text('Create an API key in Google AI Studio', 'สร้าง API key ใน Google AI Studio') }}
      </a>
      <p class="text-sm text-text-secondary">
        {{
          text(
            'Images are sent to Google Gemini. With Free Tier, Google may use inputs and responses to improve its products. Use product screenshots without personal or confidential information.',
            'รูปจะถูกส่งไป Google Gemini บริการ Free Tier อาจใช้ข้อมูลและผลลัพธ์เพื่อปรับปรุงผลิตภัณฑ์ ใช้รูปสินค้าที่ไม่มีข้อมูลส่วนบุคคลหรือข้อมูลลับ',
          )
        }}
      </p>
      <p class="text-xs text-text-muted">
        {{
          text(
            'Quota and any charges belong to your Google project. Free availability varies by model and project. Testing uses your quota, including unsaved keys, and does not save settings.',
            'โควตาและค่าใช้จ่ายเป็นของโปรเจกต์ Google ของคุณ การใช้ฟรีขึ้นกับโมเดลและโปรเจกต์ การทดสอบใช้โควตาของ key ที่กรอกหรือ key ที่บันทึกไว้ และไม่บันทึกการตั้งค่า',
          )
        }}
      </p>
      <AppButton type="button" class="!w-auto" :disabled="busy" @click="testConnection">
        {{ busy ? text('Testing…', 'กำลังทดสอบ…') : text('Test connection', 'ทดสอบการเชื่อมต่อ') }}
      </AppButton>
      <p
        v-if="message"
        :role="failed ? 'alert' : 'status'"
        class="text-sm"
        :class="failed ? 'text-error-text' : 'text-text-secondary'"
      >
        {{ message }}
      </p>
    </div>
  </FeatureSettingsCard>
</template>
