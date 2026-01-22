import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './assets/main.css'

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    {/* HeroUIProvider удален.
      Класс "dark" на main активирует темную тему через CSS-переменные Tailwind v4.
    */}
    <main className="dark text-foreground bg-background h-screen w-screen overflow-hidden">
      <App />
    </main>
  </React.StrictMode>
)
