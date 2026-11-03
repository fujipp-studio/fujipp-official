<script setup lang="ts">
import { computed, defineAsyncComponent, ref, useId, watch } from 'vue'
import { Hash, Table2, TextCursorInput, FlaskConical, MessageSquare } from 'lucide-vue-next'
import FeatureSettingsCategories from './FeatureSettingsCategories.vue'
import FeatureSettingsLayout from './FeatureSettingsLayout.vue'
import FeatureSettingsCard from './FeatureSettingsCard.vue'
import { useFeatureEditor } from '../composables/featureEditorContext'

const { text, values, configuration, license, previewBot, priceReaderHelpers } = useFeatureEditor()
const PriceReaderResultSettings = defineAsyncComponent(
  () => import('./PriceReaderResultSettings.vue'),
)
const PriceReaderLegacyPricingSettings = defineAsyncComponent(
  () => import('./PriceReaderLegacyPricingSettings.vue'),
)
const PriceReaderPreview = defineAsyncComponent(() => import('./PriceReaderPreview.vue'))
const PriceReaderGeminiSettings = defineAsyncComponent(
  () => import('./PriceReaderGeminiSettings.vue'),
)
const PriceReaderTestPanel = defineAsyncComponent(() => import('./PriceReaderTestPanel.vue'))
const PriceReaderCountedPricingSettings = defineAsyncComponent(
  () => import('./PriceReaderCountedPricingSettings.vue'),
)
const PriceReaderPricingSettings = defineAsyncComponent(
  () => import('./PriceReaderPricingSettings.vue'),
)
const PriceReaderChannelSettings = defineAsyncComponent(
  () => import('./PriceReaderChannelSettings.vue'),
)
const PriceReaderStatusSettings = defineAsyncComponent(
  () => import('./PriceReaderStatusSettings.vue'),
)
const id = useId()
const activeCategory = ref('channels')
const resultsOpened = ref(false)
const statesOpened = ref(false)
const geminiOpened = ref(false)
const testOpened = ref(false)
const pricesOpened = ref(false)
watch(activeCategory, (key) => {
  if (key === 'test') testOpened.value = true
  if (key === 'gemini') geminiOpened.value = true
  if (key === 'results') resultsOpened.value = true
  if (key === 'states') statesOpened.value = true
  if (key === 'prices') pricesOpened.value = true
})
const field = (key: string) => configuration.value?.fields.find((item) => item.key === key)
const value = (key: string) => String(values.value[key] ?? '')
const categories = computed(() =>
  [
    {
      key: 'gemini',
      label: 'Gemini AI',
      icon: FlaskConical,
      show: license.value?.version.startsWith('3.'),
    },
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
const classified = computed(() => Boolean(field('PRICE_READER_PRICING_MODE')))
const pairs = computed(
  () => priceReaderHelpers.value?.priceReaderConfiguredPairs(values.value) ?? [],
)
const resultPreview = computed(
  () =>
    priceReaderHelpers.value?.priceReaderSampleValues(
      values.value,
      license.value?.version ?? '',
      previewBot.value?.discordGuildId,
    ) ?? {},
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
        <PriceReaderChannelSettings
          v-if="category.key === 'channels' && activeCategory === 'channels'"
        />
        <PriceReaderGeminiSettings v-else-if="category.key === 'gemini' && geminiOpened" />
        <div v-else-if="category.key === 'prices' && pricesOpened">
          <PriceReaderCountedPricingSettings v-if="license?.version === '3.2.0'" />
          <PriceReaderPricingSettings v-else-if="classified" />
          <PriceReaderLegacyPricingSettings v-else />
        </div>
        <PriceReaderResultSettings v-else-if="category.key === 'results' && resultsOpened" />
        <PriceReaderStatusSettings v-else-if="category.key === 'states' && statesOpened" />
        <PriceReaderTestPanel v-else-if="category.key === 'test' && testOpened" />
      </section>
      <template #summary>
        <FeatureSettingsCard
          v-if="activeCategory === 'results' || (activeCategory === 'states' && field('PRICE_READER_BOTH_DISCORD_TEMPLATE'))"
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
                  classified
                    ? value('PRICE_READER_PRICING_MODE') === 'BOTH'
                      ? text(
                          'Standard and Nitro Discord prices',
                          'ราคาปกติและราคา Nitro ของ Discord',
                        )
                      : value('PRICE_READER_PRICING_MODE') === 'NITRO'
                        ? text('Nitro Discord price', 'ราคา Nitro ของ Discord')
                        : text('Standard Discord price', 'ราคาปกติของ Discord')
                    : !license?.version.startsWith('1.')
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
                'Send images in the reader channel for automatic quotes; no command is needed.',
                'ส่งรูปในช่องอ่านราคา บอทอ่านให้อัตโนมัติ ไม่ต้องใช้คำสั่ง',
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
                  'Enable Message Content Intent and allow View Channel, Send Messages, Read Message History and Embed Links in the reader channel.',
                  'เปิด Message Content Intent และให้สิทธิ์ View Channel, Send Messages, Read Message History และ Embed Links ในช่องอ่านราคา',
                )
              }}
            </p>
          </details>
        </FeatureSettingsCard>
      </template>
    </FeatureSettingsLayout>
  </div>
</template>
