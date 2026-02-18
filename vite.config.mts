import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
    plugins: [
        react(),
        VitePWA({
            registerType: 'autoUpdate',
            includeAssets: ['icon.png', 'icon.ico', 'robots.txt'],
            manifest: {
                name: 'QuizLab Reader',
                short_name: 'QuizLab',
                description: 'The Ultimate AI-Powered PDF Reader & Quiz Generator',
                theme_color: '#0c0a09',
                icons: [
                    {
                        src: 'icon.png',
                        sizes: '192x192',
                        type: 'image/png'
                    },
                    {
                        src: 'icon.png',
                        sizes: '512x512',
                        type: 'image/png'
                    }
                ]
            },
            workbox: {
                globPatterns: ['**/*.{js,css,html,ico,png,svg,json,pdf,woff2,ttf}']
            }
        })
    ],
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
                    'vendor-query': ['@tanstack/react-query'],
                    'vendor-ui': [
                        '@headlessui/react',
                        'framer-motion',
                        'lucide-react',
                        'styled-components',
                        'react-colorful',
                        'react-virtuoso'
                    ],
                    'vendor-pdf': [
                        'pdfjs-dist',
                        '@react-pdf-viewer/core',
                        '@react-pdf-viewer/page-navigation',
                        '@react-pdf-viewer/scroll-mode',
                        '@react-pdf-viewer/search',
                        '@react-pdf-viewer/zoom'
                    ],
                    'vendor-utils': ['dompurify', 'workbox-window']
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
            '@features': path.resolve(__dirname, 'src/features'),
            '@platform': path.resolve(__dirname, 'src/platform')
        }
    },
    server: {
        port: 5173,
        strictPort: true
    }
})
