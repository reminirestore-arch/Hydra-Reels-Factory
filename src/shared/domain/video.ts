// src/shared/domain/video.ts
import type { VideoStrategy, StrategyType } from './strategy'
import { createDefaultStrategies } from './strategy'

export interface VideoFile {
  id: string
  filename: string
  fullPath: string
  thumbnailPath: string
  thumbnailDataUrl: string
  duration: number
  strategies: Record<StrategyType, VideoStrategy>
  processingStatus: 'idle' | 'processing' | 'done' | 'error'
}

export const createVideoFile = (params: {
  id: string
  filename: string
  fullPath: string
  duration: number
  thumbnailDataUrl: string
  thumbnailPath?: string
}): VideoFile => ({
  id: params.id,
  filename: params.filename,
  fullPath: params.fullPath,
  duration: params.duration,
  thumbnailDataUrl: params.thumbnailDataUrl,
  thumbnailPath: params.thumbnailPath ?? '',
  strategies: createDefaultStrategies(),
  processingStatus: 'idle'
})
