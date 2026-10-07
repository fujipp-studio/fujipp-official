<script setup lang="ts">
import FeatureSettingsLayout from './FeatureSettingsLayout.vue'
import FeatureSettingsCard from './FeatureSettingsCard.vue'
import { computed, useId } from 'vue'
import { Crown, ShieldCheck } from 'lucide-vue-next'
import CommandPermissionsEditor from './CommandPermissionsEditor.vue'
import { parseCommandPermissionRules } from '../config/bot-permissions'
import { useFeatureEditor } from '../composables/featureEditorContext'

const { values, configuration, text, permissionCommandFeatures } = useFeatureEditor()
const id = useId()
const rules = computed(() =>
  parseCommandPermissionRules(String(values.value.COMMAND_PERMISSION_RULES ?? '[]')),
)
const hasRules = computed(() =>
  configuration.value?.fields.some((field) => field.key === 'COMMAND_PERMISSION_RULES'),
)
</script>

<template>
  <FeatureSettingsLayout>
    <FeatureSettingsCard
      v-if="hasRules"
      :heading-id="id + '-rules'"
      :title="text('Command access', 'สิทธิ์การใช้คำสั่ง')"
      :description="
        text(
          'Choose a Feature and command, then allow roles or users.',
          'เลือก Feature และคำสั่ง แล้วกำหนด Role หรือผู้ใช้ที่อนุญาต',
        )
      "
    >
      <template #actions
        ><span v-if="rules">{{ rules.length }} / 100</span></template
      >
      <p
        v-if="permissionCommandFeatures.some((item) => item.unavailable)"
        class="mt-xs text-xs text-text-muted"
      >
        {{
          text(
            'Some command suggestions could not be loaded. You can enter commands manually.',
            'บาง Feature โหลดคำสั่งแนะนำไม่ได้ สามารถกำหนดคำสั่งเองได้',
          )
        }}
      </p>
      <CommandPermissionsEditor
        :model-value="String(values.COMMAND_PERMISSION_RULES ?? '[]')"
        hide-summary
        hide-admin-badge
        collapsible
        :command-features="permissionCommandFeatures"
        @update:model-value="values.COMMAND_PERMISSION_RULES = $event"
      />
    </FeatureSettingsCard>
    <template #summary>
      <FeatureSettingsCard
        as="aside"
        :title="text('How permissions work', 'การใช้สิทธิ์')"
        :heading-id="id + '-access'"
        :icon="ShieldCheck"
        compact
      >
        <div class="mt-md rounded-lg border border-border-subtle bg-bg-default p-md">
          <p class="flex items-center gap-xs text-sm font-medium">
            <Crown :size="16" aria-hidden="true" />Administrator
          </p>
          <p class="mt-xs text-xs text-text-secondary">
            {{
              text(
                'Administrators always pass these permission rules.',
                'ผู้ที่มีสิทธิ์ Administrator จะผ่านกฎสิทธิ์นี้เสมอ',
              )
            }}
          </p>
        </div>
        <div class="mt-md space-y-md text-sm">
          <div>
            <strong class="font-medium">{{ text('Roles or users', 'Role หรือ User') }}</strong>
            <p class="mt-xxs text-xs text-text-secondary">
              {{
                text(
                  'Matching a listed role or user is enough to pass a rule.',
                  'มี Role ที่ระบุ หรือเป็น User ที่ระบุ ก็ผ่านกฎนั้นได้',
                )
              }}
            </p>
          </div>
          <div>
            <strong class="font-medium">{{
              text('Empty recipient lists', 'ไม่ระบุ Role และ User')
            }}</strong>
            <p class="mt-xxs text-xs text-text-secondary">
              {{
                text(
                  'A matching rule with both lists empty allows only Administrators.',
                  'กฎที่ตรงกับคำสั่งและเว้นทั้งสองช่องไว้ จะอนุญาตเฉพาะ Administrator',
                )
              }}
            </p>
          </div>
          <div>
            <strong class="font-medium">{{
              text('No matching rule', 'ไม่มีกฎที่ตรงกับคำสั่ง')
            }}</strong>
            <p class="mt-xxs text-xs text-text-secondary">
              {{
                text(
                  'The command keeps its Feature’s original permissions.',
                  'คำสั่งจะใช้สิทธิ์เดิมของ Feature นั้น',
                )
              }}
            </p>
          </div>
        </div>
        <details class="mt-lg border-t border-border-subtle pt-md">
          <summary class="cursor-pointer text-sm text-text-secondary">
            {{ text('Rule priority & command examples', 'ลำดับกฎและตัวอย่างคำสั่ง') }}
          </summary>
          <p class="mt-sm text-xs text-text-secondary">
            {{
              text(
                'Check the exact subcommand first, then the main command, then * for other commands. The first matching rule at each level is used.',
                'ตรวจคำสั่งย่อยก่อน ตามด้วยคำสั่งหลัก และ * สำหรับคำสั่งอื่น โดยใช้กฎแรกที่ตรงในแต่ละระดับ',
              )
            }}
          </p>
          <div class="mt-sm flex flex-wrap gap-xs text-xs">
            <code class="rounded bg-bg-default px-xs py-xxs">spending/add</code
            ><code class="rounded bg-bg-default px-xs py-xxs">spending</code
            ><code class="rounded bg-bg-default px-xs py-xxs">*</code>
          </div>
        </details>
      </FeatureSettingsCard>
    </template>
  </FeatureSettingsLayout>
</template>
