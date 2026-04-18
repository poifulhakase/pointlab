import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  base: '/calendar/',
  build: {
    outDir: 'dist/calendar',
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.png', 'apple-touch-icon.png', 'logo.svg'],
      manifest: {
        name: 'ぽいらぼ',
        short_name: 'ぽいらぼ',
        description: '株式投資家向けマーケットカレンダー',
        theme_color: '#141623',
        background_color: '#141623',
        display: 'standalone',
        start_url: '/calendar/',
        scope: '/calendar/',
        lang: 'ja',
        icons: [
          {
            src: 'icon-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'icon-512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: 'icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,json}'],
        runtimeCaching: [
          {
            // Yahoo Finance / プロキシ経由のデータはネットワーク優先
            urlPattern: /^https:\/\/(api\.allorigins\.win|api\.codetabs\.com|query[12]\.finance\.yahoo\.com)/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'external-api',
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 30 },
            },
          },
        ],
      },
    }),
  ],
})
