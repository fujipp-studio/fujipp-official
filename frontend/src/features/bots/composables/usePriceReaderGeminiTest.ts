import { useRoute } from 'vue-router'
import { useAuthStore } from '@/stores'
import { useFeatureEditor } from './featureEditorContext'
import { testPriceReaderGemini } from '../price-reader-api'
import { defaultGeminiModel, geminiErrorMessages } from '@price-reader/gemini-contract'

export function usePriceReaderGeminiTest() {
  const { text, license, secrets, values } = useFeatureEditor()
  const auth = useAuthStore()
  const route = useRoute()
  return async (signal: AbortSignal, file?: File) => {
    if (!auth.session || !license.value)
      throw new Error(text('Sign in to test Gemini.', 'เข้าสู่ระบบเพื่อทดสอบ Gemini'))
    let imageBase64: string | undefined
    if (file) {
      if (
        !['image/png', 'image/jpeg', 'image/webp'].includes(file.type) ||
        !file.size ||
        file.size > 10 * 1024 * 1024
      )
        throw new Error(text(...geminiErrorMessages.GEMINI_IMAGE_INVALID!))
      imageBase64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        const abort = () => reader.abort()
        const cleanup = () => signal.removeEventListener('abort', abort)
        reader.onload = () => {
          cleanup()
          resolve(String(reader.result).split(',')[1] ?? '')
        }
        reader.onerror = () => {
          cleanup()
          reject(new Error(text('Unable to read this file.', 'อ่านไฟล์ไม่สำเร็จ')))
        }
        reader.onabort = () => {
          cleanup()
          reject(new DOMException('Cancelled', 'AbortError'))
        }
        if (signal.aborted) {
          reject(new DOMException('Cancelled', 'AbortError'))
          return
        }
        signal.addEventListener('abort', abort, { once: true })
        reader.readAsDataURL(file)
      })
    }
    if (signal.aborted) throw new DOMException('Cancelled', 'AbortError')
    const result = await testPriceReaderGemini(
      license.value.id,
      {
        apiKey: String(secrets.value.GEMINI_API_KEY ?? '').trim() || undefined,
        model: String(values.value.PRICE_READER_GEMINI_MODEL ?? defaultGeminiModel),
        ...(file ? { imageBase64, mimeType: file.type } : {}),
      },
      auth.session,
      signal,
      route.path.startsWith('/admin/bots/') ? String(route.params.botId) : undefined,
    )
    if (!result.connected)
      throw new Error(
        text(
          ...(geminiErrorMessages[result.errorCode ?? ''] ??
            geminiErrorMessages.GEMINI_UNAVAILABLE!),
        ),
      )
    return result.result
  }
}
