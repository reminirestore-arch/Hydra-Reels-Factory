import { contextBridge, ipcRenderer, webUtils } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// Описываем интерфейс для видеофайла (чтобы TS не ругался)
interface VideoFile {
  name: string;
  path: string;
  id: string;
}

const api = {
  // 1. Работа с файлами
  getFilePath: (file: File): string => webUtils.getPathForFile(file),

  // 2. FFmpeg функции
  extractFrame: (filePath: string): Promise<string> => ipcRenderer.invoke('extract-frame', filePath),

  // 3. Файловый менеджер (Новые функции)
  selectFolder: (): Promise<string | null> => ipcRenderer.invoke('select-folder'),
  scanFolder: (folderPath: string): Promise<VideoFile[]> => ipcRenderer.invoke('scan-folder', folderPath)
}

// Экспортируем в мир
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
