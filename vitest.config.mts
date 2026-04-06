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
    exclude: ['src/__tests__/setup.ts'],
    coverage: {
      provider: 'v8'
    }
  },
  resolve: {
    alias: viteAliases
  }
})
