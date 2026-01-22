import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './assets/main.css'

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <main className="dark text-foreground bg-background h-screen w-screen overflow-hidden">
      <App />
    </main>
  </React.StrictMode>
)
