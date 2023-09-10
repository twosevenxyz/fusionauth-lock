import path from 'path'
import { fileURLToPath } from 'url'

import { defineConfig } from 'vite'
import vue2 from '@vitejs/plugin-vue2'

export function sharedConfig () {
  return defineConfig({
    plugins: [
      vue2({
        jsx: true
      })
    ],
    resolve: {
      alias: {
        '~': fileURLToPath(new URL('./', import.meta.url)),
        '@': fileURLToPath(new URL('./src', import.meta.url))
      }
    }
  })
}

export default defineConfig({
  build: {
    lib: {
      entry: path.resolve(__dirname, 'fusionauth-lock.js'),
      name: 'fusionauth-lock',
      formats: ['cjs', 'es']
    },
    rollupOptions: {
      external: ['vue'],
      output: {
        globals: {
          vue: 'Vue'
        }
      }
    }
  },
  ...sharedConfig()
})
