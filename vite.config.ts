import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  base: '/calendar/',
  build: {
    target: 'es2020',
    outDir: 'dist/calendar',
    rollupOptions: {
      output: {
        manualChunks: (id: string) => {
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom')) return 'react-vendor'
          // firebase/firestore は動的インポートのため自動分割される
          // firebase/auth と firebase/app のみ eager chunk に含める
          if (id.includes('node_modules/firebase') || id.includes('node_modules/@firebase')) {
            if (id.includes('@firebase/firestore') || id.includes('/firestore/')) return undefined
            return 'firebase'
          }
          if (id.includes('node_modules/@sentry')) return 'sentry'
        },
      },
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.png', 'apple-touch-icon.png', 'logo.svg'],
      manifest: {
        name: 'ぽいロボ',
        short_name: 'ぽいロボ',
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
        globPatterns: ['**/*.{js,css,html,ico,png,svg,json,webp,woff2}'],
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
          {
            // Firebase Firestore REST API
            urlPattern: /^https:\/\/firestore\.googleapis\.com/,
            handler: 'NetworkOnly',
          },
          {
            // NHK ニュース等の外部コンテンツ
            urlPattern: /^https:\/\/(www3\.nhk\.or\.jp|www\.nhk\.or\.jp)/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'news-api',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 10 },
              networkTimeoutSeconds: 5,
            },
          },
        ],
      },
    }),
  ],
})
