import { contextBridge } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// Простейший API для теста
const api = {
  test: () => console.log('Preload is working')
}

// Безопасная экспозиция
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in d.ts)
  window.electron = electronAPI
  // @ts-ignore (define in d.ts)
  window.api = api
}
