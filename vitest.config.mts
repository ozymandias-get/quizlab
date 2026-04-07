import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { viteAliases } from './vite.aliases.mts'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    environmentMatchGlobs: [
      ['electron/**/*.dom.test.{ts,tsx,js,jsx,mts,cts,mjs,cjs}', 'jsdom'],
      ['electron/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}', 'node'],
      ['**/*.node.test.{ts,tsx,js,jsx,mts,cts,mjs,cjs}', 'node']
    ],
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
      all: true,
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
        lines: 70,
        functions: 70,
        statements: 70,
        branches: 55
      }
    }
  },
  resolve: {
    alias: viteAliases
  }
})
