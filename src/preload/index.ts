import { contextBridge, ipcRenderer, webUtils } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import { VideoFile } from '@shared/types'

// Создаем API, который вызывает методы из main/index.ts
const api = {
  selectFolder: (): Promise<string | null> => ipcRenderer.invoke('select-folder'),
  scanFolder: (path: string): Promise<VideoFile[]> => ipcRenderer.invoke('scan-folder', path),
  extractFrame: (filePath: string): Promise<string> => ipcRenderer.invoke('extract-frame', filePath),
  getFilePath: (file: File): string => webUtils.getPathForFile(file)
}

// Экспонируем API в мир (window.api)
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
