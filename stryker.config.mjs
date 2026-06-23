/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
const config = {
  mutate: [
    'src/**/*.{ts,tsx}',
    'electron/**/*.ts',
    'shared/**/*.ts',
    '!**/*.test.*',
    '!**/*.spec.*',
    '!**/__tests__/**',
    '!**/*.d.ts',
    '!**/setup.ts'
  ],
  testRunner: 'vitest',
  vitest: {
    projectFile: 'vitest.config.mts'
  },
  coverageAnalysis: 'perTest',
  reporters: ['html', 'clear-text', 'progress'],
  thresholds: {
    high: 80,
    low: 60
  },
  timeoutMS: 30000,
  concurrency: 2,
  jsdoc: {
    parse: 'typescript'
  },
  dashboard: {
    reportType: 'json'
  }
}

export default config
