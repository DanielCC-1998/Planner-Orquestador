import js from '@eslint/js'
import { defineConfig } from 'eslint/config'
import tseslint from 'typescript-eslint'
import reactHooks from 'eslint-plugin-react-hooks'
import globals from 'globals'

// ─── Dependency rules between layers ────────────────────────────────────────
//
//   domain          ← depends on nothing
//   application     ← domain
//   shared          ← domain (+ application types)
//   infrastructure  ← domain, application, shared            (never presentation)
//   presentation    ← domain, shared (+ application types)   (never infrastructure, Node or Electron)
//
// Each pattern covers the alias (@application/...) and the relative path (../application/...).
// Tests (the tests/ folder) are left out: they build scenarios across layers.

const layer = (name) => [`@${name}`, `@${name}/*`, `**/${name}`, `**/${name}/**`]
const DOMAIN = layer('domain')
const APPLICATION = layer('application')
const INFRASTRUCTURE = layer('infrastructure')
const PRESENTATION = layer('presentation')
const SHARED = layer('shared')
const NODE_AND_ELECTRON = ['node:*', 'fs', 'fs/*', 'path', 'os', 'crypto', 'child_process', 'electron', 'electron/*']
const UI_LIBS = ['react', 'react/*', 'react-dom', 'react-dom/*', 'zustand', 'zustand/*', 'radix-ui', 'lucide-react']

/**
 * @param {string[]} files
 * @param {string[]} forbidden   imports that are not allowed at all
 * @param {string} message
 * @param {string[]} [typeOnly]  allowed only as `import type` (DTOs of the application layer)
 */
const restrict = (files, forbidden, message, typeOnly = []) => ({
  files,
  rules: {
    '@typescript-eslint/no-restricted-imports': [
      'error',
      {
        patterns: [
          { group: forbidden, message },
          ...(typeOnly.length
            ? [{ group: typeOnly, allowTypeImports: true, message: `${message} (only types are allowed)` }]
            : [])
        ]
      }
    ]
  }
})

export default defineConfig(
  {
    ignores: [
      'out/**',
      'release/**',
      'node_modules/**',
      'coverage/**',
      'test-results/**',
      'playwright-report/**',
      'build/**',
      'docs/**'
    ]
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: { ecmaVersion: 2023, sourceType: 'module' },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }
      ],
      '@typescript-eslint/consistent-type-imports': 'error'
    }
  },
  {
    files: ['src/infrastructure/**', 'scripts/**', 'tests/**', '*.config.*'],
    languageOptions: { globals: { ...globals.node } }
  },
  {
    files: ['src/presentation/**'],
    languageOptions: { globals: { ...globals.browser } },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn'
    }
  },
  restrict(
    ['src/domain/**'],
    [...APPLICATION, ...INFRASTRUCTURE, ...PRESENTATION, ...SHARED, ...NODE_AND_ELECTRON, ...UI_LIBS, 'zod'],
    'The domain is pure: it does not depend on other layers, Node, Electron or libraries'
  ),
  restrict(
    ['src/application/**'],
    [...INFRASTRUCTURE, ...PRESENTATION, ...SHARED, ...NODE_AND_ELECTRON, ...UI_LIBS, 'zod'],
    'The application depends only on the domain; anything external comes in through its ports'
  ),
  restrict(
    ['src/shared/**'],
    [...INFRASTRUCTURE, ...PRESENTATION, ...NODE_AND_ELECTRON, ...UI_LIBS],
    'shared only contains contracts and pure utilities',
    APPLICATION
  ),
  restrict(
    ['src/infrastructure/**'],
    [...PRESENTATION, ...UI_LIBS],
    'Infrastructure does not depend on the user interface'
  ),
  restrict(
    ['src/infrastructure/electron/preload/**'],
    [...PRESENTATION, ...UI_LIBS, ...DOMAIN, ...APPLICATION, '@infrastructure/*', '../*', '../../*'],
    'The preload only exposes the IPC contract from shared'
  ),
  restrict(
    ['src/presentation/**'],
    [...INFRASTRUCTURE, ...NODE_AND_ELECTRON, 'zod'],
    'The user interface talks to the main process over IPC: it uses shared and domain, never infrastructure, Node or Electron',
    APPLICATION
  )
)
