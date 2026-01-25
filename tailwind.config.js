import { heroui } from '@heroui/react'

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './src/renderer/index.html',
    './src/renderer/src/app/**/*.{js,ts,jsx,tsx}',
    // 👇 ОБЯЗАТЕЛЬНО: Путь к компонентам HeroUI
    './node_modules/@heroui/theme/dist/**/*.{js,ts,jsx,tsx}'
  ],
  theme: {
    extend: {}
  },
  darkMode: 'class',
  plugins: [
    heroui() // Инициализация плагина
  ]
}
