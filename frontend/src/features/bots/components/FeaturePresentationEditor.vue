<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import EmbedFieldsEditor from './EmbedFieldsEditor.vue'
import DiscordPresentationPreview from '@/features/bots/components/DiscordPresentationPreview.vue'
import EmbedColorField from '@/features/bots/components/EmbedColorField.vue'
import ComponentsMessageEditor from '@/features/bots/components/ComponentsMessageEditor.vue'
import { Braces, Check, ChevronDown } from 'lucide-vue-next'
import { useFeatureEditor } from '../composables/featureEditorContext'

const { t } = useI18n()
const {
  configuration,
  visiblePresentationSlots,
  usesPresentationDesigner,
  isRobloxPayoutFeature,
  isPriceReaderFeature,
  walletExpandedSlots,
  toggleWalletMessage,
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
  embedObject,
  updateEmbedObject,
  fixedActions,
  defaultActionLabel,
  updateActionOverride,
  componentStyles,
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
  <section v-if="configuration" id="feature-presentation-editor" class="mt-2xl">
    <div
      v-if="visiblePresentationSlots.length"
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
                  : t('botSettings.walletMessageBuilder')
            }}</strong>
            <p>{{ t('botSettings.openAFixedMessageToCustomizeIts') }}</p>
          </div>
          <span>{{ visiblePresentationSlots.length }} {{ t('botSettings.messages') }}</span>
        </div>
        <article
          v-for="(slot, slotIndex) in visiblePresentationSlots"
          :key="slot.slotId"
          :class="[
            'rounded-lg border border-border-subtle bg-bg-surface',
            usesPresentationDesigner ? 'wallet-message-card' : 'p-lg',
          ]"
        >
          <button
            v-if="usesPresentationDesigner"
            type="button"
            class="wallet-message-header"
            :aria-expanded="walletExpandedSlots.has(slot.key)"
            @click="toggleWalletMessage(slot.key)"
          >
            <ChevronDown
              :size="20"
              :class="[
                'wallet-message-chevron',
                { 'wallet-message-chevron--open': walletExpandedSlots.has(slot.key) },
              ]"
            />
            <span class="min-w-0 flex-1 text-left">
              <strong
                >{{ t('botSettings.message') }} {{ slotIndex + 1 }} ·
                {{ presentationSlotLabel(slot) }}</strong
              >
              <small>{{ slot.key }}</small>
            </span>
            <span class="wallet-fixed-badge"
              >{{ presentationMode ?? slotMode(slot.key) }} · {{ t('botSettings.design') }}</span
            >
          </button>
          <div
            v-show="!usesPresentationDesigner || walletExpandedSlots.has(slot.key)"
            :class="{ 'wallet-message-body': usesPresentationDesigner }"
          >
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
                <p class="mt-xs font-mono text-xs text-text-muted">{{ slot.key }}</p>
              </div>
              <button
                class="inline-flex items-center gap-xs self-start rounded-md border border-border-default px-sm py-xs text-sm hover:bg-bg-surface-hover"
                @click="toggleAdvanced(slot.key)"
              >
                <Braces :size="16" />
                {{ advancedSlots.has(slot.key) ? 'Visual editor' : 'Advanced JSON' }}
              </button>
            </div>
            <div
              v-if="slot.availableVariables.length"
              class="mt-md rounded-md border border-border-subtle bg-bg-default p-sm"
            >
              <strong class="text-sm">{{ t('botSettings.availableVariables') }}</strong>
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
            </div>

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
                  <span>{{ presentationMode === 'EMBED' ? 'Embed 1' : 'Components V2' }}</span>
                  <small>{{
                    isRobloxPayoutFeature
                      ? t('botSettings.actionsAreFixedByRobloxPayout')
                      : isPriceReaderFeature
                        ? t('botSettings.resultFlowIsFixedByPriceReader')
                        : t('botSettings.structureFixedByWalletTopUp')
                  }}</small>
                </div>
                <label
                  v-if="presentationMode === 'EMBED'"
                  class="text-sm font-medium desktop:col-span-2 wide:col-span-1"
                  >{{ t('botSettings.content') }}
                  <i class="field-counter"
                    >{{ valueLength(visualDefinition(slot.key).content) }}/2000</i
                  ><textarea
                    :value="String(visualDefinition(slot.key).content ?? '')"
                    rows="3"
                    maxlength="2000"
                    class="field-control mt-xs resize-y py-sm"
                    :placeholder="t('botSettings.optionalTextOutsideTheEmbed')"
                    @input="
                      updatePresentation(
                        slot.key,
                        'content',
                        ($event.target as HTMLTextAreaElement).value,
                      )
                    "
                  />
                </label>
                <details
                  v-if="presentationMode === 'EMBED'"
                  open
                  class="builder-section builder-accordion desktop:col-span-2 wide:col-span-1"
                >
                  <summary>{{ t('botSettings.author') }}</summary>
                  <div class="mt-sm grid gap-xs tablet:grid-cols-2">
                    <label class="component-field tablet:col-span-2"
                      ><span
                        >{{ t('botSettings.name') }}
                        <i>{{ valueLength(embedObject(slot.key, 'author').name) }}/256</i></span
                      ><input
                        :value="String(embedObject(slot.key, 'author').name ?? '')"
                        class="field-control h-10"
                        maxlength="256"
                        :placeholder="t('botSettings.authorName')"
                        @input="
                          updateEmbedObject(
                            slot.key,
                            'author',
                            'name',
                            ($event.target as HTMLInputElement).value,
                          )
                        "
                    /></label>
                    <label class="component-field"
                      ><span>{{ t('botSettings.iconUrl') }}</span
                      ><input
                        :value="String(embedObject(slot.key, 'author').icon_url ?? '')"
                        type="url"
                        class="field-control h-10"
                        :placeholder="t('botSettings.authorIconUrl')"
                        @input="
                          updateEmbedObject(
                            slot.key,
                            'author',
                            'icon_url',
                            ($event.target as HTMLInputElement).value,
                          )
                        "
                    /></label>
                    <label class="component-field"
                      ><span>{{ t('botSettings.authorUrl') }}</span
                      ><input
                        :value="String(embedObject(slot.key, 'author').url ?? '')"
                        type="url"
                        class="field-control h-10"
                        :placeholder="t('botSettings.authorLinkUrl')"
                        @input="
                          updateEmbedObject(
                            slot.key,
                            'author',
                            'url',
                            ($event.target as HTMLInputElement).value,
                          )
                        "
                    /></label>
                  </div>
                </details>
                <template v-if="presentationMode === 'COMPONENTS_V2'">
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
                <details
                  v-if="presentationMode === 'EMBED'"
                  open
                  class="builder-section builder-accordion desktop:col-span-2 wide:col-span-1"
                >
                  <summary>{{ t('botSettings.body') }}</summary>
                  <div class="mt-sm grid gap-sm tablet:grid-cols-2">
                    <label class="text-sm font-medium"
                      >{{ t('botSettings.title') }}
                      <i class="field-counter"
                        >{{ valueLength(visualDefinition(slot.key).title) }}/256</i
                      ><input
                        :value="String(visualDefinition(slot.key).title ?? '')"
                        class="field-control mt-xs h-11"
                        maxlength="256"
                        @input="
                          updatePresentation(
                            slot.key,
                            'title',
                            ($event.target as HTMLInputElement).value,
                          )
                        "
                    /></label>
                    <label v-if="presentationMode === 'EMBED'" class="text-sm font-medium"
                      >{{ t('botSettings.titleUrl')
                      }}<input
                        :value="String(visualDefinition(slot.key).url ?? '')"
                        type="url"
                        class="field-control mt-xs h-11"
                        placeholder="https://"
                        @input="
                          updatePresentation(
                            slot.key,
                            'url',
                            ($event.target as HTMLInputElement).value,
                          )
                        "
                    /></label>
                    <label class="text-sm font-medium desktop:col-span-2 wide:col-span-1"
                      >{{ t('botSettings.description') }}
                      <i class="field-counter"
                        >{{ valueLength(visualDefinition(slot.key).description) }}/4096</i
                      ><textarea
                        :value="String(visualDefinition(slot.key).description ?? '')"
                        rows="5"
                        maxlength="4096"
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
                    <EmbedColorField v-if="presentationMode === 'EMBED'" :message-slot="slot" />
                  </div>
                </details>
                <details
                  v-if="presentationMode === 'EMBED'"
                  open
                  class="builder-section builder-accordion desktop:col-span-2 wide:col-span-1"
                >
                  <summary>{{ t('botSettings.images') }}</summary>
                  <div class="mt-sm grid gap-sm tablet:grid-cols-2">
                    <label class="text-sm font-medium"
                      >{{ t('botSettings.imageUrl')
                      }}<input
                        :value="String(visualDefinition(slot.key).image_url ?? '')"
                        type="url"
                        class="field-control mt-xs h-11"
                        @input="
                          updatePresentation(
                            slot.key,
                            'image_url',
                            ($event.target as HTMLInputElement).value,
                          )
                        "
                    /></label>
                    <label class="text-sm font-medium"
                      >{{ t('botSettings.thumbnailUrl')
                      }}<input
                        :value="String(visualDefinition(slot.key).thumbnail_url ?? '')"
                        type="url"
                        class="field-control mt-xs h-11"
                        @input="
                          updatePresentation(
                            slot.key,
                            'thumbnail_url',
                            ($event.target as HTMLInputElement).value,
                          )
                        "
                    /></label>
                  </div>
                </details>
                <details
                  v-if="presentationMode === 'EMBED'"
                  open
                  class="builder-section builder-accordion desktop:col-span-2 wide:col-span-1"
                >
                  <summary>{{ t('botSettings.footer') }}</summary>
                  <div class="mt-sm grid gap-sm tablet:grid-cols-2">
                    <label class="text-sm font-medium tablet:col-span-2"
                      >{{ t('botSettings.footer') }}
                      <i class="field-counter"
                        >{{ valueLength(embedObject(slot.key, 'footer').text) }}/2048</i
                      ><input
                        :value="String(embedObject(slot.key, 'footer').text ?? '')"
                        class="field-control mt-xs h-11"
                        maxlength="2048"
                        @input="
                          updateEmbedObject(
                            slot.key,
                            'footer',
                            'text',
                            ($event.target as HTMLInputElement).value,
                          )
                        "
                    /></label>
                    <label class="text-sm font-medium"
                      >{{ t('botSettings.footerIconUrl')
                      }}<input
                        :value="String(embedObject(slot.key, 'footer').icon_url ?? '')"
                        type="url"
                        class="field-control mt-xs h-11"
                        placeholder="https://"
                        @input="
                          updateEmbedObject(
                            slot.key,
                            'footer',
                            'icon_url',
                            ($event.target as HTMLInputElement).value,
                          )
                        "
                    /></label>
                    <label
                      class="flex items-center gap-sm self-end rounded-md border border-border-subtle p-sm text-sm font-medium"
                    >
                      <input
                        :checked="visualDefinition(slot.key).timestamp === true"
                        type="checkbox"
                        @change="
                          updatePresentation(
                            slot.key,
                            'timestamp',
                            ($event.target as HTMLInputElement).checked,
                          )
                        "
                      />
                      {{ t('botSettings.showSentTimestamp') }}
                    </label>
                  </div>
                </details>
                <div
                  v-if="fixedActions(slot.key).length"
                  class="builder-section desktop:col-span-2 wide:col-span-1"
                >
                  <div class="builder-heading">
                    <div>
                      <strong>{{ t('botSettings.systemActions') }}</strong>
                      <p>
                        {{ t('botSettings.theActionIdIsLockedButIts') }}
                      </p>
                    </div>
                  </div>
                  <div
                    v-for="item in fixedActions(slot.key)"
                    :key="item.action"
                    class="builder-item"
                  >
                    <div class="component-role">
                      <strong>{{ item.action }}</strong>
                      <span>{{ t('botSettings.actionIdLocked') }}</span>
                    </div>
                    <div class="component-editor-grid">
                      <label class="component-field">
                        <span>{{ t('botSettings.text') }}</span>
                        <input
                          :value="
                            String(item.override.label ?? defaultActionLabel(item.defaults.label))
                          "
                          class="field-control h-10"
                          maxlength="80"
                          @input="
                            updateActionOverride(
                              slot.key,
                              item.action,
                              'label',
                              ($event.target as HTMLInputElement).value,
                            )
                          "
                        />
                      </label>
                      <fieldset class="component-field component-style-field">
                        <legend>{{ t('botSettings.color') }}</legend>
                        <div class="component-style-picker">
                          <button
                            v-for="style in componentStyles"
                            :key="style"
                            type="button"
                            :class="[
                              `component-style--${style}`,
                              {
                                'component-style--selected':
                                  String(item.override.style ?? item.defaults.style) === style,
                              },
                            ]"
                            :aria-label="style"
                            :aria-pressed="
                              String(item.override.style ?? item.defaults.style) === style
                            "
                            @click="updateActionOverride(slot.key, item.action, 'style', style)"
                          >
                            <Check
                              v-if="String(item.override.style ?? item.defaults.style) === style"
                              :size="16"
                            />
                          </button>
                        </div>
                      </fieldset>
                      <label class="component-field">
                        <span>Emoji</span>
                        <input
                          :value="String(item.override.emoji ?? item.defaults.emoji)"
                          class="field-control h-10"
                          placeholder="💰 หรือ <:name:id>"
                          @input="
                            updateActionOverride(
                              slot.key,
                              item.action,
                              'emoji',
                              ($event.target as HTMLInputElement).value,
                            )
                          "
                        />
                      </label>
                    </div>
                  </div>
                </div>
                <EmbedFieldsEditor v-if="presentationMode === 'EMBED'" :message-slot="slot" />
                <ComponentsMessageEditor v-else :message-slot="slot" />
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
            <small>{{
              presentationMode === 'EMBED' ? 'Discord Embed' : 'Discord Components V2'
            }}</small>
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
