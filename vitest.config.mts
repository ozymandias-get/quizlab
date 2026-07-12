import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { viteAliases } from './vite.aliases.mts'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    pool: 'threads',
    maxWorkers: 4,
    setupFiles: './src/__tests__/setup.ts',
    include: [
      'src/__tests__/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
      'electron/__tests__/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'
    ],
    exclude: [
      'src/__tests__/setup.ts',
      'dist/**',
      'dist-electron/**',
      'release/**',
      'coverage/**',
      '.cache/**',
      'node_modules/**'
    ],
    environmentMatchGlobs: [
      ['electron/__tests__/app/**', 'node'],
      ['electron/__tests__/core/**', 'node'],
      ['electron/__tests__/features/pdf/**', 'node'],
      ['electron/__tests__/features/screenshot/**', 'node'],
      ['electron/__tests__/features/ai/**', 'node'],
      ['electron/__tests__/features/gemini-web-session/**', 'node'],
      ['electron/__tests__/features/native-messaging/**', 'node'],
      ['electron/__tests__/preload/**', 'node']
    ],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}', 'electron/**/*.ts', 'shared/**/*.ts'],
      exclude: [
        '**/*.d.ts',
        '**/__tests__/**',
        'src/__tests__/setup.ts',
        'dist/**',
        'release/**',
        'node_modules/**'
      ],
      reporter: ['text', 'lcov'],
      thresholds: {
        lines: 50,
        statements: 48,
        functions: 47,
        branches: 41,
        'electron/features/gemini-web-session/**/*.ts': {
          lines: 60,
          statements: 59,
          branches: 56,
          functions: 46
        },
        '**/features/pdf/**/*.ts': {
          lines: 59,
          statements: 55,
          branches: 50,
          functions: 50
        },
        'electron/features/automation/**/*.ts': {
          lines: 57,
          statements: 57,
          branches: 55,
          functions: 45
        },
        'electron/core/**/*.ts': {
          lines: 43,
          statements: 41,
          branches: 37,
          functions: 54
        },
        'electron/features/ai/apiChatHandlers/**/*.ts': {
          lines: 21,
          statements: 22,
          branches: 31,
          functions: 24
        }
      }
    }
  },
  resolve: {
    alias: viteAliases
  }
})
