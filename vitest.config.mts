import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { viteAliases } from './config/vite.aliases.mts'

const TEST_FILES = '**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'

const COMMON_EXCLUDES = [
  'src/__tests__/setup.ts',
  'dist/**',
  'dist-electron/**',
  'release/**',
  'coverage/**',
  '.cache/**',
  'node_modules/**'
]

/**
 * These paths were listed in the old `environmentMatchGlobs` option, which
 * Vitest removed in v4. They now form an explicit Node project; everything else
 * (including automation and ai-view tests that touch the DOM) stays in jsdom.
 */
const NODE_TESTS = [
  `electron/__tests__/app/${TEST_FILES}`,
  `electron/__tests__/core/${TEST_FILES}`,
  `electron/__tests__/features/pdf/${TEST_FILES}`,
  `electron/__tests__/features/screenshot/${TEST_FILES}`,
  `electron/__tests__/features/ai/${TEST_FILES}`,
  `electron/__tests__/features/web-session/${TEST_FILES}`,
  `electron/__tests__/features/native-messaging/${TEST_FILES}`,
  `electron/__tests__/features/shell-open/${TEST_FILES}`,
  `electron/__tests__/preload/${TEST_FILES}`
]

export default defineConfig({
  test: {
    projects: [
      {
        plugins: [react()],
        resolve: { alias: viteAliases },
        test: {
          name: 'renderer',
          environment: 'jsdom',
          globals: true,
          pool: 'threads',
          maxWorkers: 4,
          // Vitest 5 flips this default to true. Suites such as
          // electron/__tests__/features/ai/apiChatHandlers/*.test.ts rely on the IPC
          // handler registrations recorded during the first test of the file, so
          // clearing the history before every test would make the later ones look up
          // an unregistered channel.
          clearMocks: false,
          setupFiles: './src/__tests__/setup.ts',
          include: [`src/__tests__/${TEST_FILES}`, `electron/__tests__/${TEST_FILES}`],
          exclude: [...COMMON_EXCLUDES, ...NODE_TESTS]
        }
      },
      {
        resolve: { alias: viteAliases },
        test: {
          name: 'main',
          environment: 'node',
          globals: true,
          pool: 'threads',
          maxWorkers: 4,
          clearMocks: false,
          setupFiles: './src/__tests__/setup.ts',
          include: NODE_TESTS,
          exclude: COMMON_EXCLUDES
        }
      }
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
        'electron/features/web-session/**/*.ts': {
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
          functions: 48
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
