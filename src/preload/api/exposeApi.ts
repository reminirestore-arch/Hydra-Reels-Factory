import { contextBridge, ipcRenderer } from 'electron'
import { IPC } from '@shared/ipc/channels'
import type { Api } from '@shared/ipc/contracts'

const api: Api = {
  selectFolder: () => ipcRenderer.invoke(IPC.SelectFolder),
  selectOutputFolder: () => ipcRenderer.invoke(IPC.SelectOutputFolder),
  scanFolder: (path) => ipcRenderer.invoke(IPC.ScanFolder, { path }),
  extractFrame: (path, strategyId, atSeconds) =>
    ipcRenderer.invoke(IPC.ExtractFrame, { path, strategyId, atSeconds }),
  saveOverlay: (dataUrl) => ipcRenderer.invoke(IPC.SaveOverlay, { dataUrl }),
  renderStrategy: (payload) => ipcRenderer.invoke(IPC.RenderStrategy, payload)
}

export function exposeApi(): void {
  contextBridge.exposeInMainWorld('api', api)
}
