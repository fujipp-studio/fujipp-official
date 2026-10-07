<script setup lang="ts">
import { computed, ref, useId, watch } from 'vue'
import { Hash, MessageSquareText, ShieldCheck } from 'lucide-vue-next'
import FeatureSettingsCategories from './FeatureSettingsCategories.vue'
import FeatureSettingsLayout from './FeatureSettingsLayout.vue'
import FeatureSettingsCard from './FeatureSettingsCard.vue'
import MessageTriggerRulesEditor from './MessageTriggerRulesEditor.vue'
import { useFeatureEditor } from '../composables/featureEditorContext'
import { parseMessageTriggerRules } from '../config/channel-message-triggers'

const { text, configuration, values, presentationSlotLabel } = useFeatureEditor()
const id = useId()
const activeCategory = ref('channel')
const field = (key: string) => configuration.value?.fields.find((item) => item.key === key)
const categories = computed(() =>
  [
    {
      key: 'channel',
      configKey: 'CHANNEL_CREATE_RULES',
      label: text('Channel creation', 'เมื่อสร้างห้อง'),
      icon: Hash,
    },
    {
      key: 'admin',
      configKey: 'ADMIN_MESSAGE_TRIGGERS',
      label: text('Administrator triggers', 'ข้อความแอดมิน'),
      icon: MessageSquareText,
    },
  ].filter((category) => field(category.configKey)),
)
watch(
  categories,
  (list) => {
    if (!list.some((category) => category.key === activeCategory.value))
      activeCategory.value = list[0]?.key ?? ''
  },
  { immediate: true },
)
const ruleCount = (key: string) =>
  parseMessageTriggerRules(String(values.value[key] ?? '[]')).length
const templates = computed(
  () =>
    configuration.value?.presentations.map((slot) => ({
      value: slot.key,
      label: presentationSlotLabel(slot),
    })) ?? [],
)
const limit = (key: string) =>
  typeof field(key)?.validation?.maxItems === 'number'
    ? Number(field(key)!.validation!.maxItems)
    : 25
</script>

<template>
  <div class="space-y-lg" data-channel-message-triggers-config>
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
          :title="category.label"
          :icon="category.icon"
          :description="
            category.key === 'channel'
              ? text(
                  'Send a template in each new text or announcement channel created in a selected category.',
                  'ส่ง Template ในห้องข้อความหรือห้องประกาศที่สร้างใหม่ใน Category ที่กำหนด',
                )
              : text(
                  'Send a template when an administrator types an exact trigger.',
                  'ส่ง Template เมื่อแอดมินพิมพ์ข้อความตรงกับ Trigger',
                )
          "
        >
          <p
            v-if="category.key === 'admin'"
            class="mb-md rounded-lg bg-bg-default p-md text-xs text-text-secondary"
          >
            {{
              text(
                'Requires Administrator permission. Matching ignores letter case and surrounding spaces. The bot attempts to delete the trigger message before sending the template.',
                'ผู้ส่งต้องมีสิทธิ์ Administrator เทียบทั้งข้อความโดยไม่สนตัวพิมพ์เล็ก–ใหญ่และช่องว่างหัวท้าย บอทจะพยายามลบข้อความ Trigger ก่อนส่ง Template',
              )
            }}
          </p>
          <MessageTriggerRulesEditor
            :model-value="String(values[category.configKey] ?? '[]')"
            :kind="category.key === 'channel' ? 'channel-create' : 'admin-message'"
            :templates="templates"
            :limit="limit(category.configKey)"
            @update:model-value="values[category.configKey] = $event"
          />
        </FeatureSettingsCard>
      </section>
      <template #summary>
        <div class="space-y-lg">
          <FeatureSettingsCard as="aside" :title="text('Overview', 'ภาพรวม')" compact>
            <dl class="space-y-sm text-sm">
              <div
                v-for="category in categories"
                :key="category.key"
                class="flex justify-between gap-sm"
              >
                <dt class="text-text-secondary">{{ category.label }}</dt>
                <dd class="font-medium">{{ ruleCount(category.configKey) }}</dd>
              </div>
              <div class="flex justify-between gap-sm border-t border-border-subtle pt-sm">
                <dt class="text-text-secondary">
                  {{ text('Message templates', 'Template ข้อความ') }}
                </dt>
                <dd class="font-medium">{{ templates.length }}</dd>
              </div>
            </dl>
            <p class="mt-md text-xs text-text-muted">
              {{
                text(
                  'Templates can be shared across rules. Edit them in Message design below.',
                  'ใช้ Template เดียวกับหลายกฎได้ แก้ไขรูปแบบในส่วนออกแบบข้อความด้านล่าง',
                )
              }}
            </p>
          </FeatureSettingsCard>
          <FeatureSettingsCard
            as="aside"
            :title="text('Bot permissions', 'สิทธิ์ของบอท')"
            :icon="ShieldCheck"
            compact
          >
            <p class="text-xs text-text-secondary">
              {{
                text(
                  'Allow View Channel and Send Messages in the target channels. Embed messages also need Embed Links.',
                  'ให้บอทมีสิทธิ์ View Channel และ Send Messages ในห้องปลายทาง ข้อความ Embed ต้องมี Embed Links ด้วย',
                )
              }}
            </p>
            <p v-if="field('ADMIN_MESSAGE_TRIGGERS')" class="mt-sm text-xs text-text-secondary">
              {{
                text(
                  'Enable Message Content Intent in the Developer Portal. Manage Messages lets the bot delete administrator trigger messages.',
                  'เปิด Message Content Intent ใน Developer Portal และให้สิทธิ์ Manage Messages เพื่อให้บอทลบข้อความ Trigger ของแอดมินได้',
                )
              }}
            </p>
          </FeatureSettingsCard>
        </div>
      </template>
    </FeatureSettingsLayout>
  </div>
</template>
