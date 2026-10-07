<template>
  <button type="button" class="discord-preview-button">
    <span class="preview-button-content"><slot /></span>
  </button>
</template>

<style scoped>
/* Discord message controls: https://discord.com/app */
.discord-preview-button {
  --button-background: var(--discord-button-secondary);
  --button-hover: var(--discord-button-secondary-hover);
  --button-active: var(--discord-button-secondary-active);
  --button-border: var(--discord-button-secondary-border);
  --button-text: var(--discord-text);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  min-height: 32px;
  min-width: 0;
  max-width: 100%;
  padding: 2px var(--space-md);
  border: 1px solid var(--button-border);
  border-radius: var(--corner-radius-md);
  background: var(--button-background);
  color: var(--button-text);
  font-family: inherit;
  font-size: var(--discord-embed-size);
  font-weight: var(--typography-font-weight-medium);
  line-height: 16px;
  text-decoration: none;
  cursor: pointer;
  transition: background-color 200ms ease;
}
.discord-preview-button:is(.preview-button--primary, .preview-button--1) {
  --button-background: var(--discord-button-primary);
  --button-hover: var(--discord-button-primary-hover);
  --button-active: var(--discord-button-primary-active);
  --button-border: var(--discord-button-accent-border);
  --button-text: var(--discord-on-accent);
}
.discord-preview-button:is(.preview-button--success, .preview-button--3) {
  --button-background: var(--discord-button-success);
  --button-hover: var(--discord-button-success-hover);
  --button-active: var(--discord-button-success-active);
  --button-border: var(--discord-button-accent-border);
  --button-text: var(--discord-on-accent);
}
.discord-preview-button:is(.preview-button--danger, .preview-button--4) {
  --button-background: var(--discord-button-danger);
  --button-hover: var(--discord-button-danger-hover);
  --button-active: var(--discord-button-danger-active);
  --button-border: var(--discord-button-accent-border);
  --button-text: var(--discord-on-accent);
}
.discord-preview-button:hover:not(:disabled) {
  background: var(--button-hover);
}
.discord-preview-button:active:not(:disabled) {
  background: var(--button-active);
}
.discord-preview-button:focus-visible {
  outline: 2px solid var(--discord-link);
  outline-offset: 2px;
}
.discord-preview-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.preview-button-content {
  display: inline-flex;
  align-items: center;
  gap: var(--space-xxs);
  min-width: 0;
  max-width: 100%;
  width: 100%;
  justify-content: inherit;
  overflow: hidden;
  white-space: nowrap;
}
.preview-button-content :deep(span:last-child) {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}
.preview-button-content :deep(span:not(:last-child)) {
  flex: 0 0 auto;
}
.preview-button-content :deep(.discord-unicode-emoji),
.preview-button-content :deep(.discord-custom-emoji) {
  display: inline-block;
  width: 20px;
  height: 20px;
  margin: 0;
  vertical-align: middle;
  object-fit: contain;
}
@media (prefers-reduced-motion: reduce) {
  .discord-preview-button {
    transition: none;
  }
}
</style>
