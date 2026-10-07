<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import EmbedPresentationEditor from './EmbedPresentationEditor.vue'
import PresentationActionsEditor from './PresentationActionsEditor.vue'
import DiscordPresentationPreview from '@/features/bots/components/DiscordPresentationPreview.vue'
import ComponentsMessageEditor from '@/features/bots/components/ComponentsMessageEditor.vue'
import { Braces } from 'lucide-vue-next'
import { useFeatureEditor } from '../composables/featureEditorContext'

const { t } = useI18n()
const {
  text,
  license,
  configuration,
  visiblePresentationSlots,
  editablePresentationSlots,
  usesPresentationDesigner,
  isRobloxPayoutFeature,
  isPriceReaderFeature,
  isMemberSpendingFeature,
  isMessageTriggersFeature,
  walletActiveSlotKey,
  selectPresentationSlot,
  presentationSlotLabel,
  presentationMode,
  slotMode,
  presentationSlotDescription,
  toggleAdvanced,
  advancedSlots,
  variableToken,
  variableDescription,
  valueLength,
  visualDefinition,
  updatePresentation,
  componentBlocks,
  presentationJson,
  previewAdvancedJson,
  presentationPreviewDefinition,
  previewBot,
  presentationSampleValues,
  walletPreviewScope,
  walletPreviewSlots,
} = useFeatureEditor()
</script>
<template>
  <section
    v-if="configuration"
    id="feature-presentation-editor"
    :class="presentationMode === 'EMBED' ? 'mt-xl' : 'mt-2xl'"
  >
    <EmbedPresentationEditor v-if="presentationMode === 'EMBED'" />
    <div
      v-else-if="visiblePresentationSlots.length"
      :class="usesPresentationDesigner ? 'wallet-builder-layout' : 'space-y-md'"
    >
      <div :class="usesPresentationDesigner ? 'wallet-builder-messages' : 'contents'">
        <div v-if="usesPresentationDesigner" class="wallet-builder-toolbar">
          <div>
            <strong>{{
              isRobloxPayoutFeature
                ? t('botSettings.robloxPayoutMessageBuilder')
                : isPriceReaderFeature
                  ? t('botSettings.priceReaderMessageBuilder')
                  : isMessageTriggersFeature
                    ? 'Trigger Message Builder'
                    : license?.featureCode === 'payment-trigger'
                      ? text('Payment Message Builder', 'ออกแบบข้อความชำระเงิน')
                      : t('botSettings.walletMessageBuilder')
            }}</strong>
            <p>
              {{
                isMessageTriggersFeature
                  ? 'ปรับแต่ง Template ที่กฎ Category และ Admin Trigger เลือกใช้งาน'
                  : t('botSettings.openAFixedMessageToCustomizeIts')
              }}
            </p>
          </div>
          <span>{{ visiblePresentationSlots.length }} {{ t('botSettings.messages') }}</span>
        </div>
        <div
          v-if="usesPresentationDesigner"
          class="wallet-message-tabs"
          role="tablist"
          :aria-label="t('botSettings.messages')"
        >
          <button
            v-for="(slot, slotIndex) in visiblePresentationSlots"
            :key="`tab-${slot.slotId}`"
            type="button"
            role="tab"
            :aria-selected="walletActiveSlotKey === slot.key"
            :class="{ 'wallet-message-tab--active': walletActiveSlotKey === slot.key }"
            @click="selectPresentationSlot(slot.key)"
          >
            <span>{{ slotIndex + 1 }}</span>
            <strong>{{ presentationSlotLabel(slot) }}</strong>
            <small>{{ slot.key }}</small>
          </button>
        </div>
        <article
          v-for="slot in editablePresentationSlots"
          :key="slot.slotId"
          :class="[
            'rounded-lg border border-border-subtle bg-bg-surface',
            usesPresentationDesigner ? 'wallet-message-card' : 'p-lg',
          ]"
        >
          <div v-if="usesPresentationDesigner" class="wallet-message-header">
            <span class="min-w-0 flex-1 text-left">
              <strong>{{ presentationSlotLabel(slot) }}</strong>
              <small>{{ slot.key }}</small>
            </span>
            <span class="wallet-fixed-badge"
              >{{ presentationMode ?? slotMode(slot.key) }} · {{ t('botSettings.design') }}</span
            >
            <button type="button" class="wallet-advanced-toggle" @click="toggleAdvanced(slot.key)">
              <Braces :size="15" />
              {{ advancedSlots.has(slot.key) ? 'Visual editor' : 'JSON' }}
            </button>
          </div>
          <div :class="{ 'wallet-message-body': usesPresentationDesigner }">
            <div
              v-if="!usesPresentationDesigner"
              class="flex flex-col gap-sm tablet:flex-row tablet:items-start tablet:justify-between"
            >
              <div>
                <div class="flex flex-wrap items-center gap-xs">
                  <h3 class="text-lg font-semibold">{{ presentationSlotLabel(slot) }}</h3>
                  <span class="rounded-full border border-border-default px-xs py-xxs text-xs">{{
                    slot.type
                  }}</span
                  ><span
                    v-if="slot.overrideDefinition"
                    class="rounded-full border border-info-border bg-info-bg px-xs py-xxs text-xs text-info-text"
                    >{{ t('botSettings.customized') }}</span
                  >
                </div>
                <p class="mt-xs text-sm text-text-secondary">
                  {{ presentationSlotDescription(slot) }}
                </p>
                <p v-if="!isMemberSpendingFeature" class="mt-xs font-mono text-xs text-text-muted">
                  {{ slot.key }}
                </p>
              </div>
              <button
                class="inline-flex items-center gap-xs self-start rounded-md border border-border-default px-sm py-xs text-sm hover:bg-bg-surface-hover"
                @click="toggleAdvanced(slot.key)"
              >
                <Braces :size="16" />
                {{ advancedSlots.has(slot.key) ? 'Visual editor' : 'Advanced JSON' }}
              </button>
            </div>
            <component
              :is="isMemberSpendingFeature ? 'details' : 'div'"
              v-if="slot.availableVariables.length"
              class="mt-md rounded-md border border-border-subtle bg-bg-default p-sm"
            >
              <summary
                v-if="isMemberSpendingFeature"
                class="cursor-pointer rounded-sm text-sm font-medium"
              >
                {{ t('botSettings.availableVariables') }}
              </summary>
              <strong v-else class="text-sm">{{ t('botSettings.availableVariables') }}</strong>
              <p class="mt-xxs text-xs text-text-secondary">
                {{ t('botSettings.insertTheseVariablesIntoTextFieldsThe') }}
              </p>
              <div
                class="mt-sm grid gap-xs tablet:grid-cols-2 desktop:grid-cols-3 wide:grid-cols-2"
              >
                <div
                  v-for="variable in slot.availableVariables"
                  :key="variable"
                  class="rounded-md border border-border-subtle bg-bg-surface p-xs"
                >
                  <code class="text-xs font-semibold text-text-primary">{{
                    variableToken(variable)
                  }}</code>
                  <p class="mt-xxs text-xs leading-snug text-text-secondary">
                    {{ variableDescription(variable) }}
                  </p>
                </div>
              </div>
            </component>

            <div :class="['mt-lg grid gap-lg', { 'wide:grid-cols-2': !usesPresentationDesigner }]">
              <div
                v-if="!advancedSlots.has(slot.key)"
                :class="[
                  'grid content-start gap-md desktop:grid-cols-2 wide:grid-cols-1',
                  { 'wallet-fixed-structure': usesPresentationDesigner },
                ]"
              >
                <div
                  v-if="usesPresentationDesigner"
                  class="wallet-structure-heading desktop:col-span-2 wide:col-span-1"
                >
                  <span>Components V2</span>
                  <small>{{
                    isRobloxPayoutFeature
                      ? t('botSettings.actionsAreFixedByRobloxPayout')
                      : isPriceReaderFeature
                        ? t('botSettings.resultFlowIsFixedByPriceReader')
                        : t('botSettings.structureFixedByWalletTopUp')
                  }}</small>
                </div>
                <template
                  v-if="presentationMode === 'COMPONENTS_V2' && !componentBlocks(slot.key).length"
                >
                  <label class="text-sm font-medium"
                    >{{ t('botSettings.title') }}
                    <i class="field-counter"
                      >{{ valueLength(visualDefinition(slot.key).title) }}/256</i
                    ><input
                      :value="String(visualDefinition(slot.key).title ?? '')"
                      maxlength="256"
                      class="field-control mt-xs h-11"
                      @input="
                        updatePresentation(
                          slot.key,
                          'title',
                          ($event.target as HTMLInputElement).value,
                        )
                      "
                  /></label>
                  <label class="text-sm font-medium desktop:col-span-2 wide:col-span-1"
                    >{{ t('botSettings.description') }}
                    <i class="field-counter"
                      >{{ valueLength(visualDefinition(slot.key).description) }}/4000</i
                    ><textarea
                      :value="String(visualDefinition(slot.key).description ?? '')"
                      maxlength="4000"
                      rows="5"
                      class="field-control mt-xs resize-y py-sm"
                      @input="
                        updatePresentation(
                          slot.key,
                          'description',
                          ($event.target as HTMLTextAreaElement).value,
                        )
                      "
                    />
                  </label>
                </template>
                <PresentationActionsEditor
                  :message-slot="slot"
                  class="desktop:col-span-2 wide:col-span-1"
                />
                <ComponentsMessageEditor :message-slot="slot" />
              </div>
              <label v-else class="block text-sm font-medium"
                >Presentation JSON<textarea
                  v-model="presentationJson[slot.key]"
                  rows="20"
                  class="field-control mt-xs resize-y py-sm font-mono text-xs"
                  @input="previewAdvancedJson(slot.key)"
                /><small class="mt-xs block text-text-secondary">{{
                  t('botSettings.supportsAllActionsComponentsAndCustomStructures')
                }}</small></label
              >
              <DiscordPresentationPreview
                v-if="!usesPresentationDesigner"
                :definition="presentationPreviewDefinition(slot.key)"
                :variables="slot.availableVariables"
                :bot-name="previewBot?.discordUsername || previewBot?.name"
                :bot-avatar-url="previewBot?.discordAvatarUrl"
                :sample-values="presentationSampleValues(slot.key)"
              />
            </div>
          </div>
        </article>
      </div>
      <aside v-if="usesPresentationDesigner" class="wallet-builder-preview">
        <div class="wallet-preview-toolbar">
          <span><i /> {{ t('botSettings.livePreview') }}</span>
          <div class="wallet-preview-controls">
            <button
              type="button"
              :class="{ 'wallet-preview-scope--active': walletPreviewScope === 'all' }"
              @click="walletPreviewScope = 'all'"
            >
              {{ t('botSettings.all') }}
            </button>
            <button
              type="button"
              :class="{ 'wallet-preview-scope--active': walletPreviewScope === 'current' }"
              @click="walletPreviewScope = 'current'"
            >
              {{ t('botSettings.current') }}
            </button>
            <small>Discord Components V2</small>
          </div>
        </div>
        <div class="wallet-preview-stack">
          <DiscordPresentationPreview
            v-for="slot in walletPreviewSlots"
            :key="`preview-${slot.slotId}`"
            :definition="presentationPreviewDefinition(slot.key)"
            :variables="slot.availableVariables"
            :bot-name="previewBot?.discordUsername || previewBot?.name"
            :bot-avatar-url="previewBot?.discordAvatarUrl"
            :sample-values="presentationSampleValues(slot.key)"
            compact
          />
        </div>
      </aside>
    </div>
    <div
      v-else
      class="rounded-lg border border-dashed border-border-default p-xl text-center text-text-muted"
    >
      {{ t('botSettings.noMessagesCurrentlyUseThisPresentationMode') }}
    </div>
  </section>
</template>
