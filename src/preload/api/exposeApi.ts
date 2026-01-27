import { contextBridge, ipcRenderer } from 'electron'
import { IPC } from '@shared/ipc/channels'
import type {
  Api,
  FfmpegLogEvent,
  Result,
  SelectFolderResult,
  SelectOutputFolderResult,
  ScanFolderResult,
  SaveOverlayResult,
  RenderStrategyResult,
  ExtractFrameResult,
  RenderStrategyPayload
} from '@shared/ipc/contracts'
import type { StrategyType } from '@shared/types'

const api: Api = {
  selectFolder: (): Promise<Result<SelectFolderResult>> =>
    ipcRenderer.invoke(IPC.SelectFolder) as Promise<Result<SelectFolderResult>>,
  selectOutputFolder: (): Promise<Result<SelectOutputFolderResult>> =>
    ipcRenderer.invoke(IPC.SelectOutputFolder) as Promise<Result<SelectOutputFolderResult>>,
  scanFolder: (path: string): Promise<Result<ScanFolderResult>> =>
    ipcRenderer.invoke(IPC.ScanFolder, { path }) as Promise<Result<ScanFolderResult>>,
  extractFrame: async (
    path: string,
    strategyId?: StrategyType,
    atSeconds?: number,
    profileSettings?: import('@shared/types').StrategyProfileSettings
  ): Promise<Result<ExtractFrameResult>> => {
    return ipcRenderer.invoke(IPC.ExtractFrame, {
      path,
      strategyId,
      atSeconds,
      profileSettings
    }) as Promise<Result<ExtractFrameResult>>
  },
  saveOverlay: (dataUrl: string): Promise<Result<SaveOverlayResult>> =>
    ipcRenderer.invoke(IPC.SaveOverlay, { dataUrl }) as Promise<Result<SaveOverlayResult>>,
  renderStrategy: (payload: RenderStrategyPayload): Promise<Result<RenderStrategyResult>> =>
    ipcRenderer.invoke(IPC.RenderStrategy, payload) as Promise<Result<RenderStrategyResult>>,

  onFfmpegLog: (handler): (() => void) => {
    const listener = (_event: unknown, payload: FfmpegLogEvent): void => handler(payload)
    ipcRenderer.on(IPC.FfmpegLog, listener)
    return () => ipcRenderer.removeListener(IPC.FfmpegLog, listener)
  }
}

export function exposeApi(): void {
  contextBridge.exposeInMainWorld('api', api)
  contextBridge.exposeInMainWorld('electron', {
    process: {
      versions: process.versions
    }
  })
}
