import './assets/main.css'

import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { HeroUIProvider } from "@heroui/react"

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    {/* Оборачиваем всё приложение и включаем темную тему */}
    <HeroUIProvider>
      <main className="dark text-foreground bg-background h-screen">
        <App />
      </main>
    </HeroUIProvider>
  </React.StrictMode>
)
