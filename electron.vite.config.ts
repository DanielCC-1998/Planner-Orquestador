import { resolve } from 'node:path'
import { defineConfig } from 'electron-vite'
import type { Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const alias = {
  '@domain': resolve('src/domain'),
  '@application': resolve('src/application'),
  '@infrastructure': resolve('src/infrastructure'),
  '@presentation': resolve('src/presentation'),
  '@shared': resolve('src/shared')
}

// Entry points of each process (the output is still out/main, out/preload and out/renderer).
const MAIN_ENTRY = resolve('src/infrastructure/electron/main/index.ts')
const PRELOAD_ENTRY = resolve('src/infrastructure/electron/preload/index.ts')
const UI_ROOT = resolve('src/presentation')

/**
 * Injects the Content-Security-Policy. In development Vite needs inline scripts
 * (the React Refresh preamble) and websockets for HMR; in production it is strict.
 */
function contentSecurityPolicy(): Plugin {
  let isDev = false
  return {
    name: 'planner-csp',
    configResolved(config) {
      isDev = config.command === 'serve'
    },
    transformIndexHtml() {
      const policy = isDev
        ? "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' ws: http://localhost:*"
        : "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'"
      return [
        {
          tag: 'meta',
          attrs: { 'http-equiv': 'Content-Security-Policy', content: policy },
          injectTo: 'head-prepend'
        }
      ]
    }
  }
}

export default defineConfig({
  main: {
    resolve: { alias },
    build: { externalizeDeps: false, lib: { entry: MAIN_ENTRY } }
  },
  preload: {
    resolve: { alias },
    build: {
      externalizeDeps: false,
      lib: { entry: PRELOAD_ENTRY },
      rollupOptions: { output: { format: 'cjs' } }
    }
  },
  renderer: {
    root: UI_ROOT,
    resolve: { alias },
    plugins: [react(), tailwindcss(), contentSecurityPolicy()],
    build: { minify: 'esbuild', rollupOptions: { input: resolve(UI_ROOT, 'index.html') } }
  }
})
