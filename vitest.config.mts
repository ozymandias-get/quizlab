import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { viteAliases } from './vite.aliases.mts'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
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
        lines: 52,
        statements: 50,
        functions: 45,
        branches: 42,
        'electron/features/gemini-web-session/**/*.ts': {
          lines: 58,
          statements: 55,
          branches: 44,
          functions: 41
        },
        '**/features/pdf/**/*.ts': {
          lines: 43,
          statements: 41,
          branches: 36,
          functions: 40
        },
        'electron/features/automation/**/*.ts': {
          lines: 65,
          statements: 63,
          branches: 55,
          functions: 66
        }
      }
    }
  },
  resolve: {
    alias: viteAliases
  }
})
