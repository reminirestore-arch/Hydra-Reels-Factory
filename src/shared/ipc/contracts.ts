// src/shared/ipc/contracts.ts
import type { StrategyType, VideoFile } from '../types' // или ../domain/*
// (как у тебя уже заведено)

export type SelectFolderResult = string | null
export type SelectOutputFolderResult = string | null

export type ScanFolderArgs = { path: string }
export type ScanFolderResult = VideoFile[]

export type ExtractFrameArgs = {
  path: string
  strategyId?: StrategyType
  atSeconds?: number
}
export type ExtractFrameResult = string // dataURL или путь — фиксируем ниже

export type SaveOverlayArgs = {
  dataUrl: string
  // позже добавим: format?: 'png', filename?: string, dir?: string
}
export type SaveOverlayResult = {
  path: string
}

export type RenderStrategyPayload = {
  inputPath: string
  outputDir: string
  outputName: string
  overlayPath?: string
  overlayStart?: number
  overlayDuration?: number
  strategyId: StrategyType
}
export type RenderStrategyResult = boolean

export type Api = {
  selectFolder: () => Promise<SelectFolderResult>
  selectOutputFolder: () => Promise<SelectOutputFolderResult>
  scanFolder: (path: string) => Promise<ScanFolderResult>
  extractFrame: (
    path: string,
    strategyId?: StrategyType,
    atSeconds?: number
  ) => Promise<ExtractFrameResult>
  saveOverlay: (dataUrl: string) => Promise<SaveOverlayResult>
  renderStrategy: (payload: RenderStrategyPayload) => Promise<RenderStrategyResult>
}
