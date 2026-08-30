import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  // ── Main Process ──────────────────────────────────────────────────────────
  // Forced to CJS output (with a .cjs extension) even though the root
  // package.json is "type": "module". Electron's bundled Node (20.18.x as of
  // Electron 31) crashes with "Cannot read properties of undefined (reading
  // 'exports')" when the main entry statically `import`s the built-in
  // "electron" module as ESM — a known Node 20 cjs-module-lexer bug. CJS
  // output sidesteps it entirely.
  main: {
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias: {
        '@shared': resolve('src/shared'),
        '@main': resolve('src/main')
      }
    },
    build: {
      rollupOptions: {
        output: {
          format: 'cjs',
          entryFileNames: '[name].cjs',
          chunkFileNames: '[name]-[hash].cjs'
        }
      }
    }
  },

  // ── Preload Script ────────────────────────────────────────────────────────
  // electron-vite requires an explicit entry point for the preload bundle.
  // Also forced to CJS for the same reason as the main process above.
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: resolve('src/main/preload.ts'),
        output: {
          format: 'cjs',
          entryFileNames: '[name].cjs',
          chunkFileNames: '[name]-[hash].cjs'
        }
      }
    },
    resolve: {
      alias: {
        '@shared': resolve('src/shared')
      }
    }
  },

  // ── Renderer (React App) ──────────────────────────────────────────────────
  renderer: {
    root: resolve('src/renderer'),
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src'),
        '@shared': resolve('src/shared')
      }
    },
    plugins: [react()]
  }
})
