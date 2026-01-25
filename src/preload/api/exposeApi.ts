import { contextBridge, ipcRenderer } from 'electron'
import { IPC } from '@shared/ipc/channels'
import type { Api, FfmpegLogEvent } from '@shared/ipc/contracts'

const api: Api = {
  selectFolder: () => ipcRenderer.invoke(IPC.SelectFolder),
  selectOutputFolder: () => ipcRenderer.invoke(IPC.SelectOutputFolder),
  scanFolder: (path) => ipcRenderer.invoke(IPC.ScanFolder, { path }),
  extractFrame: async (path, strategyId, atSeconds) => {
    const res = await ipcRenderer.invoke(IPC.ExtractFrame, { path, strategyId, atSeconds })
    if (res && typeof res === 'object' && 'ok' in res) return res.ok ? res.data : null
    return res ?? null
  },
  saveOverlay: (dataUrl) => ipcRenderer.invoke(IPC.SaveOverlay, { dataUrl }),
  renderStrategy: (payload) => ipcRenderer.invoke(IPC.RenderStrategy, payload),

  onFfmpegLog: (handler) => {
    const listener = (_event: unknown, payload: FfmpegLogEvent) => handler(payload)
    ipcRenderer.on(IPC.FfmpegLog, listener)
    return () => ipcRenderer.removeListener(IPC.FfmpegLog, listener)
  }
}

export function exposeApi(): void {
  contextBridge.exposeInMainWorld('api', api)
}
