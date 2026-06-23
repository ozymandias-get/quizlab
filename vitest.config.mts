import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { viteAliases } from './vite.aliases.mts'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    pool: 'threads',
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
        lines: 75,
        statements: 70,
        functions: 65,
        branches: 60,
        'electron/features/gemini-web-session/**/*.ts': {
          lines: 75,
          statements: 70,
          branches: 65,
          functions: 65
        },
        '**/features/pdf/**/*.ts': {
          lines: 65,
          statements: 60,
          branches: 55,
          functions: 55
        },
        'electron/features/automation/**/*.ts': {
          lines: 75,
          statements: 70,
          branches: 65,
          functions: 70
        },
        'electron/core/**/*.ts': {
          lines: 80,
          statements: 75,
          branches: 65,
          functions: 70
        },
        'electron/features/ai/apiChatHandlers/**/*.ts': {
          lines: 85,
          statements: 80,
          branches: 75,
          functions: 80
        }
      }
    }
  },
  resolve: {
    alias: viteAliases
  }
})
