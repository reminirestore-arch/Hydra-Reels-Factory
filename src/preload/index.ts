import { contextBridge, ipcRenderer, webUtils } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import { StrategyType, VideoFile } from '@shared/types'

const api = {
  selectFolder: (): Promise<string | null> => ipcRenderer.invoke('select-folder'),
  selectOutputFolder: (): Promise<string | null> => ipcRenderer.invoke('select-output-folder'),
  scanFolder: (path: string): Promise<VideoFile[]> => ipcRenderer.invoke('scan-folder', path),
  extractFrame: (filePath: string, strategyId?: StrategyType) =>
    ipcRenderer.invoke('extract-frame', filePath, strategyId),
  saveOverlay: (dataUrl: string): Promise<string> => ipcRenderer.invoke('save-overlay', dataUrl),
  renderStrategy: (payload: {
    inputPath: string
    outputDir: string
    outputName: string
    overlayPath?: string
    overlayStart?: number
    overlayDuration?: number
    strategyId: StrategyType
  }): Promise<boolean> => ipcRenderer.invoke('render-strategy', payload),
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
