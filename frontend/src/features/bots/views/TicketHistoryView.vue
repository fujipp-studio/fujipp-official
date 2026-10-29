<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { MessageSquare, RefreshCw, Ticket } from 'lucide-vue-next'
import { AppButton, AppTextField } from '@/shared/ui'
import { useAuthStore } from '@/stores'
import AppRequestError from '@/shared/ui/feedback/AppRequestError.vue'
import {
  fetchTickets,
  fetchTicketMessages,
  safeTicketAttachmentUrl,
  type TicketHistoryItem,
  type TicketMessage,
} from '../ticket-api'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const { session } = storeToRefs(auth)
const { locale } = useI18n()
const text = (en: string, th: string) => (locale.value === 'th' ? th : en)
const botId = computed(() => String(route.params.botId ?? ''))
const admin = computed(() => route.path.startsWith('/admin/'))
const tickets = ref<TicketHistoryItem[]>([])
const messages = ref<TicketMessage[]>([])
const loading = ref(false)
const reading = ref(false)
const olderLoading = ref(false)
const error = ref('')
const messageError = ref('')
const search = ref('')
const filter = ref('ALL')
const nextBefore = ref<string | null>(null)
const selectedId = computed(() => String(route.query.ticket ?? ''))
const selected = computed(() => tickets.value.find((item) => item.channelId === selectedId.value))
const filtered = computed(() =>
  tickets.value.filter(
    (item) =>
      (filter.value === 'ALL' || item.status === filter.value) &&
      `${item.name} ${item.ownerId} ${item.categoryKey}`
        .toLocaleLowerCase()
        .includes(search.value.toLocaleLowerCase()),
  ),
)
let listRequest: AbortController | undefined
let messageRequest: AbortController | undefined
let version = 0
function status(value: string) {
  return value === 'CLOSED'
    ? text('Closed', 'ปิดแล้ว')
    : value === 'CLOSING'
      ? text('Closing', 'กำลังปิด')
      : text('Open', 'เปิดอยู่')
}
function date(value: number | string) {
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime())
    ? '—'
    : parsed.toLocaleString(locale.value === 'th' ? 'th-TH' : 'en-GB', { timeZone: 'Asia/Bangkok' })
}
async function select(id: string) {
  await router.replace({ query: { ...route.query, ticket: id } })
}
async function load() {
  listRequest?.abort()
  const controller = new AbortController()
  listRequest = controller
  loading.value = true
  error.value = ''
  try {
    await auth.initialize()
    if (!session.value) return
    const result = await fetchTickets(botId.value, admin.value, session.value, controller.signal)
    if (controller.signal.aborted) return
    tickets.value = result
    const chosen = result.find((item) => item.channelId === selectedId.value) ?? result[0]
    if (chosen) {
      if (chosen.channelId !== selectedId.value) await select(chosen.channelId)
      else await read()
    } else {
      messageRequest?.abort()
      version++
      messages.value = []
      nextBefore.value = null
      reading.value = false
      olderLoading.value = false
    }
  } catch (cause) {
    if (!controller.signal.aborted)
      error.value =
        cause instanceof Error
          ? cause.message
          : text('Unable to load tickets.', 'โหลดตั๋วไม่สำเร็จ')
  } finally {
    if (!controller.signal.aborted) loading.value = false
  }
}
async function read(older = false) {
  if (!session.value || !selected.value || (older && (olderLoading.value || !nextBefore.value)))
    return
  messageRequest?.abort()
  const controller = new AbortController()
  messageRequest = controller
  const current = ++version
  messageError.value = ''
  if (older) olderLoading.value = true
  else {
    reading.value = true
    olderLoading.value = false
    messages.value = []
    nextBefore.value = null
  }
  try {
    const page = await fetchTicketMessages(
      botId.value,
      selected.value.channelId,
      admin.value,
      session.value,
      older ? nextBefore.value : null,
      controller.signal,
    )
    if (current !== version || controller.signal.aborted) return
    const known = new Set(messages.value.map((item) => item.id))
    messages.value = older
      ? [...page.items.filter((item) => !known.has(item.id)), ...messages.value]
      : page.items
    nextBefore.value = page.hasMore ? page.nextBefore : null
  } catch (cause) {
    if (!controller.signal.aborted)
      messageError.value =
        cause instanceof Error
          ? cause.message
          : text('Unable to read messages.', 'อ่านแชทไม่สำเร็จ')
  } finally {
    if (current === version) {
      reading.value = false
      olderLoading.value = false
    }
  }
}
watch(selectedId, () => void read())
watch(session, (value) => {
  if (value) return
  listRequest?.abort()
  messageRequest?.abort()
  version++
  tickets.value = []
  messages.value = []
  nextBefore.value = null
})
onMounted(() => void load())
onBeforeUnmount(() => {
  listRequest?.abort()
  messageRequest?.abort()
  version++
})
</script>

<template>
  <section class="space-y-lg" data-ticket-history>
    <header class="flex flex-wrap items-start justify-between gap-md">
      <div>
        <h1 class="flex items-center gap-sm text-2xl font-bold">
          <Ticket :size="24" />{{ text('Ticket history', 'ประวัติแชท Ticket') }}
        </h1>
        <p class="mt-sm text-sm text-text-secondary">
          {{
            text(
              'Read open and closed tickets. Times are shown in Thailand time.',
              'อ่านแชทตั๋วที่เปิดอยู่และปิดแล้ว แสดงเวลาประเทศไทย',
            )
          }}
        </p>
      </div>
      <div>
        <AppButton variant="secondary" :disabled="loading || reading" @click="load"
          ><RefreshCw :size="16" />{{ text('Refresh', 'รีเฟรช') }}</AppButton
        >
      </div>
    </header>
    <p
      class="rounded-lg border border-border-subtle bg-bg-surface p-md text-sm text-text-secondary"
    >
      {{
        text(
          'Open tickets load live Discord messages. Closing a ticket saves its conversation here before deleting the channel. Discord attachment links may expire; files are not copied. The bot needs Message Content Intent and Read Message History.',
          'ตั๋วที่เปิดอยู่ดึงแชทจาก Discord ตอนปิดระบบจะเก็บบทสนทนาที่นี่ก่อนลบห้อง ลิงก์ไฟล์ Discord อาจหมดอายุเพราะไม่ได้คัดลอกตัวไฟล์ บอทต้องเปิด Message Content Intent และมีสิทธิ์ Read Message History',
        )
      }}
    </p>
    <AppRequestError v-if="error" :message="error" @retry="load" />
    <p v-if="loading" role="status">{{ text('Loading tickets…', 'กำลังโหลดตั๋ว…') }}</p>
    <p
      v-else-if="!error && !tickets.length"
      class="rounded-lg border border-dashed border-border-default p-xl text-center text-text-secondary"
    >
      {{ text('No ticket channels found for this bot.', 'ยังไม่พบห้อง Ticket ของบอทนี้') }}
    </p>
    <div v-if="tickets.length" class="grid min-w-0 items-start gap-lg desktop:grid-cols-3">
      <aside class="min-w-0 space-y-md rounded-xl border border-border-subtle bg-bg-surface p-md">
        <AppTextField
          v-model="search"
          :label="text('Find tickets', 'ค้นหาตั๋ว')"
          :placeholder="text('Channel, member ID or topic', 'ชื่อห้อง ID สมาชิก หรือหัวข้อ')"
        />
        <AppTextField
          v-model="filter"
          variant="dropdown"
          :label="text('Ticket status', 'สถานะตั๋ว')"
          :options="[
            { value: 'ALL', label: text('All tickets', 'ตั๋วทั้งหมด') },
            { value: 'OPEN', label: text('Open', 'เปิดอยู่') },
            { value: 'CLOSED', label: text('Closed', 'ปิดแล้ว') },
          ]"
        />
        <nav
          :aria-label="text('Tickets', 'รายการตั๋ว')"
          class="max-h-96 space-y-sm overflow-y-auto"
        >
          <button
            v-for="item in filtered"
            :key="item.channelId"
            type="button"
            class="block w-full break-words rounded-lg border p-md text-left focus-visible:outline-2 focus-visible:outline-offset-2"
            :class="
              selectedId === item.channelId
                ? 'border-border-default bg-bg-surface-hover'
                : 'border-border-subtle hover:bg-bg-surface-hover'
            "
            :aria-current="selectedId === item.channelId ? 'true' : undefined"
            @click="select(item.channelId)"
          >
            <strong class="block">#{{ item.name }}</strong>
            <span class="mt-xs block text-sm text-text-secondary"
              >{{ status(item.status) }} · {{ item.categoryKey }}</span
            >
            <small class="mt-xs block text-text-muted">{{ item.ownerId }}</small>
          </button>
          <p v-if="!filtered.length" class="text-sm text-text-secondary">
            {{ text('No matching tickets.', 'ไม่พบตั๋วที่ตรงกับการค้นหา') }}
          </p>
        </nav>
      </aside>
      <section
        v-if="selected"
        class="min-w-0 space-y-md rounded-xl border border-border-subtle bg-bg-surface p-md tablet:p-lg desktop:col-span-2"
        :aria-label="text('Conversation', 'บทสนทนา')"
      >
        <header class="break-words border-b border-border-subtle pb-md">
          <h2 class="flex items-center gap-sm text-xl font-semibold">
            <MessageSquare :size="20" />{{ selected.name }}
          </h2>
          <p class="mt-xs text-sm text-text-secondary">
            {{ status(selected.status) }} · {{ text('Opened', 'เปิดเมื่อ') }}
            {{ date(selected.openedAt) }}
          </p>
          <p v-if="selected.archived" class="mt-sm text-sm text-text-secondary">
            {{
              text(
                'Saved conversation — available after the Discord channel is deleted.',
                'ประวัติที่บันทึกไว้ — อ่านได้หลังลบห้อง Discord แล้ว',
              )
            }}
          </p>
        </header>
        <AppRequestError
          v-if="messageError"
          :message="messageError"
          @retry="read(Boolean(nextBefore))"
        />
        <AppButton
          v-if="nextBefore"
          variant="secondary"
          :disabled="olderLoading"
          @click="read(true)"
          >{{
            olderLoading
              ? text('Loading…', 'กำลังโหลด…')
              : text('Load earlier messages', 'โหลดข้อความก่อนหน้า')
          }}</AppButton
        >
        <p v-if="reading" role="status">{{ text('Loading conversation…', 'กำลังโหลดบทสนทนา…') }}</p>
        <p v-else-if="!messages.length && !messageError" class="text-text-secondary">
          {{
            text(
              'No messages, or the bot lacks Read Message History.',
              'ไม่มีข้อความ หรือบอทไม่มีสิทธิ์ Read Message History',
            )
          }}
        </p>
        <ol class="space-y-md" :aria-label="text('Messages', 'ข้อความ')">
          <li
            v-for="message in messages"
            :key="message.id"
            class="min-w-0 break-words rounded-lg border border-border-subtle p-md"
            data-ticket-message
          >
            <div class="flex flex-wrap items-baseline gap-xs">
              <strong>{{ message.authorName }}</strong
              ><small v-if="message.bot" class="text-text-muted">BOT</small>
              <time class="text-xs text-text-muted" :datetime="message.createdAt">{{
                date(message.createdAt)
              }}</time>
              <small v-if="message.editedAt" class="text-text-muted">{{
                text('(edited)', '(แก้ไขแล้ว)')
              }}</small>
            </div>
            <small class="block text-text-muted">{{ message.authorId }}</small>
            <small v-if="message.replyToId" class="mt-xs block text-text-secondary"
              >{{ text('Reply to message', 'ตอบกลับข้อความ') }} {{ message.replyToId }}</small
            >
            <p v-if="message.content" class="mt-sm whitespace-pre-wrap [overflow-wrap:anywhere]">
              {{ message.content }}
            </p>
            <p
              v-for="(block, index) in message.blocks"
              :key="index"
              class="mt-sm whitespace-pre-wrap border-l-2 border-border-default pl-md [overflow-wrap:anywhere]"
            >
              {{ block }}
            </p>
            <ul v-if="message.attachments.length" class="mt-sm space-y-xs">
              <li v-for="(file, index) in message.attachments" :key="index">
                <a
                  v-if="safeTicketAttachmentUrl(file.url)"
                  :href="safeTicketAttachmentUrl(file.url)"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="underline underline-offset-4"
                  >{{ file.name }}</a
                >
              </li>
            </ul>
            <p
              v-if="!message.content && !message.blocks.length && !message.attachments.length"
              class="mt-sm text-sm text-text-secondary"
            >
              {{
                text(
                  'No readable content. Check Message Content Intent if member messages are blank.',
                  'ไม่มีเนื้อหาที่อ่านได้ หากข้อความสมาชิกว่าง ให้ตรวจสอบ Message Content Intent',
                )
              }}
            </p>
          </li>
        </ol>
      </section>
    </div>
  </section>
</template>
