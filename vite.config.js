import path from 'path'
import { fileURLToPath } from 'url'

import { defineConfig } from 'vite'
import vue2 from '@vitejs/plugin-vue2'

import Icons from 'unplugin-icons/vite'
import IconsResolver from 'unplugin-icons/resolver'
import Components from 'unplugin-vue-components/vite'

export function sharedConfig() {
  return defineConfig({
    plugins: [
      vue2({
        jsx: true
      }),
      Components({
        resolvers: IconsResolver()
      }),
      Icons({ compiler: 'vue2' })
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
