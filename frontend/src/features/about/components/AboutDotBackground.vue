<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'

const canvas = ref<HTMLCanvasElement>()
const gridSpacing = 32
const dotRadius = 1
const hoverRadius = 112
const hoverScale = 22

type BackgroundDot = {
  x: number
  y: number
  scale: number
}

let dots: BackgroundDot[] = []
let bounds = { width: 0, height: 0 }
let resizeObserver: ResizeObserver | undefined
let themeObserver: MutationObserver | undefined
let frame: number | undefined
let pointer = { x: 0, y: 0 }
let pointerTarget = { x: 0, y: 0 }
let pointerActive = false
let motionReduced = false

function syncDots(width: number, height: number) {
  if (bounds.width === width && bounds.height === height && dots.length > 0) return

  bounds = { width, height }
  dots = []

  for (let y = gridSpacing / 2; y < height + gridSpacing; y += gridSpacing) {
    for (let x = gridSpacing / 2; x < width + gridSpacing; x += gridSpacing) {
      dots.push({ x, y, scale: 1 })
    }
  }
}

function draw() {
  const element = canvas.value
  const context = element?.getContext('2d')
  if (!element || !context) return false

  const rect = element.getBoundingClientRect()
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2)
  const renderWidth = Math.max(1, Math.round(rect.width * pixelRatio))
  const renderHeight = Math.max(1, Math.round(rect.height * pixelRatio))

  if (element.width !== renderWidth || element.height !== renderHeight) {
    element.width = renderWidth
    element.height = renderHeight
  }

  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0)
  context.clearRect(0, 0, rect.width, rect.height)
  syncDots(rect.width, rect.height)

  const tokens = getComputedStyle(document.documentElement)
  const dotColor = tokens.getPropertyValue('--semantic-color-text-text-primary').trim()
  const accentColor = tokens.getPropertyValue('--semantic-color-text-text-accent').trim()
  let dotsAreMoving = false

  for (const dot of dots) {
    const distance = Math.hypot(dot.x - pointer.x, dot.y - pointer.y)
    const proximity = pointerActive && distance < hoverRadius ? 1 - distance / hoverRadius : 0
    const targetScale = 1 + (hoverScale - 1) * proximity ** 3
    const easing = targetScale > dot.scale ? 0.14 : 0.035
    dot.scale += (targetScale - dot.scale) * easing

    if (Math.abs(targetScale - dot.scale) > 0.01) dotsAreMoving = true

    context.beginPath()
    context.arc(dot.x, dot.y, dotRadius * dot.scale, 0, Math.PI * 2)
    context.fillStyle = dot.scale > 1.1 ? accentColor : dotColor
    context.globalAlpha = dot.scale > 1.1 ? 0.95 : 0.14
    context.fill()
  }

  context.globalAlpha = 1
  return dotsAreMoving
}

function animate() {
  pointer.x += (pointerTarget.x - pointer.x) * 0.32
  pointer.y += (pointerTarget.y - pointer.y) * 0.32

  const pointerIsMoving =
    Math.abs(pointerTarget.x - pointer.x) > 0.1 || Math.abs(pointerTarget.y - pointer.y) > 0.1
  const dotsAreMoving = draw()

  if (pointerActive || pointerIsMoving || dotsAreMoving) {
    frame = window.requestAnimationFrame(animate)
    return
  }

  frame = undefined
}

function requestDraw() {
  if (frame !== undefined) return
  frame = window.requestAnimationFrame(animate)
}

function handlePointerMove(event: PointerEvent) {
  if (event.pointerType === 'touch' || motionReduced) return
  pointerTarget = { x: event.clientX, y: event.clientY }
  pointerActive = true
  requestDraw()
}

function handlePointerLeave() {
  pointerActive = false
  requestDraw()
}

onMounted(() => {
  const element = canvas.value
  if (!element) return

  motionReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  pointer = { x: element.clientWidth / 2, y: element.clientHeight / 2 }
  pointerTarget = { ...pointer }
  resizeObserver = new ResizeObserver(() => draw())
  resizeObserver.observe(element)
  themeObserver = new MutationObserver(() => draw())
  themeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme'],
  })
  window.addEventListener('pointermove', handlePointerMove)
  document.addEventListener('pointerleave', handlePointerLeave)
  draw()
})

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  themeObserver?.disconnect()
  window.removeEventListener('pointermove', handlePointerMove)
  document.removeEventListener('pointerleave', handlePointerLeave)
  if (frame !== undefined) window.cancelAnimationFrame(frame)
})
</script>

<template>
  <canvas ref="canvas" class="about-dot-background" aria-hidden="true" />
</template>

<style scoped>
.about-dot-background {
  position: fixed;
  z-index: 0;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}
</style>
