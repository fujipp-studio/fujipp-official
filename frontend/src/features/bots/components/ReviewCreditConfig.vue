<script setup lang="ts">
import FeatureSettingsLayout from './FeatureSettingsLayout.vue'
import FeatureSettingsCard from './FeatureSettingsCard.vue'
import FeatureSettingsCategories from './FeatureSettingsCategories.vue'
import { computed, ref, useId, watch } from 'vue'
import { Hash, MessageCircleHeart, ShieldCheck, Terminal } from 'lucide-vue-next'
import { AppTextField } from '@/shared/ui'
import FeatureSettingToggle from './FeatureSettingToggle.vue'
import ReviewCreditListEditor from './ReviewCreditListEditor.vue'
import FeatureCommandsSettings from './FeatureCommandsSettings.vue'
import { reviewCreditCommands } from '../config/feature-commands'
import { parseReviewList } from '../config/review-credit'
import { useFeatureEditor } from '../composables/featureEditorContext'

const { values, configuration, license, text } = useFeatureEditor()
const id = useId()
const selectedReply = ref('0')
const field = (key: string) => configuration.value?.fields.find((item) => item.key === key)
const activeCategory = ref('channel')
const categories = computed(() =>
  [
    {
      key: 'channel',
      label: text('Review channel', 'ห้องรีวิว'),
      icon: Hash,
      show: ['REVIEW_CHANNEL_ID', 'REVIEW_CHANNEL_NAME_TEMPLATE', 'REVIEW_COUNT_WEBHOOKS'].some(
        (key) => field(key),
      ),
    },
    {
      key: 'responses',
      label: text('Responses', 'การตอบกลับ'),
      icon: MessageCircleHeart,
      show: ['REVIEW_REACTIONS', 'REVIEW_REPLY_MESSAGES', 'REVIEW_DELETE_OLD_REPLY'].some((key) =>
        field(key),
      ),
    },
    {
      key: 'role',
      label: text('Reviewer role', 'ยศผู้รีวิว'),
      icon: ShieldCheck,
      show: Boolean(field('REVIEW_ROLE_ID')),
    },
    {
      key: 'commands',
      label: text('Commands', 'คำสั่ง'),
      icon: Terminal,
      show: Boolean(field('REVIEW_COMMAND_NAME')),
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
const value = (key: string) => String(values.value[key] ?? '')
const idError = (key: string) =>
  value(key) && !/^\d{15,30}$/.test(value(key))
    ? text('Discord ID must have 15–30 digits.', 'Discord ID ต้องเป็นตัวเลข 15–30 หลัก')
    : ''
const templateError = computed(() =>
  !value('REVIEW_CHANNEL_NAME_TEMPLATE').includes('{count}')
    ? text('Include {count} in the channel name.', 'ใส่ {count} ในชื่อห้องเพื่อแสดงจำนวนรีวิว')
    : '',
)
const channelPreview = computed(() =>
  value('REVIEW_CHANNEL_NAME_TEMPLATE').replaceAll('{count}', '123'),
)
const commands = computed(() =>
  reviewCreditCommands(
    license.value?.version === '1.1.0' || Boolean(field('REVIEW_COUNT_WEBHOOKS')),
  ),
)
const replies = computed(() =>
  parseReviewList(value('REVIEW_REPLY_MESSAGES') || '[]')
    .map((item) => item.trim())
    .filter(Boolean),
)
const reactions = computed(() =>
  parseReviewList(value('REVIEW_REACTIONS') || '[]')
    .map((item) => item.trim())
    .filter(Boolean),
)
const activeReply = computed(() =>
  Math.min(Number(selectedReply.value) || 0, Math.max(0, replies.value.length - 1)),
)
const replyOptions = computed(() =>
  replies.value.map((_, index) => ({
    value: String(index),
    label: text(`Reply ${index + 1}`, `ข้อความ ${index + 1}`),
  })),
)
</script>

<template>
  <div class="space-y-lg" data-review-credit-config>
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
          v-if="category.key === 'channel'"
          :title="text('Review channel', 'ห้องรีวิวและตัวนับ')"
          :heading-id="id + '-channel'"
          :icon="Hash"
          :description="
            text(
              'Choose where reviews are counted and how the channel is named.',
              'กำหนดห้องที่นับรีวิวและรูปแบบชื่อห้อง',
            )
          "
        >
          <div class="space-y-md">
            <AppTextField
              v-if="field('REVIEW_CHANNEL_ID')"
              :model-value="value('REVIEW_CHANNEL_ID')"
              :label="text('Review channel ID', 'Channel ID ห้องรีวิว')"
              :placeholder="text('Discord Channel ID', 'กรอก Discord Channel ID')"
              :required="field('REVIEW_CHANNEL_ID')?.required"
              pattern="[0-9]{15,30}"
              :state="idError('REVIEW_CHANNEL_ID') ? 'error' : 'default'"
              :support-text="
                idError('REVIEW_CHANNEL_ID') ||
                text('Text or announcement channel.', 'ใช้ห้องข้อความหรือห้องประกาศ')
              "
              @update:model-value="values.REVIEW_CHANNEL_ID = $event"
            />
            <AppTextField
              v-if="field('REVIEW_CHANNEL_NAME_TEMPLATE')"
              :model-value="value('REVIEW_CHANNEL_NAME_TEMPLATE')"
              :label="text('Channel name template', 'รูปแบบชื่อห้อง')"
              :placeholder="'review-{count}'"
              :maxlength="90"
              :required="field('REVIEW_CHANNEL_NAME_TEMPLATE')?.required"
              :state="templateError ? 'error' : 'default'"
              :support-text="
                templateError ||
                text(
                  '{count} is replaced with the total reviews.',
                  '{count} จะถูกแทนด้วยจำนวนรีวิวทั้งหมด',
                )
              "
              @update:model-value="values.REVIEW_CHANNEL_NAME_TEMPLATE = $event"
            />
            <FeatureSettingToggle
              v-if="field('REVIEW_COUNT_WEBHOOKS')"
              class="border-t border-border-subtle pt-md"
              :label="text('Count webhook reviews', 'นับรีวิวจาก Webhook')"
              :description="
                text(
                  'Includes webhook messages; ordinary bot messages are excluded.',
                  'รวมข้อความจาก Webhook โดยไม่นับข้อความจากบอททั่วไป',
                )
              "
              :model-value="Boolean(values.REVIEW_COUNT_WEBHOOKS)"
              @update:model-value="values.REVIEW_COUNT_WEBHOOKS = $event"
            />
          </div>
        </FeatureSettingsCard>

        <FeatureSettingsCard
          v-else-if="category.key === 'responses'"
          :title="text('Reactions & replies', 'Reaction และการตอบกลับ')"
          :heading-id="id + '-responses'"
          :icon="MessageCircleHeart"
          :description="
            text(
              'Respond automatically when a new review is posted.',
              'ตอบรับอัตโนมัติเมื่อมีรีวิวใหม่',
            )
          "
        >
          <div v-if="field('REVIEW_REACTIONS')">
            <h3 class="text-sm font-medium">{{ text('Reactions', 'Reaction') }}</h3>
            <p class="mt-xxs text-xs text-text-muted">
              {{
                text(
                  'Adds every emoji in this list. Unicode and Discord custom emoji are supported.',
                  'เพิ่มทุก Emoji ในรายการ รองรับ Emoji ทั่วไปและ Custom Emoji ของ Discord',
                )
              }}
            </p>
            <ReviewCreditListEditor
              :model-value="value('REVIEW_REACTIONS') || '[]'"
              :limit="10"
              :maxlength="100"
              @update:model-value="values.REVIEW_REACTIONS = $event"
            />
          </div>
          <div
            v-if="field('REVIEW_REPLY_MESSAGES')"
            class="mt-lg border-t border-border-subtle pt-lg"
          >
            <h3 class="text-sm font-medium">{{ text('Reply messages', 'ข้อความตอบกลับ') }}</h3>
            <p class="mt-xxs text-xs text-text-muted">
              {{
                text(
                  'One message is chosen randomly per review. Each reply can contain multiple lines.',
                  'สุ่มตอบหนึ่งข้อความต่อรีวิว แต่ละข้อความขึ้นบรรทัดใหม่ได้',
                )
              }}
            </p>
            <ReviewCreditListEditor
              :model-value="value('REVIEW_REPLY_MESSAGES') || '[]'"
              multiline
              :limit="20"
              :maxlength="2000"
              @update:model-value="values.REVIEW_REPLY_MESSAGES = $event"
            />
          </div>
          <FeatureSettingToggle
            v-if="field('REVIEW_DELETE_OLD_REPLY')"
            class="mt-lg border-t border-border-subtle pt-md"
            :label="text('Keep only the latest reply', 'เก็บเฉพาะข้อความตอบกลับล่าสุด')"
            :description="
              text(
                'Deletes the previous automated reply before sending the next one.',
                'ลบข้อความตอบกลับอัตโนมัติก่อนหน้า ก่อนส่งข้อความใหม่',
              )
            "
            :model-value="Boolean(values.REVIEW_DELETE_OLD_REPLY)"
            @update:model-value="values.REVIEW_DELETE_OLD_REPLY = $event"
          />
        </FeatureSettingsCard>

        <FeatureSettingsCard
          v-else-if="category.key === 'role'"
          :title="text('Reviewer role', 'ยศผู้รีวิว')"
          :heading-id="id + '-role'"
          :icon="ShieldCheck"
        >
          <div class="space-y-md">
            <AppTextField
              v-if="field('REVIEW_ROLE_ID')"
              :model-value="value('REVIEW_ROLE_ID')"
              :label="text('Reviewer Role ID (optional)', 'Role ID ผู้รีวิว (ไม่บังคับ)')"
              :placeholder="text('Discord Role ID', 'กรอก Discord Role ID')"
              pattern="[0-9]{15,30}"
              :state="idError('REVIEW_ROLE_ID') ? 'error' : 'default'"
              :support-text="
                idError('REVIEW_ROLE_ID') ||
                text(
                  'Granted after a member posts a review. Leave blank to skip.',
                  'มอบยศหลังสมาชิกส่งรีวิว เว้นว่างหากไม่ใช้',
                )
              "
              @update:model-value="values.REVIEW_ROLE_ID = $event"
            />
          </div>
        </FeatureSettingsCard>
        <FeatureCommandsSettings
          v-else-if="category.key === 'commands'"
          :model-value="value('REVIEW_COMMAND_NAME')"
          default-name="review"
          :required="field('REVIEW_COMMAND_NAME')?.required"
          :commands="commands"
          @update:model-value="values.REVIEW_COMMAND_NAME = $event"
        />
      </section>

      <template #summary>
        <FeatureSettingsCard
          as="aside"
          :title="text('Preview', 'ตัวอย่าง')"
          :heading-id="id + '-preview'"
          compact
        >
          <p class="mt-md text-xs text-text-muted">
            {{ text('Channel name · sample count: 123', 'ชื่อห้อง · ตัวอย่างจำนวนรีวิว 123') }}
          </p>
          <p
            class="mt-xs rounded-lg border border-border-subtle bg-bg-default p-md text-sm font-medium [overflow-wrap:anywhere]"
            data-review-channel-preview
          >
            # {{ channelPreview || 'review' }}
          </p>
          <div
            v-if="field('REVIEW_REPLY_MESSAGES')"
            class="mt-lg border-t border-border-subtle pt-md"
          >
            <AppTextField
              v-if="replies.length > 1"
              variant="dropdown"
              :label="text('Preview reply', 'ตัวอย่างข้อความตอบกลับ')"
              :model-value="String(activeReply)"
              :options="replyOptions"
              @update:model-value="selectedReply = $event"
            />
            <h3 v-else class="text-xs text-text-secondary">
              {{ text('Preview reply', 'ตัวอย่างข้อความตอบกลับ') }}
            </h3>
            <p
              v-if="replies.length"
              class="mt-sm whitespace-pre-wrap rounded-lg border border-border-subtle bg-bg-default p-md text-sm [overflow-wrap:anywhere]"
              data-review-reply-preview
            >
              {{ replies[activeReply] }}
            </p>
            <p v-else class="mt-sm text-xs text-text-muted">
              {{ text('No automatic reply will be sent.', 'จะไม่ส่งข้อความตอบกลับอัตโนมัติ') }}
            </p>
            <p v-if="reactions.length" class="mt-sm text-sm [overflow-wrap:anywhere]">
              {{ reactions.join(' · ') }}
            </p>
            <p class="mt-sm text-xs text-text-muted">
              {{
                text(
                  'Sample text from your settings. The bot chooses a reply randomly.',
                  'ตัวอย่างข้อความจากการตั้งค่า บอทจะสุ่มข้อความเมื่อใช้งานจริง',
                )
              }}
            </p>
          </div>
        </FeatureSettingsCard>
      </template>
    </FeatureSettingsLayout>
  </div>
</template>
