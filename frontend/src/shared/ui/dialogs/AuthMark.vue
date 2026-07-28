<template>
  <svg class="auth-mark" viewBox="0 0 32 32" fill="none" aria-hidden="true">
    <path d="M12.5 6 23 27H2L12.5 6Z" fill="currentColor" />
    <path d="M19.5 6 30 27H9L19.5 6Z" fill="url(#auth-mark-gradient)" />
    <defs>
      <linearGradient
        id="auth-mark-gradient"
        x1="19.5"
        y1="6"
        x2="19.5"
        y2="27"
        gradientUnits="userSpaceOnUse"
      >
        <stop stop-color="#00e5ff" />
        <stop offset="1" stop-color="#2979ff" />
      </linearGradient>
    </defs>
  </svg>
</template>

<style scoped>
.auth-mark {
  display: block;
  width: 100%;
  height: 100%;
  color: var(--semantic-color-text-text-primary);
}
</style>
