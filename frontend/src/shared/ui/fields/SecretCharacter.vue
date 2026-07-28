<script setup lang="ts">
withDefaults(
  defineProps<{
    awake?: boolean
    gaze?: number
  }>(),
  {
    awake: false,
    gaze: 0,
  },
)
</script>

<template>
  <svg
    class="secret-character"
    :class="{ 'secret-character--awake': awake }"
    viewBox="0 0 144 205"
    fill="none"
    aria-hidden="true"
  >
    <path
      d="M143.459 178.194V72.0063C143.459 32.3341 111.345 0 71.7297 0C32.1145 0 0 32.3341 0 72.0063V178.194C0 185.316 2.006 191.771 5.258 196.451C8.51 201.13 13.019 204.047 18.019 204.047C23.02 204.047 27.529 201.13 30.78 196.451C33.476 192.572 35.315 187.473 35.866 181.785C36.421 187.473 38.279 192.573 41.001 196.452C44.284 201.131 48.836 204.047 53.884 204.047C58.932 204.047 63.484 201.131 66.767 196.452C69.489 192.573 71.346 187.473 71.902 181.785C72.453 187.473 74.292 192.572 76.988 196.451C80.239 201.13 84.748 204.047 89.749 204.047C94.749 204.047 99.258 201.13 102.51 196.451C105.204 192.574 107.043 187.478 107.595 181.794C108.146 187.478 109.985 192.574 112.679 196.451C115.931 201.13 120.44 204.047 125.44 204.047C130.441 204.047 134.95 201.13 138.201 196.451C141.453 191.771 143.459 185.316 143.459 178.194Z"
      fill="url(#secret-character-gradient)"
    />

    <g
      class="secret-character__open-eyes"
      :style="{ transform: `translateX(${gaze}px)` }"
    >
      <circle cx="38.216" cy="72.006" r="26.541" fill="black" />
      <circle cx="105.59" cy="72.006" r="26.541" fill="black" />
      <circle cx="28.621" cy="62.192" r="9.596" fill="white" />
      <circle cx="95.994" cy="62.192" r="9.596" fill="white" />
      <ellipse cx="46.383" cy="80.185" rx="4.9" ry="5.111" fill="white" />
      <ellipse cx="113.756" cy="80.185" rx="4.9" ry="5.111" fill="white" />
    </g>

    <g class="secret-character__closed-eyes">
      <path
        d="M64.757 76.5C64.757 91.179 52.874 76 38.216 76C23.558 76 11.675 91.179 11.675 76.5C11.675 61.821 23.558 69.5 38.216 69.5C52.874 69.5 64.757 61.821 64.757 76.5Z"
        fill="black"
      />
      <path
        d="M132.131 76.5C132.131 91.179 120.248 76 105.59 76C90.932 76 79.049 91.179 79.049 76.5C79.049 61.821 90.932 69.5 105.59 69.5C120.248 69.5 132.131 61.821 132.131 76.5Z"
        fill="black"
      />
    </g>

    <defs>
      <linearGradient
        id="secret-character-gradient"
        x1="71.73"
        y1="0"
        x2="71.73"
        y2="204.047"
        gradientUnits="userSpaceOnUse"
      >
        <stop stop-color="#00e5ff" />
        <stop offset="1" stop-color="#2979ff" />
      </linearGradient>
    </defs>
  </svg>
</template>

<style scoped>
.secret-character {
  display: block;
  width: 100%;
  height: 100%;
}

.secret-character__open-eyes,
.secret-character__closed-eyes {
  transform-box: fill-box;
  transform-origin: center;
  transition:
    opacity 180ms ease,
    transform 220ms cubic-bezier(0.22, 1, 0.36, 1);
}

.secret-character__open-eyes {
  opacity: 0;
}

.secret-character__closed-eyes {
  opacity: 1;
}

.secret-character--awake .secret-character__open-eyes {
  opacity: 1;
}

.secret-character--awake .secret-character__closed-eyes {
  opacity: 0;
  transform: scaleY(0.6);
}

@media (prefers-reduced-motion: reduce) {
  .secret-character__open-eyes,
  .secret-character__closed-eyes {
    transition: none;
  }
}
</style>
