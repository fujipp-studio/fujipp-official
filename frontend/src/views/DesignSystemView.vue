<script setup lang="ts">
import { ref } from 'vue'

import { AppFooter, AppNavbar } from '../shared/layout'
import { AppButton, AppTextField } from '../shared/ui'
import { icons } from '../config'

const textFieldValue = ref('Text')
const emptyTextFieldValue = ref('')
const dropdownValue = ref('thb')
const emptyDropdownValue = ref('')
const secretFieldValue = ref('fujipp-secret')
const fieldOptions = [
  { label: 'Thai Baht', value: 'thb' },
  { label: 'US Dollar', value: 'usd' },
  { label: 'Japanese Yen', value: 'jpy' },
] as const
</script>

<template>
  <main class="design-system">
    <section class="component-section" aria-labelledby="navbar-heading">
      <div class="section-heading">
        <p>Layout / Navigation</p>
        <h1 id="navbar-heading">Navbar</h1>
        <span>Authentication: Off</span>
      </div>

      <div class="component-preview">
        <AppNavbar />
      </div>
    </section>

    <section class="component-section" aria-labelledby="navbar-auth-heading">
      <div class="section-heading">
        <p>Layout / Navigation</p>
        <h2 id="navbar-auth-heading">Navbar</h2>
        <span>Authentication: On</span>
      </div>

      <div class="component-preview">
        <AppNavbar authenticated />
      </div>
    </section>

    <section class="component-section" aria-labelledby="button-heading">
      <div class="section-heading">
        <p>Actions / Buttons</p>
        <h2 id="button-heading">Button</h2>
        <span>Primary and Secondary</span>
      </div>

      <div class="component-preview component-preview--buttons">
        <div class="button-example">
          <span>Primary</span>
          <AppButton :left-icon="icons.base.add" :right-icon="icons.base.arrowRight">
            Button
          </AppButton>
        </div>

        <div class="button-example">
          <span>Secondary</span>
          <AppButton
            variant="secondary"
            :left-icon="icons.base.add"
            :right-icon="icons.base.arrowRight"
          >
            Button
          </AppButton>
        </div>

        <div class="button-example">
          <span>Primary / Disabled</span>
          <AppButton disabled :left-icon="icons.base.add" :right-icon="icons.base.arrowRight">
            Button
          </AppButton>
        </div>

        <div class="button-example">
          <span>Secondary / Disabled</span>
          <AppButton
            variant="secondary"
            disabled
            :left-icon="icons.base.add"
            :right-icon="icons.base.arrowRight"
          >
            Button
          </AppButton>
        </div>
      </div>
    </section>

    <section class="component-section" aria-labelledby="footer-heading">
      <div class="section-heading">
        <p>Layout / Footer</p>
        <h2 id="footer-heading">Footer</h2>
        <span>Default</span>
      </div>

      <div class="component-preview">
        <AppFooter />
      </div>
    </section>

    <section class="component-section" aria-labelledby="text-field-heading">
      <div class="section-heading">
        <p>Forms / Fields</p>
        <h2 id="text-field-heading">Text Field</h2>
        <span>Text, Dropdown and States</span>
      </div>

      <div class="component-preview component-preview--fields">
        <AppTextField
          v-model="textFieldValue"
          label="Filled"
          unit="฿"
          support-text="Support text"
        />
        <AppTextField
          v-model="emptyTextFieldValue"
          label="Empty"
          unit="฿"
          support-text="Support text"
        />
        <AppTextField
          v-model="textFieldValue"
          state="focused"
          label="Focused"
          unit="฿"
          support-text="Support text"
        />
        <AppTextField
          v-model="textFieldValue"
          state="error"
          label="Error"
          unit="฿"
          support-text="Support text"
        />
        <AppTextField
          v-model="textFieldValue"
          label="Disabled"
          unit="฿"
          support-text="Support text"
          disabled
        />
        <AppTextField
          v-model="dropdownValue"
          variant="dropdown"
          label="Dropdown / Filled"
          :options="fieldOptions"
          support-text="Support text"
        />
        <AppTextField
          v-model="emptyDropdownValue"
          variant="dropdown"
          label="Dropdown / Empty"
          :options="fieldOptions"
          support-text="Support text"
        />
        <AppTextField
          v-model="secretFieldValue"
          variant="secret"
          label="Secret"
          placeholder="Enter password"
          support-text="Click the character to show or hide the password"
        />
      </div>
    </section>
  </main>
</template>

<style scoped>
.design-system {
  display: grid;
  align-content: start;
  gap: var(--space-2xl);
  min-height: 100vh;
  padding: var(--space-2xl) var(--space-md);
  background: var(--semantic-color-background-bg-surface);
  color: var(--semantic-color-text-text-primary);
}

.component-section {
  display: grid;
  width: min(100%, 80rem);
  margin-inline: auto;
  gap: var(--space-md);
}

.section-heading {
  display: grid;
  gap: var(--space-xxs);
}

.section-heading p,
.section-heading span {
  color: var(--semantic-color-text-text-secondary);
  font-size: var(--font-size-body-small);
  line-height: var(--line-height-body);
}

.section-heading h1,
.section-heading h2 {
  font-size: var(--font-size-heading-h2);
  font-weight: var(--typography-font-weight-bold);
  line-height: var(--line-height-heading);
}

.component-preview {
  overflow: hidden;
  border: 1px solid var(--semantic-color-border-border-subtle);
  border-radius: var(--corner-radius-md);
  background: var(--semantic-color-background-bg-default);
}

.component-preview--buttons {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-lg);
  padding: var(--space-lg);
}

.component-preview--fields {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 17rem), 1fr));
  gap: var(--space-lg);
  padding: var(--space-lg);
}

.button-example {
  display: grid;
  width: min(100%, 15rem);
  gap: var(--space-xs);
}

.button-example > span {
  color: var(--semantic-color-text-text-secondary);
  font-size: var(--font-size-label-medium);
  line-height: var(--line-height-label);
}
</style>
