// src/shared/ipc/contracts.ts
import type { StrategyType, VideoFile } from '@shared/types'

export type IpcErrorCode =
  | 'CANCELLED'
  | 'VALIDATION'
  | 'NOT_FOUND'
  | 'IO'
  | 'FFMPEG'
  | 'INTERNAL'
  | 'UNKNOWN'

export type IpcError = {
  code: IpcErrorCode
  message: string
  details?: unknown
}

export type Result<T> = { ok: true; data: T } | { ok: false; error: IpcError }

export type SelectFolderResult = string | null
export type SelectOutputFolderResult = string | null

export type ScanFolderArgs = { path: string }
export type ScanFolderResult = VideoFile[]

export type ExtractFrameArgs = {
  path: string
  strategyId?: StrategyType
  atSeconds?: number
  profileSettings?: import('@shared/types').StrategyProfileSettings
}
export type ExtractFrameResult = string // dataUrl

export type SaveOverlayArgs = { dataUrl: string }
export type SaveOverlayResult = string // saved file path

export type RenderStrategyPayload = {
  inputPath: string
  outputDir: string
  outputName: string
  strategyId: StrategyType

  overlayPath?: string
  overlayStart?: number
  overlayDuration?: number
  overlayFadeOutDuration?: number // длительность исчезновения в миллисекундах
  profileSettings?: import('@shared/types').StrategyProfileSettings

  // optional context for logs/UI
  fileId?: string
  filename?: string
}
export type RenderStrategyResult = boolean

export type FfmpegLogEvent = {
  ts: number
  level: 'stderr' | 'info' | 'progress'
  line: string
  fileId?: string
  filename?: string
  strategyId?: StrategyType
}

export type ProcessingTask = {
  inputPath: string
  outputName: string
  strategyId: StrategyType
  overlayPath?: string
  overlayStart?: number
  overlayDuration?: number
  overlayFadeOutDuration?: number
  profileSettings?: import('@shared/types').StrategyProfileSettings
  fileId?: string
  filename?: string
}

export type ProcessingStartPayload = {
  outputDir: string
  tasks: ProcessingTask[]
}

export type ProcessingProgressEvent = {
  fileId?: string
  filename?: string
  strategyId?: StrategyType
  status: 'started' | 'done' | 'error'
  completed: number
  total: number
  percent?: number
}

export type ProcessingCompleteEvent = {
  completed: number
  total: number
  stopped: boolean
}

export type Unsubscribe = () => void

export type Api = {
  selectFolder: () => Promise<Result<SelectFolderResult>>
  selectOutputFolder: () => Promise<Result<SelectOutputFolderResult>>
  scanFolder: (path: string) => Promise<Result<ScanFolderResult>>
  extractFrame: (
    path: string,
    strategyId?: StrategyType,
    atSeconds?: number,
    profileSettings?: import('@shared/types').StrategyProfileSettings
  ) => Promise<Result<ExtractFrameResult>>
  saveOverlay: (dataUrl: string) => Promise<Result<SaveOverlayResult>>
  renderStrategy: (payload: RenderStrategyPayload) => Promise<Result<RenderStrategyResult>>

  // event subscription (renderer only)
  onFfmpegLog?: (handler: (e: FfmpegLogEvent) => void) => Unsubscribe

  processingStart: (payload: ProcessingStartPayload) => Promise<Result<void>>
  processingStop: () => Promise<Result<void>>
  onProcessingProgress?: (handler: (e: ProcessingProgressEvent) => void) => Unsubscribe
  onProcessingComplete?: (handler: (e: ProcessingCompleteEvent) => void) => Unsubscribe
}
