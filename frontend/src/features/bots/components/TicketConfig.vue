<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { Plus, Ticket, Trash2 } from 'lucide-vue-next'
import { AppButton, AppTextField } from '@/shared/ui'
import AppToggle from '@/shared/ui/buttons/AppToggle.vue'
import FeatureSettingsLayout from './FeatureSettingsLayout.vue'
import FeatureSettingsCard from './FeatureSettingsCard.vue'
import { useFeatureEditor } from '../composables/featureEditorContext'
import {
  newTicketCategory,
  validateTicketDraft,
  type TicketCategory,
  type TicketField,
} from '../config/ticket-config'

const { values, text } = useFeatureEditor()
const route = useRoute()
const rows = ref<TicketCategory[]>([])
const roleTexts = ref<Record<string, string>>({})
let emitted = ''
watch(
  () => String(values.value.TICKET_CATEGORIES ?? '[]'),
  (raw) => {
    if (raw === emitted) return
    try {
      const parsed: unknown = JSON.parse(raw)
      rows.value = Array.isArray(parsed) ? parsed : []
      roleTexts.value = Object.fromEntries(
        rows.value.map((row) => [row.key, row.supportRoleIds.join(', ')]),
      )
    } catch {
      rows.value = []
    }
  },
  { immediate: true },
)
function commit() {
  emitted = JSON.stringify(rows.value)
  values.value.TICKET_CATEGORIES = emitted
}
function add() {
  rows.value.push(newTicketCategory(`topic_${crypto.randomUUID().slice(0, 8)}`))
  commit()
}
function addField(row: TicketCategory) {
  row.fields.push({
    key: `field_${crypto.randomUUID().slice(0, 8)}`,
    label: '',
    style: 'PARAGRAPH',
    required: true,
    placeholder: '',
  })
  commit()
}
function removeTopic(index: number) {
  rows.value.splice(index, 1)
  commit()
}
function removeField(row: TicketCategory, index: number) {
  row.fields.splice(index, 1)
  commit()
}
function setRoles(row: TicketCategory, value: string) {
  roleTexts.value[row.key] = value
  row.supportRoleIds = value.split(/[\s,]+/).filter(Boolean)
  commit()
}
function setTimer(row: TicketCategory, value: string) {
  row.autoCloseMinutes = value === '' ? NaN : Number(value)
  commit()
}
function setAutoClose(row: TicketCategory, enabled: boolean) {
  row.autoCloseMinutes = enabled ? 1440 : 0
  commit()
}
function setForm(row: TicketCategory, enabled: boolean) {
  row.formEnabled = enabled
  commit()
}
function setRequired(field: TicketField, required: boolean) {
  field.required = required
  commit()
}
const valid = computed(() => validateTicketDraft(values.value))
</script>

<template>
  <FeatureSettingsLayout data-ticket-config>
    <FeatureSettingsCard :title="text('Ticket topics', 'หัวข้อ Ticket')" :icon="Ticket">
      <p class="mb-lg text-sm text-text-secondary">
        {{
          text(
            'Members choose a topic from a dropdown. Each topic can require a form before opening a private channel.',
            'สมาชิกเลือกหัวข้อจาก dropdown แต่ละหัวข้อเปิดฟอร์มก่อนสร้างห้องส่วนตัวได้',
          )
        }}
      </p>
      <div class="space-y-lg">
        <section
          v-for="(row, index) in rows"
          :key="row.key"
          class="space-y-md rounded-lg border border-border-subtle p-md"
          :aria-label="row.label || text(`Topic ${index + 1}`, `หัวข้อที่ ${index + 1}`)"
        >
          <div class="flex items-center justify-between gap-md">
            <h3 class="font-semibold">
              {{ row.label || text(`Topic ${index + 1}`, `หัวข้อที่ ${index + 1}`) }}
            </h3>
            <button
              type="button"
              class="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-error-border text-error-text hover:bg-error-bg focus-visible:outline-2 focus-visible:outline-offset-2"
              :aria-label="text(`Delete topic ${index + 1}`, `ลบหัวข้อที่ ${index + 1}`)"
              @click="removeTopic(index)"
            >
              <Trash2 :size="18" />
            </button>
          </div>
          <AppTextField
            v-model="row.label"
            :label="text('Topic name', 'ชื่อหัวข้อใน dropdown')"
            :maxlength="100"
            required
            @update:model-value="commit"
          />
          <AppTextField
            v-model="row.description"
            :label="text('Dropdown description', 'คำอธิบายใน dropdown')"
            :maxlength="100"
            @update:model-value="commit"
          />
          <AppTextField
            v-model="row.categoryId"
            :label="text('Discord category ID', 'Category ID หมวดห้อง Discord')"
            :support-text="
              text(
                'Copy the ID of a Discord category, not a text channel.',
                'ใช้ ID ของหมวดห้อง Discord ที่จะให้บอทสร้างตั๋วไว้ภายใน',
              )
            "
            required
            @update:model-value="commit"
          />
          <AppTextField
            :model-value="roleTexts[row.key] ?? row.supportRoleIds.join(', ')"
            :label="text('Support role IDs', 'Role ID ทีมดูแล')"
            :support-text="
              text(
                'Separate up to 10 role IDs with commas. Administrators always have access.',
                'คั่นด้วยจุลภาค สูงสุด 10 Role ผู้ดูแล Administrator เข้าถึงได้เสมอ',
              )
            "
            @update:model-value="setRoles(row, $event)"
          />
          <div class="flex items-center justify-between gap-md">
            <span class="text-sm font-medium">{{
              text('Automatically close tickets', 'ตั้งเวลาปิดตั๋วอัตโนมัติ')
            }}</span>
            <AppToggle
              :model-value="row.autoCloseMinutes !== 0"
              :aria-label="
                text(`Enable auto-close for ${row.label}`, `เปิดตั้งเวลาปิดสำหรับ ${row.label}`)
              "
              @change="setAutoClose(row, $event)"
            />
          </div>
          <div v-if="row.autoCloseMinutes !== 0" class="grid gap-md tablet:grid-cols-2">
            <AppTextField
              :model-value="String(row.autoCloseMinutes)"
              input-type="number"
              :min="0"
              :max="43200"
              :step="1"
              :label="text('Auto-close (minutes)', 'ปิดอัตโนมัติ (นาที)')"
              :support-text="text('0 disables automatic closing.', 'ใส่ 0 เพื่อปิดการตั้งเวลา')"
              @update:model-value="setTimer(row, $event)"
            />
            <AppTextField
              v-model="row.autoCloseMode"
              variant="dropdown"
              :label="text('Count time from', 'เริ่มนับเวลา')"
              :options="[
                { value: 'IDLE', label: text('Last message', 'ข้อความล่าสุด') },
                { value: 'OPENED', label: text('Ticket opening', 'ตอนเปิดตั๋ว') },
              ]"
              @update:model-value="commit"
            />
          </div>
          <div class="flex items-center justify-between gap-md">
            <span class="text-sm font-medium">{{
              text('Require a form before opening', 'กรอกแบบฟอร์มก่อนเปิดตั๋ว')
            }}</span>
            <AppToggle
              :model-value="row.formEnabled"
              :aria-label="text(`Enable form for ${row.label}`, `เปิดฟอร์มสำหรับ ${row.label}`)"
              @change="setForm(row, $event)"
            />
          </div>
          <div v-if="row.formEnabled" class="space-y-md border-t border-border-subtle pt-md">
            <AppTextField
              v-model="row.formTitle"
              :label="text('Form title', 'ชื่อแบบฟอร์ม')"
              :maxlength="45"
              required
              @update:model-value="commit"
            />
            <div
              v-for="(field, fieldIndex) in row.fields"
              :key="field.key"
              class="space-y-md rounded-md border border-border-subtle p-md"
            >
              <div class="flex items-center justify-between gap-md">
                <h4 class="text-sm font-medium">
                  {{ text(`Question ${fieldIndex + 1}`, `คำถามที่ ${fieldIndex + 1}`) }}
                </h4>
                <button
                  type="button"
                  class="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-error-border text-error-text hover:bg-error-bg focus-visible:outline-2 focus-visible:outline-offset-2"
                  :aria-label="
                    text(`Delete question ${fieldIndex + 1}`, `ลบคำถามที่ ${fieldIndex + 1}`)
                  "
                  @click="removeField(row, fieldIndex)"
                >
                  <Trash2 :size="16" />
                </button>
              </div>
              <AppTextField
                v-model="field.label"
                :label="text('Question', 'คำถาม')"
                :maxlength="45"
                required
                @update:model-value="commit"
              />
              <AppTextField
                v-model="field.placeholder"
                :label="text('Placeholder', 'ข้อความตัวอย่าง')"
                :maxlength="100"
                @update:model-value="commit"
              />
              <AppTextField
                v-model="field.style"
                variant="dropdown"
                :label="text('Answer format', 'รูปแบบคำตอบ')"
                :options="[
                  { value: 'SHORT', label: text('Short answer', 'ข้อความสั้น') },
                  { value: 'PARAGRAPH', label: text('Paragraph', 'หลายบรรทัด') },
                ]"
                @update:model-value="commit"
              />
              <div class="flex items-center justify-between gap-md">
                <span class="text-sm">{{ text('Required answer', 'จำเป็นต้องตอบ') }}</span>
                <AppToggle
                  :model-value="field.required"
                  :aria-label="
                    text(
                      `Require question ${fieldIndex + 1}`,
                      `บังคับตอบคำถามที่ ${fieldIndex + 1}`,
                    )
                  "
                  @change="setRequired(field, $event)"
                />
              </div>
            </div>
            <AppButton variant="secondary" :disabled="row.fields.length >= 5" @click="addField(row)"
              ><Plus :size="18" />{{
                text('Add question (up to 5)', 'เพิ่มคำถาม (สูงสุด 5 ข้อ)')
              }}</AppButton
            >
          </div>
        </section>
        <p v-if="!valid" role="status" class="text-sm text-error-text">
          {{
            text(
              'Check category IDs, role IDs, timers and form questions. Add at least one topic and one question for every enabled form.',
              'ตรวจสอบ Category ID, Role ID, เวลาปิด และคำถาม ให้มีอย่างน้อยหนึ่งหัวข้อและหนึ่งคำถามต่อฟอร์มที่เปิดใช้งาน',
            )
          }}
        </p>
        <AppButton variant="secondary" :disabled="rows.length >= 25" @click="add"
          ><Plus :size="18" />{{ text('Add topic', 'เพิ่มหัวข้อ') }}</AppButton
        >
      </div>
    </FeatureSettingsCard>
    <FeatureSettingsCard :title="text('Conversation history', 'ประวัติการสนทนา')">
      <p class="mb-md text-sm text-text-secondary">
        {{
          text(
            'Read retained ticket conversations from bot management. Only the bot owner and website administrators can open this page.',
            'อ่านแชท Ticket ที่เก็บไว้ได้จากเว็บจัดการบอท เฉพาะเจ้าของบอทและแอดมินเว็บไซต์เท่านั้นที่เข้าถึงได้',
          )
        }}
      </p>
      <AppButton
        v-if="route.params.botId"
        variant="secondary"
        :to="{
          name: route.path.startsWith('/admin/')
            ? 'admin-bot-ticket-history'
            : 'bot-ticket-history',
          params: { botId: route.params.botId },
        }"
        >{{ text('Read ticket history', 'อ่านประวัติแชท Ticket') }}</AppButton
      >
      <div class="mt-lg flex items-center justify-between gap-md">
        <span class="text-sm font-medium">{{
          text('Allow history downloads in Discord', 'เปิดอ่านและดาวน์โหลดประวัติใน Discord')
        }}</span>
        <AppToggle
          :model-value="values.TICKET_DISCORD_HISTORY_ENABLED === true"
          :aria-label="text('Enable Discord history', 'เปิดประวัติใน Discord')"
          @change="values.TICKET_DISCORD_HISTORY_ENABLED = $event"
        />
      </div>
      <p class="mt-sm text-sm text-text-secondary">
        {{
          text(
            'Off by default. When enabled, the opener, support team and Discord administrators can privately download a transcript using the history button or /ticket history. The web reader remains available.',
            'ปิดไว้เป็นค่าเริ่มต้น เมื่อเปิด ผู้เปิดตั๋ว ทีมดูแล และแอดมิน Discord สามารถดาวน์โหลดประวัติแบบส่วนตัวจากปุ่มอ่านประวัติหรือ /ticket history ได้ โดยหน้าอ่านบนเว็บยังใช้งานได้เสมอ',
          )
        }}
      </p>
    </FeatureSettingsCard>
    <FeatureSettingsCard :title="text('Ticket command', 'คำสั่ง Ticket')">
      <AppTextField
        :model-value="String(values.TICKET_COMMAND_NAME ?? 'ticket')"
        :label="text('Command name', 'ชื่อคำสั่งหลัก')"
        :maxlength="32"
        :support-text="
          text(
            'Use lowercase letters, numbers, _ or -. Do not include /.',
            'ใช้ a–z ตัวเลข _ หรือ - ไม่ต้องใส่ /',
          )
        "
        @update:model-value="values.TICKET_COMMAND_NAME = $event"
      />
      <p class="mt-md text-sm text-text-secondary">
        /{{ values.TICKET_COMMAND_NAME || 'ticket' }} panel ·
        {{ text('Post the dropdown panel', 'ส่งแผงเลือกหัวข้อ') }}<br />/{{
          values.TICKET_COMMAND_NAME || 'ticket'
        }}
        close · {{ text('Close the current ticket', 'ปิดตั๋วในห้องปัจจุบัน') }}
        <template v-if="values.TICKET_DISCORD_HISTORY_ENABLED === true"
          ><br />/{{ values.TICKET_COMMAND_NAME || 'ticket' }} history ·
          {{ text('Download a private transcript', 'ดาวน์โหลดประวัติแบบส่วนตัว') }}</template
        >
      </p>
    </FeatureSettingsCard>
    <template #summary>
      <FeatureSettingsCard as="aside" compact :title="text('Private tickets', 'ตั๋วส่วนตัว')">
        <p class="text-sm text-text-secondary">
          {{
            text(
              'Only the opener, support roles, bot and administrators can see each ticket. One active ticket per member and topic. Closing keeps history and prevents the opener from sending more messages.',
              'ตั๋วมองเห็นได้เฉพาะผู้เปิด ทีมดูแล บอท และ Administrator เปิดค้างได้หนึ่งตั๋วต่อสมาชิกต่อหัวข้อ เมื่อปิดจะเก็บประวัติและล็อกการส่งข้อความของผู้เปิด',
            )
          }}
        </p>
        <p class="mt-md text-sm text-text-secondary">
          {{
            text(
              'Timers are checked every minute while online and resume after a restart. Changes apply to newly opened tickets. The bot needs Manage Channels, Manage Roles, View Channel, Send Messages, Embed Links and Read Message History.',
              'ตรวจเวลาทุกนาทีขณะบอทออนไลน์ และทำงานต่อหลังรีสตาร์ต การเปลี่ยนค่ามีผลกับตั๋วใหม่ บอทต้องมี Manage Channels, Manage Roles, View Channel, Send Messages, Embed Links และ Read Message History',
            )
          }}
        </p>
      </FeatureSettingsCard>
    </template>
  </FeatureSettingsLayout>
</template>
