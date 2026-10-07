<script setup lang="ts">
import { computed, ref, useId, watch } from 'vue'
import { Hash, Table2, TextCursorInput } from 'lucide-vue-next'
import FeatureSettingsCategories from './FeatureSettingsCategories.vue'
import FeatureSettingsLayout from './FeatureSettingsLayout.vue'
import FeatureSettingsCard from './FeatureSettingsCard.vue'
import FeatureConfigField from './FeatureConfigField.vue'
import PriceMapEditor from './PriceMapEditor.vue'
import { priceReaderPricePairs } from '../config/price-reader'
import { useFeatureEditor } from '../composables/featureEditorContext'

const { text, values, configuration, license } = useFeatureEditor()
const id = useId()
const activeCategory = ref('channels')
const field = (key: string) => configuration.value?.fields.find((item) => item.key === key)
const value = (key: string) => String(values.value[key] ?? '')
const categories = computed(() =>
  [
    {
      key: 'channels',
      label: text('Discord channels', 'ช่อง Discord'),
      icon: Hash,
      show: ['PRICE_READER_CHANNEL_ID', 'PRICE_READER_ORDER_CHANNEL_ID'].some((key) => field(key)),
    },
    {
      key: 'prices',
      label: text('Pricing', 'ตารางราคา'),
      icon: Table2,
      show: ['PRICE_READER_PRICE_MAP', 'PRICE_READER_NO_NITRO_MARKUP_SATANG'].some((key) =>
        field(key),
      ),
    },
    {
      key: 'results',
      label: text('Result text', 'ข้อความผลลัพธ์'),
      icon: TextCursorInput,
      show: Boolean(field('PRICE_READER_RESULTS_ITEM_TEMPLATE')),
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
const pairs = computed(() => priceReaderPricePairs(values.value.PRICE_READER_PRICE_MAP))
const templateField = computed(() => field('PRICE_READER_RESULTS_ITEM_TEMPLATE'))
const templateHelp = computed(() =>
  text(
    'Use {{results_text}} in Message design to show these image results.',
    'ใส่ {{results_text}} ในส่วนออกแบบข้อความ เพื่อแสดงผลลัพธ์แต่ละรูป',
  ),
)
const templateError = computed(() => {
  const length = value('PRICE_READER_RESULTS_ITEM_TEMPLATE').length
  return !length || length > 4000
    ? text('Enter 1–4,000 characters.', 'กรอกข้อความ 1–4,000 ตัวอักษร')
    : ''
})
const variableToken = (variable: string) => '{{' + variable + '}}'
const variables = computed(() => {
  const configured = templateField.value?.ui?.variables
  return Array.isArray(configured)
    ? configured.filter((item): item is string => typeof item === 'string')
    : ['result_index', 'discord_price', 'shop_price_text']
})
</script>

<template>
  <div class="space-y-lg" data-price-reader-config>
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
          v-if="category.key === 'channels'"
          :icon="Hash"
          :title="text('Discord channels', 'ช่อง Discord')"
          :description="
            text(
              'Choose where the bot reads screenshots and where members can order.',
              'กำหนดช่องรับรูปอ่านราคาและช่องที่ลูกค้าสั่งซื้อ',
            )
          "
        >
          <div class="space-y-lg">
            <FeatureConfigField field-key="PRICE_READER_CHANNEL_ID" />
            <FeatureConfigField
              field-key="PRICE_READER_ORDER_CHANNEL_ID"
              :support-text="
                text(
                  'Optional · leave blank to omit the order link.',
                  'ไม่บังคับ · เว้นว่างเพื่อไม่แสดงลิงก์สั่งซื้อ',
                )
              "
            />
          </div>
          <details class="mt-lg border-t border-border-subtle pt-md">
            <summary class="cursor-pointer text-sm font-medium">
              {{ text('How to copy a channel ID', 'วิธีคัดลอก Channel ID') }}
            </summary>
            <p class="mt-sm text-sm text-text-secondary">
              {{
                text(
                  'Enable Developer Mode in Discord, then right-click the channel and choose Copy Channel ID.',
                  'เปิด Developer Mode ใน Discord แล้วคลิกขวาที่ช่อง เลือก Copy Channel ID',
                )
              }}
            </p>
          </details>
        </FeatureSettingsCard>
        <div v-else-if="category.key === 'prices'" class="space-y-lg">
          <FeatureSettingsCard
            v-if="field('PRICE_READER_PRICE_MAP')"
            :icon="Table2"
            :title="text('Shop prices', 'จับคู่ราคาขายของร้าน')"
            :description="
              text(
                'Enter Discord and shop prices in THB.',
                'กำหนดราคา Discord และราคาขายของร้าน หน่วยเป็นบาท',
              )
            "
          >
            <PriceMapEditor
              :model-value="value('PRICE_READER_PRICE_MAP')"
              @update:model-value="values.PRICE_READER_PRICE_MAP = $event"
            />
            <p class="mt-md text-xs text-text-muted">
              {{
                text(
                  'OCR uses the closest Discord price within 5 THB. If distances tie, the first row wins.',
                  'OCR ใช้ราคา Discord ที่ใกล้ที่สุดภายใน ±5 บาท หากห่างเท่ากันจะใช้แถวแรก',
                )
              }}
            </p>
          </FeatureSettingsCard>
          <FeatureSettingsCard
            v-if="field('PRICE_READER_NO_NITRO_MARKUP_SATANG')"
            :title="text('Non-Nitro markup', 'ค่าบวกเมื่อไม่มี Nitro')"
            :description="
              text(
                'Additional amount displayed per item for buyers without Nitro.',
                'จำนวนเงินเพิ่มต่อชิ้นที่แสดงสำหรับผู้ซื้อไม่มี Nitro',
              )
            "
            compact
          >
            <FeatureConfigField field-key="PRICE_READER_NO_NITRO_MARKUP_SATANG" />
          </FeatureSettingsCard>
        </div>
        <FeatureSettingsCard
          v-else-if="category.key === 'results'"
          :icon="TextCursorInput"
          :title="text('Text for each image', 'ข้อความผลลัพธ์ต่อรูป')"
          :description="
            text(
              'This template is repeated for each successfully read image.',
              'ระบบใช้ข้อความนี้ซ้ำสำหรับแต่ละรูปที่อ่านราคาสำเร็จ',
            )
          "
        >
          <label :for="id + '-item-template'" class="block text-sm font-medium">{{
            text('Result item template', 'รูปแบบผลลัพธ์ต่อรูป')
          }}</label>
          <textarea
            :id="id + '-item-template'"
            :value="value('PRICE_READER_RESULTS_ITEM_TEMPLATE')"
            rows="10"
            class="field-control mt-sm min-h-32 resize-y py-sm"
            :required="templateField?.required"
            maxlength="4000"
            :aria-invalid="Boolean(templateError)"
            :aria-describedby="id + '-template-help'"
            @input="
              values.PRICE_READER_RESULTS_ITEM_TEMPLATE = (
                $event.target as HTMLTextAreaElement
              ).value
            "
          />
          <p
            :id="id + '-template-help'"
            class="mt-sm text-xs"
            :class="templateError ? 'text-error-text' : 'text-text-muted'"
          >
            {{ templateError || templateHelp }}
          </p>
          <details class="mt-lg border-t border-border-subtle pt-md">
            <summary class="cursor-pointer text-sm font-medium">
              {{ text('Available variables', 'ตัวแปรที่ใช้ได้') }}
            </summary>
            <div class="mt-sm flex flex-wrap gap-sm">
              <code
                v-for="variable in variables"
                :key="variable"
                class="rounded-md bg-bg-default p-xs text-xs [overflow-wrap:anywhere]"
                >{{ variableToken(variable) }}</code
              >
            </div>
          </details>
        </FeatureSettingsCard>
      </section>
      <template #summary>
        <FeatureSettingsCard
          as="aside"
          :title="text('Reader overview', 'ภาพรวมการอ่านราคา')"
          compact
        >
          <dl class="space-y-md text-sm">
            <div>
              <dt class="text-xs text-text-muted">
                {{ text('Price source', 'ราคาที่ใช้จับคู่') }}
              </dt>
              <dd class="mt-xs font-medium">
                {{
                  license?.version.startsWith('2.')
                    ? text('Standard Discord price', 'ราคาปกติของ Discord')
                    : text('Detected Discord price', 'ราคา Discord ที่อ่านได้จากรูป')
                }}
              </dd>
            </div>
            <div>
              <dt class="text-xs text-text-muted">{{ text('Price pairs', 'คู่ราคา') }}</dt>
              <dd class="mt-xs font-medium" data-price-pair-count>
                {{ pairs.length }} {{ text('pairs', 'คู่') }}
              </dd>
            </div>
            <div>
              <dt class="text-xs text-text-muted">{{ text('Order channel', 'ช่องสั่งซื้อ') }}</dt>
              <dd class="mt-xs break-all">
                {{ value('PRICE_READER_ORDER_CHANNEL_ID') || text('Not set', 'ยังไม่ได้ตั้งค่า') }}
              </dd>
            </div>
          </dl>
          <p class="mt-lg border-t border-border-subtle pt-md text-xs text-text-secondary">
            {{
              text(
                'Members send screenshots in the reader channel. The bot reads image attachments automatically; no slash command is needed.',
                'สมาชิกส่งรูปในช่องอ่านราคา บอทอ่านไฟล์รูปที่แนบมาโดยอัตโนมัติ',
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
                  'Enable Message Content Intent. Allow View Channel, Send Messages and Read Message History in the reader channel; Embed messages also need Embed Links.',
                  'เปิด Message Content Intent ให้สิทธิ์ View Channel, Send Messages และ Read Message History ในช่องอ่านราคา ข้อความ Embed ต้องมี Embed Links ด้วย',
                )
              }}
            </p>
          </details>
        </FeatureSettingsCard>
      </template>
    </FeatureSettingsLayout>
  </div>
</template>
