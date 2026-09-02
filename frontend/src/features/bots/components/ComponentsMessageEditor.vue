<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import AppTextField from '@/shared/ui/fields/AppTextField.vue'
import { useFeatureEditor } from '../composables/featureEditorContext'
import type { FeatureConfiguration } from '../api'

const { t } = useI18n()
defineProps<{ messageSlot: FeatureConfiguration['presentations'][number] }>()
const {
  supportsBlockBuilder,
  componentBlocks,
  componentCount,
  componentColor,
  draggedComponent,
  dropComponentBlock,
  blockSummary,
  moveComponentBlock,
  removeComponentBlock,
  updateComponentBlock,
  componentBlockValue,
  sectionTextBlocks,
  updateSectionText,
  addSectionText,
  removeSectionText,
  sectionAccessory,
  sectionAccessoryType,
  setSectionAccessory,
  updateSectionAccessory,
  mediaItems,
  mediaItemUrl,
  mediaItemDescription,
  updateMediaItem,
  addMediaItem,
  updateMediaItemField,
  removeMediaItem,
  actionRowButtons,
  componentEmoji,
  updateActionRowButton,
  addActionRowButton,
  removeActionRowButton,
  updateSeparator,
  updateContainerBlock,
  containerChildren,
  moveContainerChild,
  removeContainerChild,
  updateContainerChildContent,
  updateContainerChild,
  addContainerChild,
  addComponentBlock,
  systemComponents,
  updateSystemComponent,
  componentStyleOptions,
  addLink,
  visualArray,
  removeLink,
  updateLink,
  coFeatureComponents,
  removeCoFeature,
  updateCoFeature,
  availableCoFeatureOptions,
  addCoFeature,
  availableCoFeatures,
} = useFeatureEditor()
</script>
<template>
  <div class="builder-section desktop:col-span-2 wide:col-span-1">
    <template v-if="supportsBlockBuilder(messageSlot.key)">
      <div class="builder-heading">
        <div>
          <strong>Components V2 Layout</strong>
          <p>
            {{ t('botSettings.addRemoveAndReorderBlocks') }}
          </p>
        </div>
      </div>
      <div class="component-container-caption">
        <span>{{ t('botSettings.messageBlocks') }}</span>
        <small>{{ componentCount(messageSlot.key) }}/40</small>
      </div>
      <div
        v-for="(block, blockIndex) in componentBlocks(messageSlot.key)"
        :key="blockIndex"
        class="builder-item"
        draggable="true"
        @dragstart="draggedComponent = { slotKey: messageSlot.key, index: blockIndex }"
        @dragend="draggedComponent = null"
        @dragover.prevent
        @drop.prevent="dropComponentBlock(messageSlot.key, blockIndex)"
      >
        <div class="flex items-center gap-xs">
          <span class="component-drag-handle" :title="t('botSettings.dragToReorder')">⠿</span>
          <strong class="min-w-0 flex-1 truncate text-sm">{{ blockSummary(block) }}</strong
          ><button
            type="button"
            :disabled="blockIndex === 0"
            @click="moveComponentBlock(messageSlot.key, blockIndex, -1)"
          >
            ↑</button
          ><button
            type="button"
            :disabled="blockIndex === componentBlocks(messageSlot.key).length - 1"
            @click="moveComponentBlock(messageSlot.key, blockIndex, 1)"
          >
            ↓</button
          ><button
            type="button"
            class="builder-delete"
            @click="removeComponentBlock(messageSlot.key, blockIndex)"
          >
            {{ t('botSettings.delete') }}
          </button>
        </div>
        <textarea
          v-if="block.type === 10"
          :value="String(block.content ?? '')"
          rows="3"
          maxlength="4000"
          class="field-control mt-xs resize-y py-sm"
          :placeholder="
            t('botSettings.messageContentSupportsVariables', { variables: '{{variables}}' })
          "
          @input="
            updateComponentBlock(
              messageSlot.key,
              blockIndex,
              'content',
              ($event.target as HTMLTextAreaElement).value,
            )
          "
        />
        <div v-if="block.type === 9" class="mt-xs grid gap-xs">
          <div
            v-for="(textBlock, textIndex) in sectionTextBlocks(block)"
            :key="textIndex"
            class="builder-subitem"
          >
            <div class="builder-subitem-heading">
              <strong>{{ t('botSettings.content') }} {{ textIndex + 1 }}</strong>
              <button
                type="button"
                class="builder-delete"
                :disabled="sectionTextBlocks(block).length <= 1"
                @click="removeSectionText(messageSlot.key, blockIndex, textIndex)"
              >
                {{ t('botSettings.delete') }}
              </button>
            </div>
            <textarea
              :value="String(textBlock.content ?? '')"
              rows="3"
              maxlength="4000"
              class="field-control resize-y py-sm"
              :placeholder="t('botSettings.sectionContent')"
              @input="
                updateSectionText(
                  messageSlot.key,
                  blockIndex,
                  textIndex,
                  ($event.target as HTMLTextAreaElement).value,
                )
              "
            />
          </div>
          <button
            type="button"
            class="builder-add"
            :disabled="
              sectionTextBlocks(block).length >= 3 || componentCount(messageSlot.key) >= 40
            "
            @click="addSectionText(messageSlot.key, blockIndex)"
          >
            + {{ t('botSettings.content') }}
          </button>
          <div class="grid gap-xs tablet:grid-cols-2">
            <label class="component-field">
              <span>{{ t('botSettings.section') }} accessory</span>
              <select
                class="field-control h-10"
                :value="sectionAccessoryType(block)"
                @change="
                  setSectionAccessory(
                    messageSlot.key,
                    blockIndex,
                    ($event.target as HTMLSelectElement).value,
                  )
                "
              >
                <option value="thumbnail">{{ t('botSettings.accessoryImage') }}</option>
                <option value="link">{{ t('botSettings.linkButton') }}</option>
              </select>
            </label>
            <label class="component-field">
              <span>URL</span>
              <input
                :value="
                  sectionAccessoryType(block) === 'thumbnail'
                    ? componentBlockValue(block, 'accessoryUrl')
                    : String(sectionAccessory(block).url ?? '')
                "
                type="url"
                class="field-control h-10"
                placeholder="https://"
                @input="
                  updateSectionAccessory(
                    messageSlot.key,
                    blockIndex,
                    'url',
                    ($event.target as HTMLInputElement).value,
                  )
                "
              />
            </label>
            <template v-if="sectionAccessoryType(block) === 'link'">
              <label class="component-field">
                <span>{{ t('botSettings.buttonLabel') }}</span>
                <input
                  :value="String(sectionAccessory(block).label ?? '')"
                  maxlength="80"
                  class="field-control h-10"
                  @input="
                    updateSectionAccessory(
                      messageSlot.key,
                      blockIndex,
                      'label',
                      ($event.target as HTMLInputElement).value,
                    )
                  "
                />
              </label>
              <label class="component-field">
                <span>{{ t('botSettings.emoji') }}</span>
                <input
                  :value="componentEmoji(sectionAccessory(block).emoji)"
                  class="field-control h-10"
                  @input="
                    updateSectionAccessory(
                      messageSlot.key,
                      blockIndex,
                      'emoji',
                      ($event.target as HTMLInputElement).value,
                    )
                  "
                />
              </label>
            </template>
            <label v-else class="component-field tablet:col-span-2">
              <span>{{ t('botSettings.description') }}</span>
              <input
                :value="String(sectionAccessory(block).description ?? '')"
                maxlength="1024"
                class="field-control h-10"
                @input="
                  updateSectionAccessory(
                    messageSlot.key,
                    blockIndex,
                    'description',
                    ($event.target as HTMLInputElement).value,
                  )
                "
              />
            </label>
          </div>
        </div>
        <div v-if="block.type === 12" class="mt-xs grid gap-xs">
          <div
            v-for="(item, itemIndex) in mediaItems(block)"
            :key="itemIndex"
            class="builder-subitem"
          >
            <div class="builder-subitem-heading">
              <strong>{{ t('botSettings.media') }} {{ itemIndex + 1 }}</strong>
              <button
                type="button"
                class="builder-delete"
                @click="removeMediaItem(messageSlot.key, blockIndex, itemIndex)"
              >
                {{ t('botSettings.delete') }}
              </button>
            </div>
            <div class="grid gap-xs tablet:grid-cols-2">
              <label class="component-field tablet:col-span-2">
                <span>URL</span>
                <input
                  :value="mediaItemUrl(item)"
                  type="url"
                  class="field-control h-10"
                  placeholder="https://"
                  @input="
                    updateMediaItem(
                      messageSlot.key,
                      blockIndex,
                      itemIndex,
                      ($event.target as HTMLInputElement).value,
                    )
                  "
                />
              </label>
              <label class="component-field">
                <span>{{ t('botSettings.description') }}</span>
                <input
                  :value="mediaItemDescription(item)"
                  maxlength="1024"
                  class="field-control h-10"
                  @input="
                    updateMediaItemField(
                      messageSlot.key,
                      blockIndex,
                      itemIndex,
                      'description',
                      ($event.target as HTMLInputElement).value,
                    )
                  "
                />
              </label>
              <label class="component-check-field">
                <input
                  type="checkbox"
                  :checked="item.spoiler === true"
                  @change="
                    updateMediaItemField(
                      messageSlot.key,
                      blockIndex,
                      itemIndex,
                      'spoiler',
                      ($event.target as HTMLInputElement).checked,
                    )
                  "
                />
                {{ t('botSettings.markAsSpoiler') }}
              </label>
            </div>
          </div>
          <button
            type="button"
            class="builder-add"
            :disabled="mediaItems(block).length >= 10"
            @click="addMediaItem(messageSlot.key, blockIndex)"
          >
            + {{ t('botSettings.addMedia') }}
          </button>
        </div>
        <div v-if="block.type === 14" class="mt-xs grid gap-sm tablet:grid-cols-2">
          <label class="component-field"
            ><span>{{ t('botSettings.size') }}</span
            ><select
              class="field-control h-10"
              :value="Number(block.spacing ?? 1)"
              @change="
                updateSeparator(
                  messageSlot.key,
                  blockIndex,
                  'spacing',
                  Number(($event.target as HTMLSelectElement).value),
                )
              "
            >
              <option :value="1">{{ t('botSettings.small') }}</option>
              <option :value="2">{{ t('botSettings.large') }}</option>
            </select></label
          >
          <label
            class="flex items-center gap-xs self-end rounded-md border border-border-subtle p-sm text-sm font-medium"
            ><input
              type="checkbox"
              :checked="block.divider !== false"
              @change="
                updateSeparator(
                  messageSlot.key,
                  blockIndex,
                  'divider',
                  ($event.target as HTMLInputElement).checked,
                )
              "
            />{{ t('botSettings.dividerLine') }}</label
          >
        </div>
        <div v-if="block.type === 1" class="mt-xs grid gap-xs">
          <div
            v-for="(button, buttonIndex) in actionRowButtons(block)"
            :key="buttonIndex"
            class="builder-subitem"
          >
            <div class="builder-subitem-heading">
              <strong>{{ t('botSettings.linkButton') }} {{ buttonIndex + 1 }}</strong>
              <button
                type="button"
                class="builder-delete"
                @click="removeActionRowButton(messageSlot.key, blockIndex, buttonIndex)"
              >
                {{ t('botSettings.delete') }}
              </button>
            </div>
            <div class="grid gap-xs tablet:grid-cols-[minmax(0,1fr)_6rem_minmax(0,1.5fr)]">
              <input
                :value="String(button.label ?? '')"
                maxlength="80"
                class="field-control h-10"
                :placeholder="t('botSettings.buttonLabel')"
                @input="
                  updateActionRowButton(
                    messageSlot.key,
                    blockIndex,
                    buttonIndex,
                    'label',
                    ($event.target as HTMLInputElement).value,
                  )
                "
              />
              <input
                :value="componentEmoji(button.emoji)"
                class="field-control h-10"
                placeholder="Emoji"
                @input="
                  updateActionRowButton(
                    messageSlot.key,
                    blockIndex,
                    buttonIndex,
                    'emoji',
                    ($event.target as HTMLInputElement).value,
                  )
                "
              />
              <input
                :value="String(button.url ?? '')"
                type="url"
                class="field-control h-10"
                placeholder="https://"
                @input="
                  updateActionRowButton(
                    messageSlot.key,
                    blockIndex,
                    buttonIndex,
                    'url',
                    ($event.target as HTMLInputElement).value,
                  )
                "
              />
            </div>
          </div>
          <button
            type="button"
            class="builder-add"
            :disabled="actionRowButtons(block).length >= 5 || componentCount(messageSlot.key) >= 40"
            @click="addActionRowButton(messageSlot.key, blockIndex)"
          >
            + {{ t('botSettings.addLink') }}
          </button>
        </div>
        <div v-if="block.type === 17" class="mt-sm grid gap-sm">
          <div class="grid gap-sm tablet:grid-cols-[auto_minmax(0,1fr)] tablet:items-end">
            <label class="flex items-center gap-xs text-sm font-medium">
              <input
                type="checkbox"
                :checked="block.spoiler === true"
                @change="
                  updateContainerBlock(
                    messageSlot.key,
                    blockIndex,
                    'spoiler',
                    ($event.target as HTMLInputElement).checked,
                  )
                "
              />
              {{ t('botSettings.markAsSpoiler') }}
            </label>
            <label class="component-field">
              <span>{{ t('botSettings.sidebarColor') }}</span>
              <div class="grid grid-cols-[1fr_3rem] gap-xs">
                <input
                  :value="componentColor(block.accent_color)"
                  class="field-control h-10 font-mono"
                  maxlength="7"
                  @change="
                    updateContainerBlock(
                      messageSlot.key,
                      blockIndex,
                      'accent_color',
                      ($event.target as HTMLInputElement).value,
                    )
                  "
                />
                <input
                  :value="componentColor(block.accent_color)"
                  type="color"
                  class="field-control h-10 cursor-pointer p-1"
                  @input="
                    updateContainerBlock(
                      messageSlot.key,
                      blockIndex,
                      'accent_color',
                      ($event.target as HTMLInputElement).value,
                    )
                  "
                />
              </div>
            </label>
          </div>
          <div class="component-container-children">
            <div class="component-container-caption">
              <span>{{ t('botSettings.containerChildren') }}</span>
              <small>{{ containerChildren(block).length }}</small>
            </div>
            <div
              v-for="(child, childIndex) in containerChildren(block)"
              :key="childIndex"
              class="builder-item"
            >
              <div class="flex items-center gap-xs">
                <strong class="min-w-0 flex-1 truncate text-sm">{{ blockSummary(child) }}</strong>
                <button
                  type="button"
                  :disabled="childIndex === 0"
                  @click="moveContainerChild(messageSlot.key, blockIndex, childIndex, -1)"
                >
                  ↑
                </button>
                <button
                  type="button"
                  :disabled="childIndex === containerChildren(block).length - 1"
                  @click="moveContainerChild(messageSlot.key, blockIndex, childIndex, 1)"
                >
                  ↓
                </button>
                <button
                  type="button"
                  class="builder-delete"
                  @click="removeContainerChild(messageSlot.key, blockIndex, childIndex)"
                >
                  {{ t('botSettings.delete') }}
                </button>
              </div>
              <textarea
                v-if="child.type === 10 || child.type === 9"
                :value="
                  child.type === 10
                    ? String(child.content ?? '')
                    : componentBlockValue(child, 'sectionContent')
                "
                rows="3"
                class="field-control mt-xs resize-y py-sm"
                :placeholder="t('botSettings.content')"
                @input="
                  updateContainerChildContent(
                    messageSlot.key,
                    blockIndex,
                    childIndex,
                    ($event.target as HTMLTextAreaElement).value,
                  )
                "
              />
              <input
                v-if="child.type === 9"
                :value="componentBlockValue(child, 'accessoryUrl')"
                type="url"
                class="field-control mt-xs h-10"
                placeholder="https://"
                @input="
                  updateContainerChild(
                    messageSlot.key,
                    blockIndex,
                    childIndex,
                    'accessoryUrl',
                    ($event.target as HTMLInputElement).value,
                  )
                "
              />
              <input
                v-if="child.type === 12"
                :value="componentBlockValue(child, 'mediaUrl')"
                type="url"
                class="field-control mt-xs h-10"
                placeholder="https://"
                @input="
                  updateContainerChild(
                    messageSlot.key,
                    blockIndex,
                    childIndex,
                    'mediaUrl',
                    ($event.target as HTMLInputElement).value,
                  )
                "
              />
              <div v-if="child.type === 14" class="mt-xs grid gap-xs tablet:grid-cols-2">
                <select
                  class="field-control h-10"
                  :value="Number(child.spacing ?? 1)"
                  @change="
                    updateContainerChild(
                      messageSlot.key,
                      blockIndex,
                      childIndex,
                      'spacing',
                      Number(($event.target as HTMLSelectElement).value),
                    )
                  "
                >
                  <option :value="1">{{ t('botSettings.small') }}</option>
                  <option :value="2">{{ t('botSettings.large') }}</option>
                </select>
                <label class="component-check-field">
                  <input
                    type="checkbox"
                    :checked="child.divider !== false"
                    @change="
                      updateContainerChild(
                        messageSlot.key,
                        blockIndex,
                        childIndex,
                        'divider',
                        ($event.target as HTMLInputElement).checked,
                      )
                    "
                  />
                  {{ t('botSettings.dividerLine') }}
                </label>
              </div>
              <div
                v-if="child.type === 1"
                class="mt-xs grid gap-xs tablet:grid-cols-[minmax(0,1fr)_6rem_minmax(0,1.5fr)]"
              >
                <input
                  :value="componentBlockValue(child, 'label')"
                  maxlength="80"
                  class="field-control h-10"
                  :placeholder="t('botSettings.buttonLabel')"
                  @input="
                    updateContainerChild(
                      messageSlot.key,
                      blockIndex,
                      childIndex,
                      'label',
                      ($event.target as HTMLInputElement).value,
                    )
                  "
                />
                <input
                  :value="componentBlockValue(child, 'emoji')"
                  class="field-control h-10"
                  placeholder="Emoji"
                  @input="
                    updateContainerChild(
                      messageSlot.key,
                      blockIndex,
                      childIndex,
                      'emoji',
                      ($event.target as HTMLInputElement).value,
                    )
                  "
                />
                <input
                  :value="componentBlockValue(child, 'url')"
                  type="url"
                  class="field-control h-10"
                  placeholder="https://"
                  @input="
                    updateContainerChild(
                      messageSlot.key,
                      blockIndex,
                      childIndex,
                      'url',
                      ($event.target as HTMLInputElement).value,
                    )
                  "
                />
              </div>
              <p
                v-if="![1, 9, 10, 12, 14].includes(Number(child.type))"
                class="mt-xs text-xs text-text-muted"
              >
                {{ t('botSettings.thisChildKeepsItsConfiguredMediaOr') }}
              </p>
            </div>
            <div class="mt-xs flex flex-wrap gap-xs">
              <button
                type="button"
                class="builder-add"
                @click="addContainerChild(messageSlot.key, blockIndex, 'text')"
              >
                + Content
              </button>
              <button
                type="button"
                class="builder-add"
                @click="addContainerChild(messageSlot.key, blockIndex, 'section')"
              >
                + Section
              </button>
              <button
                type="button"
                class="builder-add"
                @click="addContainerChild(messageSlot.key, blockIndex, 'media')"
              >
                + Media
              </button>
              <button
                type="button"
                class="builder-add"
                @click="addContainerChild(messageSlot.key, blockIndex, 'separator')"
              >
                + Separator
              </button>
              <button
                type="button"
                class="builder-add"
                @click="addContainerChild(messageSlot.key, blockIndex, 'link')"
              >
                + Link Button
              </button>
            </div>
          </div>
        </div>
      </div>
      <div class="mt-sm flex flex-wrap gap-xs">
        <button
          type="button"
          class="builder-add"
          @click="addComponentBlock(messageSlot.key, 'text')"
        >
          + Content</button
        ><button
          type="button"
          class="builder-add"
          @click="addComponentBlock(messageSlot.key, 'container')"
        >
          + Container</button
        ><button
          type="button"
          class="builder-add"
          @click="addComponentBlock(messageSlot.key, 'section')"
        >
          + {{ t('botSettings.section') }}</button
        ><button
          type="button"
          class="builder-add"
          @click="addComponentBlock(messageSlot.key, 'media')"
        >
          + Media</button
        ><button
          type="button"
          class="builder-add"
          @click="addComponentBlock(messageSlot.key, 'separator')"
        >
          + Separator</button
        ><button
          type="button"
          class="builder-add"
          @click="addComponentBlock(messageSlot.key, 'link')"
        >
          + Link Button
        </button>
      </div>
    </template>
    <template v-if="systemComponents(messageSlot.key).length">
      <div class="builder-heading">
        <div>
          <strong>{{ t('botSettings.featureComponents') }}</strong>
          <p>
            {{ t('botSettings.customizeFixedButtonsAndSelectionsWithoutChanging') }}
          </p>
        </div>
      </div>
      <div v-for="item in systemComponents(messageSlot.key)" :key="item.role" class="builder-item">
        <div class="component-role">
          <strong>{{ item.role }}</strong>
          <span>{{
            item.role.includes('select') ? t('botSettings.selection') : t('botSettings.button')
          }}</span>
        </div>
        <div class="component-editor-grid">
          <label class="component-field">
            <span>{{ item.role.includes('select') ? 'Placeholder' : 'Label' }}</span>
            <input
              :value="String(item.config.label ?? item.config.placeholder ?? '')"
              class="field-control h-10"
              :placeholder="item.role.includes('select') ? 'เลือกตัวเลือก…' : 'ข้อความบนปุ่ม'"
              @input="
                updateSystemComponent(
                  messageSlot.key,
                  item.role,
                  item.role.includes('select') ? 'placeholder' : 'label',
                  ($event.target as HTMLInputElement).value,
                )
              "
            />
          </label>
          <AppTextField
            v-if="!item.role.includes('select')"
            :model-value="String(item.config.style ?? 'secondary')"
            variant="dropdown"
            label="Style"
            :options="componentStyleOptions"
            @update:model-value="
              (val) => updateSystemComponent(messageSlot.key, item.role, 'style', String(val))
            "
          />
          <label class="component-field">
            <span>Emoji</span>
            <input
              :value="String(item.config.emoji ?? '')"
              class="field-control h-10"
              placeholder="💰 หรือ <:name:id>"
              @input="
                updateSystemComponent(
                  messageSlot.key,
                  item.role,
                  'emoji',
                  ($event.target as HTMLInputElement).value,
                )
              "
            />
          </label>
        </div>
      </div>
    </template>
    <div class="mt-md border-t border-border-subtle pt-md">
      <div class="builder-heading">
        <div>
          <strong>{{ t('botSettings.linkButtons') }}</strong>
          <p>{{ t('botSettings.customizeTheLabelEmojiAndDestinationUrl') }}</p>
        </div>
        <button type="button" class="builder-add" @click="addLink(messageSlot.key)">
          {{ t('botSettings.addLink') }}
        </button>
      </div>
      <div
        v-for="(link, linkIndex) in visualArray(messageSlot.key, 'links')"
        :key="`component-link-${linkIndex}`"
        class="builder-item"
      >
        <div class="component-role">
          <strong>{{ t('botSettings.linkButton') }} {{ linkIndex + 1 }}</strong>
          <button
            type="button"
            class="builder-delete"
            @click="removeLink(messageSlot.key, linkIndex)"
          >
            {{ t('botSettings.delete') }}
          </button>
        </div>
        <div class="grid gap-xs tablet:grid-cols-[minmax(0,1fr)_6rem_minmax(0,1.5fr)]">
          <label class="component-field"
            ><span>Label</span
            ><input
              :value="String(link.label ?? '')"
              class="field-control h-10"
              placeholder="สั่งซื้อคลิก"
              @input="
                updateLink(
                  messageSlot.key,
                  linkIndex,
                  'label',
                  ($event.target as HTMLInputElement).value,
                )
              "
          /></label>
          <label class="component-field"
            ><span>Emoji</span
            ><input
              :value="String(link.emoji ?? '')"
              class="field-control h-10"
              placeholder="🍃"
              @input="
                updateLink(
                  messageSlot.key,
                  linkIndex,
                  'emoji',
                  ($event.target as HTMLInputElement).value,
                )
              "
          /></label>
          <label class="component-field"
            ><span>URL</span
            ><input
              :value="String(link.url ?? '')"
              type="url"
              class="field-control h-10"
              placeholder="https:// หรือ {{order_url}}"
              @input="
                updateLink(
                  messageSlot.key,
                  linkIndex,
                  'url',
                  ($event.target as HTMLInputElement).value,
                )
              "
          /></label>
        </div>
      </div>
    </div>
    <div class="mt-md border-t border-border-subtle pt-md">
      <div class="builder-heading">
        <div>
          <strong>Co-Feature</strong>
          <p>
            {{ t('botSettings.reuseActionsOnlyFromFeaturesInstalledOn') }}
          </p>
        </div>
      </div>
      <div
        v-for="item in coFeatureComponents(messageSlot.key)"
        :key="String(item.action)"
        class="builder-item"
      >
        <div class="flex items-center gap-xs">
          <strong class="min-w-0 flex-1 text-sm">{{ item.label }}</strong>
          <button
            type="button"
            class="builder-delete"
            @click="removeCoFeature(messageSlot.key, String(item.action))"
          >
            {{ t('botSettings.remove') }}
          </button>
        </div>
        <div class="component-editor-grid">
          <label class="component-field"
            ><span>Label</span
            ><input
              :value="String(item.label ?? '')"
              class="field-control h-10"
              @input="
                updateCoFeature(
                  messageSlot.key,
                  String(item.action),
                  'label',
                  ($event.target as HTMLInputElement).value,
                )
              "
          /></label>
          <AppTextField
            :model-value="String(item.style ?? 'secondary')"
            variant="dropdown"
            label="Style"
            :options="componentStyleOptions"
            @update:model-value="
              (val) => updateCoFeature(messageSlot.key, String(item.action), 'style', String(val))
            "
          />
          <label class="component-field"
            ><span>Emoji</span
            ><input
              :value="String(item.emoji ?? '')"
              class="field-control h-10"
              placeholder="💰 หรือ <:name:id>"
              @input="
                updateCoFeature(
                  messageSlot.key,
                  String(item.action),
                  'emoji',
                  ($event.target as HTMLInputElement).value,
                )
              "
          /></label>
        </div>
      </div>
      <AppTextField
        v-if="availableCoFeatureOptions(messageSlot.key).length"
        :model-value="''"
        variant="dropdown"
        :label="t('botSettings.addCoFeature')"
        :options="availableCoFeatureOptions(messageSlot.key)"
        :placeholder="'+ ' + t('botSettings.addActionFromInstalledFeature')"
        class="mt-xs"
        @update:model-value="(val) => val && addCoFeature(messageSlot.key, String(val))"
      />
      <p v-else-if="!availableCoFeatures.length" class="mt-xs text-xs text-text-muted">
        {{ t('botSettings.noCompatibleCoFeatureIsInstalledOn') }}
      </p>
    </div>
  </div>
</template>
