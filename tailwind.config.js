const { heroui } = require("@heroui/react");

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/renderer/index.html",
    "./src/renderer/src/**/*.{js,ts,jsx,tsx}",
    "./node_modules/@heroui/theme/dist/**/*.{js,ts,jsx,tsx}" // 👈 Важно: стили HeroUI
  ],
  theme: {
    extend: {},
  },
  darkMode: "class", // 👈 Важно для темной темы
  plugins: [heroui()]
}
