export type StrategyType = 'IG1' | 'IG2' | 'IG3' | 'IG4'

export interface VideoStrategy {
  id: StrategyType
  isReady: boolean
  overlayPath?: string
  canvasState?: object
  textData?: string
}

export interface VideoFile {
  id: string
  filename: string
  fullPath: string
  thumbnailPath: string
  thumbnailDataUrl: string
  duration: number
  strategies: {
    IG1: VideoStrategy
    IG2: VideoStrategy
    IG3: VideoStrategy
    IG4: VideoStrategy
  }
  overlayDuration: number
}

export interface StrategyConfig {
  id: StrategyType
  label: string
  description: string
  color: 'primary' | 'secondary' | 'warning' | 'danger' | 'success' | 'default'
}

export interface EditorSettings {
  strategy: StrategyType
  volume: number
  speed: number
  saturation: number
  vignette: boolean
  captions: boolean
}
