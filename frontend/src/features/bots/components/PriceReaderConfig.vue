<script setup lang="ts">
import { computed, defineAsyncComponent, ref, useId, watch } from 'vue'
import { Hash, Table2, TextCursorInput, FlaskConical, MessageSquare } from 'lucide-vue-next'
import FeatureSettingsCategories from './FeatureSettingsCategories.vue'
import FeatureSettingsLayout from './FeatureSettingsLayout.vue'
import FeatureSettingsCard from './FeatureSettingsCard.vue'
import FeatureConfigField from './FeatureConfigField.vue'
import PriceMapEditor from './PriceMapEditor.vue'
import PriceReaderResultEditor from './PriceReaderResultEditor.vue'
import PriceReaderTemplateField from './PriceReaderTemplateField.vue'
import PriceReaderPreview from './PriceReaderPreview.vue'
import { priceReaderSampleValues, priceReaderPricePairs } from '../config/price-reader'
import { useFeatureEditor } from '../composables/featureEditorContext'

const { text, values, configuration, license, previewBot } = useFeatureEditor()
const PriceReaderTestPanel = defineAsyncComponent(() => import('./PriceReaderTestPanel.vue'))
const id = useId()
const activeCategory = ref('channels')
const testOpened = ref(false)
watch(activeCategory, (key) => {
  if (key === 'test') testOpened.value = true
})
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
    {
      key: 'states',
      label: text('Status messages', 'ข้อความแต่ละสถานะ'),
      icon: MessageSquare,
      show: Boolean(field('PRICE_READER_ERROR_ITEM_TEMPLATE')),
    },
    { key: 'test', label: text('Test', 'ทดสอบ'), icon: FlaskConical, show: true },
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
const resultPreview = computed(() =>
  priceReaderSampleValues(
    values.value,
    license.value?.version ?? '',
    previewBot.value?.discordGuildId,
  ),
)
const statusFields = computed(() =>
  [
    {
      key: 'PRICE_READER_NOT_FOUND_TEXT',
      label: text('No supported price detected', 'ข้อความเมื่ออ่านไม่พบราคา'),
      variables: [],
    },
    {
      key: 'PRICE_READER_OCR_ERROR_TEXT',
      label: text('Image processing failed', 'ข้อความเมื่ออ่านรูปผิดพลาด'),
      variables: [],
    },
    {
      key: 'PRICE_READER_UNMATCHED_PRICE_TEXT',
      label: text('No matching shop price', 'ข้อความเมื่อไม่มีคู่ราคา'),
      variables: ['discord_price', 'item_name'],
    },
    {
      key: 'PRICE_READER_ERROR_ITEM_TEMPLATE',
      label: text('Failed image template', 'รูปแบบผลลัพธ์ต่อรูปที่ผิดพลาด'),
      variables: ['result_index', 'error_message'],
    },
  ].filter((item) => field(item.key)),
)
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
                  'The nearest price within the configured tolerance is used. Equal distances use the first row.',
                  'ใช้คู่ราคาที่ใกล้ที่สุดภายในช่วงที่ตั้งไว้ หากห่างเท่ากันจะใช้แถวแรก',
                )
              }}
            </p>
          </FeatureSettingsCard>
          <FeatureSettingsCard
            v-if="field('PRICE_READER_MATCH_TOLERANCE_SATANG')"
            :title="text('Price matching', 'กฎจับคู่ราคา')"
            compact
          >
            <FeatureConfigField
              field-key="PRICE_READER_MATCH_TOLERANCE_SATANG"
              :label="text('Allowed difference', 'ความคลาดเคลื่อนที่ยอมรับ')"
            />
            <p class="mt-sm text-xs text-text-muted">
              {{
                text(
                  'Set 0 for exact matches. Maximum ±50 THB.',
                  'ตั้ง 0 เพื่อจับคู่ตรงราคาเท่านั้น สูงสุด ±50 บาท',
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
              'Customize the information shown for every successfully read image.',
              'แต่งข้อมูลที่แสดงสำหรับแต่ละรูปที่อ่านราคาสำเร็จ',
            )
          "
        >
          <PriceReaderResultEditor
            :model-value="value('PRICE_READER_RESULT_BLOCKS')"
            :template="value('PRICE_READER_RESULTS_ITEM_TEMPLATE')"
            :mode="
              field('PRICE_READER_RESULT_MODE') ? value('PRICE_READER_RESULT_MODE') : undefined
            "
            :with-markup="Boolean(license?.version.startsWith('1.'))"
            :can-use-blocks="Boolean(field('PRICE_READER_RESULT_BLOCKS'))"
            @update:model-value="values.PRICE_READER_RESULT_BLOCKS = $event"
            @update:template="values.PRICE_READER_RESULTS_ITEM_TEMPLATE = $event"
            @update:mode="
              field('PRICE_READER_RESULT_MODE') && (values.PRICE_READER_RESULT_MODE = $event)
            "
          />
          <div v-if="field('PRICE_READER_RESULTS_SEPARATOR')" class="mt-lg">
            <PriceReaderTemplateField
              :model-value="value('PRICE_READER_RESULTS_SEPARATOR')"
              :label="text('Separator between images', 'ตัวคั่นระหว่างรูป')"
              :required="false"
              :maxlength="100"
              :rows="3"
              @update:model-value="values.PRICE_READER_RESULTS_SEPARATOR = $event"
            />
          </div>
        </FeatureSettingsCard>
        <FeatureSettingsCard
          v-else-if="category.key === 'states'"
          :icon="MessageSquare"
          :title="text('Status messages', 'ข้อความแต่ละสถานะ')"
          :description="
            text(
              'Applies both when all images fail and when only some fail. Design the outer message in Message design.',
              'ใช้ได้ทั้งกรณีอ่านไม่สำเร็จทุกรูปและบางรูป ส่วนกรอบข้อความแก้ได้ในออกแบบข้อความ',
            )
          "
        >
          <div class="space-y-lg">
            <PriceReaderTemplateField
              v-for="item in statusFields"
              :key="item.key"
              :model-value="value(item.key)"
              :label="item.label"
              :variables="item.variables"
              :maxlength="item.key === 'PRICE_READER_ERROR_ITEM_TEMPLATE' ? 4000 : 1000"
              :rows="3"
              @update:model-value="values[item.key] = $event"
            />
          </div>
        </FeatureSettingsCard>
        <PriceReaderTestPanel v-else-if="category.key === 'test' && testOpened" />
      </section>
      <template #summary>
        <FeatureSettingsCard
          v-if="activeCategory === 'results'"
          :title="text('Live preview', 'ตัวอย่างทันที')"
          compact
        >
          <PriceReaderPreview :samples="resultPreview" />
        </FeatureSettingsCard>
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
