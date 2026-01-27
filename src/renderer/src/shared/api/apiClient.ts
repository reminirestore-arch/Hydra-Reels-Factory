import type {
  Result,
  FfmpegLogEvent,
  RenderStrategyPayload,
  ScanFolderResult
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
  selectFolder: async () =>
    unwrap(await (window.api.selectFolder() as Promise<Result<string | null>>)),
  selectOutputFolder: async () =>
    unwrap(await (window.api.selectOutputFolder() as Promise<Result<string | null>>)),
  scanFolder: async (path: string) =>
    unwrap(await (window.api.scanFolder(path) as Promise<Result<ScanFolderResult>>)),
  extractFrame: async (
    path: string,
    strategyId?: StrategyType,
    atSeconds?: number,
    profileSettings?: import('@shared/types').StrategyProfileSettings
  ) =>
    unwrap(
      await (window.api.extractFrame(path, strategyId, atSeconds, profileSettings) as Promise<
        Result<string>
      >)
    ),
  saveOverlay: async (dataUrl: string) =>
    unwrap(await (window.api.saveOverlay(dataUrl) as Promise<Result<string>>)),
  renderStrategy: async (payload: RenderStrategyPayload) =>
    unwrap(await (window.api.renderStrategy(payload) as Promise<Result<boolean>>)),
  onFfmpegLog: (handler: (e: FfmpegLogEvent) => void) => {
    if (!window.api.onFfmpegLog) return () => {}
    return window.api.onFfmpegLog(handler)
  }
} satisfies {
  selectFolder: () => Promise<string | null>
  selectOutputFolder: () => Promise<string | null>
  scanFolder: (path: string) => Promise<ScanFolderResult>
  extractFrame: (
    path: string,
    strategyId?: StrategyType,
    atSeconds?: number,
    profileSettings?: import('@shared/types').StrategyProfileSettings
  ) => Promise<string>
  saveOverlay: (dataUrl: string) => Promise<string>
  renderStrategy: (payload: RenderStrategyPayload) => Promise<boolean>
  onFfmpegLog: (h: (e: FfmpegLogEvent) => void) => () => void
}
