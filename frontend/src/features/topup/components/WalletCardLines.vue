<template>
  <svg
    class="wallet-card-lines"
    viewBox="0 0 320 202"
    preserveAspectRatio="xMaxYMid slice"
    aria-hidden="true"
    focusable="false"
  >
    <path
      d="M330-40C190 0 150 80 170 170S280 260 340 240M350-30C220 10 178 90 198 172S286 234 344 214M370-20C250 18 207 100 226 174S290 209 348 188"
    />
  </svg>
</template>

<style scoped>
.wallet-card-lines {
  position: absolute;
  z-index: -1;
  inset: 0;
  width: 100%;
  height: 100%;
  fill: none;
  stroke: currentColor;
  stroke-width: 0.6;
  opacity: 0.13;
  pointer-events: none;
}
</style>
