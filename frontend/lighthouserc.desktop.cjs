// Lighthouse CI loads CommonJS configuration files directly.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const mobile = require('./lighthouserc.mobile.cjs')

module.exports = {
  ci: {
    ...mobile.ci,
    collect: {
      ...mobile.ci.collect,
      settings: {
        preset: 'desktop',
        throttlingMethod: 'provided',
      },
    },
    upload: { target: 'filesystem', outputDir: '.lighthouseci/desktop' },
  },
}
