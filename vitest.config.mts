import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

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
    alias: {
      // Project aliases for test runtime
      '@app': path.resolve(__dirname, 'src/app'),
      '@shared': path.resolve(__dirname, 'src/shared'),
      '@shared-core': path.resolve(__dirname, 'shared'),
      '@electron': path.resolve(__dirname, 'electron'),
      '@ui': path.resolve(__dirname, 'src/shared/ui'),
      '@features': path.resolve(__dirname, 'src/features'),
      '@platform': path.resolve(__dirname, 'src/platform')
    }
  }
})
