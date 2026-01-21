import { contextBridge, ipcRenderer, webUtils } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
// 👇 Импорт типа
import { VideoFile } from '../shared/types'

const api = {
  getFilePath: (file: File): string => webUtils.getPathForFile(file),
  extractFrame: (filePath: string): Promise<string> => ipcRenderer.invoke('extract-frame', filePath),
  selectFolder: (): Promise<string | null> => ipcRenderer.invoke('select-folder'),
  scanFolder: (folderPath: string): Promise<VideoFile[]> => ipcRenderer.invoke('scan-folder', folderPath)
}

// ... остальной код моста без изменений (с interface PreloadWindow) ...
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  interface PreloadWindow {
    electron: typeof electronAPI
    api: typeof api
  }
  const globalWindow = globalThis as unknown as PreloadWindow
  globalWindow.electron = electronAPI
  globalWindow.api = api
}
