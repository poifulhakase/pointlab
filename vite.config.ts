import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import type { IncomingMessage, ServerResponse } from 'node:http'

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
    {
      name: 'local-api',
      configureServer(server) {
        server.middlewares.use('/api/stocks-daily', async (req: IncomingMessage, res: ServerResponse) => {
          if (req.method !== 'GET') { res.statusCode = 405; res.end('Method Not Allowed'); return }
          let statusCode = 200
          const expRes = {
            setHeader: (name: string, val: string) => res.setHeader(name, val),
            status(code: number) { statusCode = code; return expRes },
            json(data: unknown) {
              res.statusCode = statusCode
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify(data))
            },
          }
          try {
            // @ts-ignore — no type declarations for Vercel serverless handler
            const { default: handler } = await import('./api/stocks-daily.js')
            await handler(req, expRes)
          } catch (e) {
            res.statusCode = 500
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: String(e) }))
          }
        })
      },
    },
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.png', 'favicon.svg', 'apple-touch-icon.png', 'logo.svg'],
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
            src: 'icon-512-maskable.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        clientsClaim: true,
        // JS/CSS/HTML とコアアイコンのみプリキャッシュ。
        // data/*.json（頻繁に更新）と notes/*.webp（多数・大容量）は除外してランタイムキャッシュへ
        globPatterns: ['**/*.{js,css,html,svg,woff2}', 'favicon*.{ico,png}', 'apple-touch-icon.png', 'icon-192.png', 'icon-512.png', 'icon-512-maskable.png', 'logo.svg'],
        globIgnores: ['**/data/**', '**/notes/**'],
        runtimeCaching: [
          {
            // 市場データ JSON（頻繁に更新）— 古いキャッシュで即表示しつつバックグラウンド更新
            urlPattern: /\/calendar\/data\//,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'market-data',
              expiration: { maxEntries: 40, maxAgeSeconds: 60 * 60 * 24 * 7 },
            },
          },
          {
            // 記事サムネイル WebP — 変更まれ → 長めにキャッシュ
            urlPattern: /\/calendar\/notes\//,
            handler: 'CacheFirst',
            options: {
              cacheName: 'note-images',
              expiration: { maxEntries: 60, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
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
