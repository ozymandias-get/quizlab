import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
    plugins: [react()],
    root: './src',
    publicDir: 'public',
    base: './',
    build: {
        outDir: '../dist',
        emptyOutDir: true,
        rollupOptions: {
            onwarn(warning, warn) {
                if (
                    warning.code === 'EVAL' &&
                    typeof warning.id === 'string' &&
                    warning.id.includes('pdfjs-dist/build/pdf.js')
                ) {
                    return
                }
                warn(warning)
            },
            output: {
                manualChunks: {
                    'vendor-react': ['react', 'react-dom'],
                    'vendor-ui': ['@headlessui/react', 'framer-motion', 'lucide-react', 'styled-components'],
                    'vendor-pdf': [
                        'pdfjs-dist',
                        '@react-pdf-viewer/core',
                        '@react-pdf-viewer/page-navigation',
                        '@react-pdf-viewer/scroll-mode',
                        '@react-pdf-viewer/search',
                        '@react-pdf-viewer/zoom'
                    ]
                }
            }
        }
    },
    resolve: {
        alias: {
            '@src': path.resolve(__dirname, 'src'),
            '@shared': path.resolve(__dirname, 'shared'),
            '@electron': path.resolve(__dirname, 'electron'),
            '@ui': path.resolve(__dirname, 'src/components/ui'),
            '@features': path.resolve(__dirname, 'src/features')
        }
    },
    server: {
        port: 5173,
        strictPort: true
    }
})
