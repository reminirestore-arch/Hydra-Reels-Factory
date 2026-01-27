import { resolve } from 'path'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  main: {
    // Плагин удален, он deprecated.
    // Electron-vite теперь сам обрабатывает внешние зависимости.
    resolve: {
      alias: {
        '@shared': resolve('src/shared'),
        '@main': resolve('src/main'),
        '@services': resolve('src/main/services'),
        '@ipc': resolve('src/main/ipc'),
        '@resources': resolve('resources')
      }
    }
  },
  preload: {
    resolve: {
      alias: {
        '@shared': resolve('src/shared')
      }
    }
  },
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src'),
        '@shared': resolve('src/shared'),
        '@features': resolve('src/renderer/src/features'),
        '@pages': resolve('src/renderer/src/pages'),
        '@components': resolve('src/renderer/src/components'),
        '@api': resolve('src/renderer/src/shared/api')
      }
    },
    plugins: [react(), tailwindcss()]
  }
})
