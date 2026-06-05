import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { sentryVitePlugin } from '@sentry/vite-plugin'
import type { IncomingMessage, ServerResponse } from 'node:http'

// Sentry ソースマップのアップロードはビルド時にトークンがある場合のみ有効化する。
// org / project / authToken は環境変数（Vercel に設定）から読む。コードにスラッグを埋め込まない。
//   SENTRY_ORG / SENTRY_PROJECT / SENTRY_AUTH_TOKEN
// トークン未設定（ローカル開発など）では disable=true となりアップロードをスキップする。
const SENTRY_AUTH_TOKEN = process.env.SENTRY_AUTH_TOKEN

// https://vite.dev/config/
export default defineConfig({
  base: '/calendar/',
  esbuild: {
    // 本番ビルドで console.log / debugger を全削除（バンドルサイズ削減 + 実行時オーバーヘッド低減）
    drop: ['console', 'debugger'],
  },
  build: {
    target: 'es2020',
    outDir: 'dist/calendar',
    // Sentry へアップロードするためソースマップを生成する。'hidden' は .map を出力しつつ
    // 配信 JS には sourceMappingURL コメントを付けない（公開 JS から .map を参照させない）。
    // アップロード後は sentryVitePlugin が .map を削除するため公開ディレクトリには残らない。
    sourcemap: 'hidden',
    rollupOptions: {
      output: {
        manualChunks: (id: string) => {
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom')) return 'react-vendor'
          if (id.includes('node_modules/firebase') || id.includes('node_modules/@firebase')) {
            if (id.includes('@firebase/firestore') || id.includes('/firestore/')) return 'firestore'
            // firebase/auth は動的 import 専用なので独立チャンクに分離する。
            // firebase/app（initializeApp）は eager だが、同じ 'firebase' チャンクに混ぜると
            // auth まで eager に巻き込まれてしまうため分ける。
            if (id.includes('@firebase/auth') || id.includes('/auth/')) return 'firebase-auth'
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
            // @ts-expect-error — no type declarations for Vercel serverless handler
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
        // アプリの骨格（HTML/CSS/フォント/コアアイコン＋初期JS=index・react-vendor）のみプリキャッシュ。
        // firestore/firebase-auth/sentry/lightweight-charts/各ビュー等の遅延チャンクは
        // プリキャッシュに含めず（初回の裏ダウンロード約1MB超を削減）、初回アクセス時に
        // ランタイムキャッシュ（app-chunks）で取得・以降は即時提供する。
        // data/*.json（頻繁に更新）と notes/*.webp（多数・大容量）も除外してランタイムキャッシュへ。
        globPatterns: ['**/*.{css,html,woff2}', 'assets/index-*.js', 'assets/react-vendor-*.js', 'favicon*.{ico,png,svg}', 'apple-touch-icon.png', 'icon-192.png', 'icon-512.png', 'icon-512-maskable.png', 'logo.svg'],
        globIgnores: ['**/data/**', '**/notes/**'],
        runtimeCaching: [
          {
            // 遅延ロードされる JS/CSS チャンク（ファイル名に内容ハッシュ付き＝不変）。
            // 初回アクセス時にネットワーク取得→以降はキャッシュから即時提供。
            // 新デプロイでは index.html が新ハッシュ名を参照するため、古いチャンクは自然に使われなくなる。
            urlPattern: /\/calendar\/assets\/.*\.(?:js|css)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'app-chunks',
              expiration: { maxEntries: 80, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
          {
            // アプリ画像（poirobo/support-room 等）— 変更まれ → オンデマンドでキャッシュ。
            // notes/*.webp は下の note-images ルール（先に評価される）が担当。
            urlPattern: /\/calendar\/(?!.*\/notes\/).*\.(?:png|jpe?g|webp)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'app-images',
              expiration: { maxEntries: 40, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
          {
            // 市場データ JSON（頻繁に更新）— ネット優先で常に最新を取得。
            // 旧 StaleWhileRevalidate は「古い表示→裏で更新→次回反映」で常に1リロード遅れたため NetworkFirst に変更。
            // ネットが3秒で応答しない/オフライン時のみキャッシュにフォールバック。
            urlPattern: /\/calendar\/data\//,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'market-data',
              networkTimeoutSeconds: 3,
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
    // ★ 最後に配置：ビルド済みアセットのソースマップを Sentry にアップロードし、
    //    Debug ID を注入したうえで公開ディレクトリの .map を削除する。
    sentryVitePlugin({
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      authToken: SENTRY_AUTH_TOKEN,
      // トークンが無ければアップロードをスキップ（ローカルビルドを壊さない）
      disable: !SENTRY_AUTH_TOKEN,
      sourcemaps: {
        // アップロード後に .map を削除（公開ディレクトリに残さない）
        filesToDeleteAfterUpload: ['./dist/calendar/assets/**/*.map'],
      },
    }),
  ],
})
