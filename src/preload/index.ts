import { contextBridge, ipcRenderer, webUtils } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// Наши кастомные API
const api = {
  // Вызов FFmpeg
  extractFrame: (filePath: string): Promise<string> => ipcRenderer.invoke('extract-frame', filePath),

  // Безопасное получение пути к файлу
  getFilePath: (file: File): string => webUtils.getPathForFile(file)
}

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
