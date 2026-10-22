<script setup lang="ts">
import { Code2, GitBranch } from 'lucide-vue-next'

const lines = [
  [{ text: '// A little about me', kind: 'comment' }],
  [{ text: 'const ', kind: 'keyword' }, { text: 'developer = {' }],
  [{ text: '  name: ' }, { text: "'Anawat'", kind: 'string' }, { text: ',' }],
  [{ text: '  role: ' }, { text: "'Full Stack'", kind: 'string' }, { text: ',' }],
  [{ text: '  focus: ' }, { text: "'Useful software'", kind: 'string' }, { text: ',' }],
  [{ text: '  learning: ' }, { text: 'true', kind: 'keyword' }],
  [{ text: '};' }],
  [{ text: ' ' }],
  [{ text: 'export default ', kind: 'keyword' }, { text: 'developer;' }],
]
</script>

<template>
  <div class="developer-code-stage">
  <div class="developer-code">
    <div class="developer-code__tab">
      <Code2 aria-hidden="true" />
      <span>developer.ts</span>
      <span class="developer-code__type" aria-hidden="true">TS</span>
    </div>
    <pre class="developer-code__source"><code><span v-for="(line, index) in lines" :key="index" class="developer-code__line"><span class="developer-code__number" aria-hidden="true">{{ index + 1 }}</span><span><span v-for="(token, tokenIndex) in line" :key="tokenIndex" :class="'kind' in token ? `developer-code__${token.kind}` : undefined">{{ token.text }}</span></span></span></code></pre>
    <div class="developer-code__status" aria-hidden="true">
      <span><GitBranch /> main</span>
      <span>UTF-8 <span class="developer-code__language">TypeScript</span></span>
    </div>
  </div>
  </div>
</template>

<style scoped>
.developer-code-stage {
  position: relative;
  isolation: isolate;
  min-width: 0;
  perspective: 1200px;
  padding: var(--space-md);
}
.developer-code {
  position: relative;
  min-width: 0;
  overflow: hidden;
  border: 1px solid var(--semantic-color-border-border-default);
  border-radius: var(--corner-radius-md);
  background: var(--semantic-color-background-bg-surface);
  color: var(--semantic-color-text-text-primary);
  font-family: var(--font-family-mono);
  box-shadow: var(--effect-shadow-lg);
  transform: rotateX(4deg) rotateY(10deg) rotateZ(-2deg);
  transition: transform 400ms ease, box-shadow 400ms ease;
}
.developer-code-stage::before,
.developer-code-stage::after {
  position: absolute;
  inset: var(--space-md);
  z-index: -1;
  border: 1px solid var(--semantic-color-border-border-default);
  border-radius: var(--corner-radius-md);
  background: var(--semantic-color-background-bg-elevated);
  content: '';
  pointer-events: none;
}
.developer-code-stage::before {
  transform: rotateY(10deg) rotateZ(-2deg) translate(12px, 10px);
}
.developer-code-stage::after {
  transform: rotateY(10deg) rotateZ(-2deg) translate(6px, 5px);
}
@media (hover: hover) and (pointer: fine) {
  .developer-code-stage:hover .developer-code {
    transform: rotateX(0deg) rotateY(3deg) rotateZ(0deg) translateY(-4px);
    box-shadow: var(--effect-shadow-xl);
  }
}
.developer-code__tab {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  padding: var(--space-md) var(--space-lg);
  border-bottom: 1px solid var(--semantic-color-border-border-default);
  font-size: var(--font-size-label-small);
}
.developer-code__tab svg {
  width: var(--icon-size-16);
  height: var(--icon-size-16);
  color: var(--semantic-color-text-text-accent);
}
.developer-code__type {
  margin-left: auto;
  color: var(--semantic-color-text-text-secondary);
}
.developer-code__source {
  margin: 0;
  padding: var(--space-xl) var(--space-md);
  overflow-x: auto;
  font-family: inherit;
  font-size: clamp(0.6875rem, 1.15vw, 0.9375rem);
  line-height: 1.9;
  tab-size: 2;
}
.developer-code__source code {
  font-family: inherit;
}
.developer-code__line {
  display: flex;
  gap: var(--space-lg);
}
.developer-code__number {
  width: 2ch;
  flex-shrink: 0;
  color: var(--semantic-color-text-text-secondary);
  text-align: right;
  user-select: none;
}
.developer-code__comment {
  color: var(--semantic-color-text-text-secondary);
}
.developer-code__keyword {
  color: var(--semantic-color-text-text-accent);
}
.developer-code__string {
  color: var(--semantic-color-success-success-text);
}
.developer-code__status {
  display: flex;
  justify-content: space-between;
  gap: var(--space-sm);
  padding: var(--space-sm) var(--space-lg);
  border-top: 1px solid var(--semantic-color-border-border-default);
  color: var(--semantic-color-text-text-secondary);
  font-size: var(--font-size-label-small);
}
.developer-code__status > span {
  display: inline-flex;
  align-items: center;
  gap: var(--space-sm);
}
.developer-code__status svg {
  width: var(--icon-size-16);
  height: var(--icon-size-16);
}
.developer-code__language {
  margin-left: var(--space-sm);
}
@media (max-width: 47.99rem) {
  .developer-code {
    transform: rotateY(3deg) rotateZ(-1deg);
  }
  .developer-code__source {
    font-size: var(--font-size-label-small);
  }
}
@media (prefers-reduced-motion: reduce) {
  .developer-code,
  .developer-code-stage:hover .developer-code {
    transform: none;
    transition: none;
  }
  .developer-code-stage::before,
  .developer-code-stage::after {
    display: none;
  }
}
</style>
