import { resolve } from 'path'
import { defineConfig } from 'electron-vite' // Убрали externalizeDepsPlugin
import react from '@vitejs/plugin-react'

export default defineConfig({
  main: {
    // Плагин убран, так как он deprecated и работает "из коробки"
  },
  preload: {},
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src'),
        '@shared': resolve('src/shared') // Добавили алиас для shared (на будущее)
      }
    },
    plugins: [react()]
  }
})
