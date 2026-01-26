import type {
  Api,
  Result,
  FfmpegLogEvent,
  RenderStrategyPayload
} from '@shared/ipc/contracts'
import type { StrategyType } from '@shared/types'

class IpcClientError extends Error {
  public code: string
  public details?: unknown

  constructor(code: string, message: string, details?: unknown) {
    super(`[${code}] ${message}`)
    this.code = code
    this.details = details
  }
}

function unwrap<T>(res: Result<T>): T {
  if (res.ok) return res.data
  throw new IpcClientError(res.error.code, res.error.message, res.error.details)
}

export const apiClient = {
  selectFolder: async () => unwrap(await window.api.selectFolder()),
  selectOutputFolder: async () => unwrap(await window.api.selectOutputFolder()),
  scanFolder: async (path: string) => unwrap(await window.api.scanFolder(path)),
  extractFrame: async (path: string, strategyId?: StrategyType, atSeconds?: number) =>
    unwrap(await window.api.extractFrame(path, strategyId, atSeconds)),
  saveOverlay: async (dataUrl: string) => unwrap(await window.api.saveOverlay(dataUrl)),
  renderStrategy: async (payload: RenderStrategyPayload) =>
    unwrap(await window.api.renderStrategy(payload)),
  onFfmpegLog: (handler: (e: FfmpegLogEvent) => void) => {
    if (!window.api.onFfmpegLog) return () => {}
    return window.api.onFfmpegLog(handler)
  }
} satisfies Omit<Api, 'onFfmpegLog'> & { onFfmpegLog: (h: (e: FfmpegLogEvent) => void) => () => void }
