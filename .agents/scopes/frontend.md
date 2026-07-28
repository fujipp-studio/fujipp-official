# Frontend Rules

## Stack and Structure

- Keep the frontend application under `frontend/`.
- Use Vue 3, Vite, TypeScript, Vue Router, Pinia, and Tailwind CSS v4.
- Use Bun for dependency installation and scripts. Commit `frontend/bun.lock` and do not
  create a second package-manager lockfile.
- Keep application source under `frontend/src/` and global styles under
  `frontend/src/styles/`.
- Never commit `node_modules/`, `dist/`, local editor settings, or real `.env` files.

## TypeScript and Vue

- Use `<script setup lang="ts">` for Vue single-file components.
- Keep components focused and move shared state into Pinia only when it is used across
  components or routes.
- Use Vue Router for page navigation instead of manually switching page components.
- Keep browser and environment access behind typed helpers when it is shared or requires
  fallback behavior.

## Styling and Design Tokens

- Treat `frontend/src/style.css` as the global style entry point. Keep it limited to
  ordered imports.
- Use Global color tokens only as primitive values. Components must consume Semantic
  color tokens through Tailwind utilities or Semantic CSS variables.
- Support Light and Dark modes through Semantic tokens. Do not duplicate theme-specific
  colors inside components.
- Use the shared Typography, Spacing, Radius, Effects, Icon Size, Gradient, and Layout
  tokens instead of introducing arbitrary values.
- Use `page-container` only for page-level content width and responsive gutters, not for
  individual components.
- Keep Mobile as the default responsive mode. Use the shared `tablet`, `desktop`, and
  `wide` breakpoints for larger layouts.
- Prefer Tailwind utilities for layout and common styling. Use scoped CSS for complex,
  component-specific styling that is clearer in CSS.
- Preserve visible keyboard focus states and honor reduced-motion preferences for
  decorative animation.

## Components and Accessibility

- Build reusable primitives for repeated controls such as buttons, inputs, dialogs, and
  cards instead of copying markup between pages.
- Use semantic HTML before adding ARIA. Add ARIA only when native semantics do not express
  the interaction.
- Ensure interactive elements work with a keyboard and expose an accessible name.
- Provide meaningful alternative text for informative images and empty alternative text
  for decorative images.

## Validation

- Do not run the full validation suite or capture screenshots after every implementation
  step unless the user explicitly requests it. During iteration, run only focused checks
  needed to diagnose risk or verify the current change.
- Before committing or pushing frontend changes, run `bun run build`,
  `bun run test:unit --run`, and `bun run lint`, then review any automatic fixes.
- Before committing or pushing user-interface changes, open the affected page, verify
  its interactions, responsive layouts, and Light/Dark themes, and capture screenshots
  of the relevant Desktop and Mobile states for visual QA.
- Do not report a frontend change as ready to commit or push until the required
  validation and visual QA have passed.
- Do not weaken TypeScript, lint, or test configuration to bypass a failure.
