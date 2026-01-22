import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite' // 👈 Вернули импорт
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite' // 👈 Вернули Tailwind

export default defineConfig({
  main: {
    // 👇 ЭТО ОБЯЗАТЕЛЬНО! Иначе сборка Main процесса сломается
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias: {
        '@shared': resolve('src/shared')
      }
    }
  },
  preload: {
    // 👇 ЭТО ОБЯЗАТЕЛЬНО! Иначе Preload скрипт не создастся
    plugins: [externalizeDepsPlugin()],
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
        '@shared': resolve('src/shared')
      }
    },
    // 👇 Вернули tailwindcss() для работы стилей HeroUI
    plugins: [react(), tailwindcss()]
  }
})
