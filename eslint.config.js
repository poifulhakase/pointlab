import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  // dist=ビルド成果物 / hakaseAI=別プロジェクト（ハカセAIチャット・このアプリと無関係）
  globalIgnores(['dist', 'hakaseAI']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    rules: {
      // 空の catch ブロックは明示的に _e で受けること
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      // any は警告（完全禁止にすると既存コードへの影響が大きいため warn）
      '@typescript-eslint/no-explicit-any': 'warn',
      // 型のみインポートは import type を使う
      '@typescript-eslint/consistent-type-imports': ['warn', { prefer: 'type-imports', fixStyle: 'inline-type-imports' }],
      // ── React Compiler 系ルール（eslint-plugin-react-hooks v6）──
      // 本アプリは React Compiler 未導入。これらは「最適化の助言」であり実行時バグではないため
      // error→warn に格下げ（可視化は維持）。該当箇所: effect内setState・装飾用Math.random・
      // Android戻るボタンの ref パターン等、いずれも意図的で動作上は正常。
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/purity': 'warn',
      'react-hooks/refs': 'warn',
      'react-hooks/preserve-manual-memoization': 'warn',
      // Fast Refresh（開発時のみ）の制約。util と component を同居させたファイルがあるため warn。
      'react-refresh/only-export-components': 'warn',
    },
  },
  // テストファイル: Vitest グローバル変数を宣言
  {
    files: ['src/**/__tests__/**/*.ts', 'src/**/*.test.ts', 'src/**/*.test.tsx'],
    languageOptions: {
      globals: {
        describe: 'readonly',
        it:       'readonly',
        test:     'readonly',
        expect:   'readonly',
        beforeEach: 'readonly',
        afterEach:  'readonly',
        beforeAll:  'readonly',
        afterAll:   'readonly',
        vi:       'readonly',
      },
    },
  },
])
