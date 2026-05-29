import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
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
