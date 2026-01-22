export type StrategyType = 'IG1' | 'IG2' | 'IG3' | 'IG4'

export type StrategyStatus = 'default' | 'custom'

export interface OverlayTiming {
  startTime: number
  duration: number
}

export interface TextStyleSettings {
  fontSize: number
  color: string
  align: 'center'
}

export interface BackgroundStyleSettings {
  width: number
  height: number
  color: string
  opacity: number
  position: 'center'
}

export interface OverlaySettings {
  timing: OverlayTiming
  text: TextStyleSettings
  background: BackgroundStyleSettings
}

export interface StrategyProfileSettings {
  focusStrength: number
  motionSpeed: number
  contrast: number
  grain: number
}

export interface VideoStrategy {
  id: StrategyType
  status: StrategyStatus
  overlayPath?: string
  canvasState?: object
  textData?: string
  overlaySettings: OverlaySettings
  profileSettings: StrategyProfileSettings
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
  processingStatus: 'idle' | 'processing' | 'done'
}

export interface StrategyConfig {
  id: StrategyType
  label: string
  description: string
  color: 'primary' | 'secondary' | 'warning' | 'danger' | 'success' | 'default'
}
