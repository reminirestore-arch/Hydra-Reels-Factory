// src/shared/domain/strategy.ts
export type StrategyType = 'IG1' | 'IG2' | 'IG3' | 'IG4'
export type StrategyStatus = 'default' | 'custom'

export interface OverlayTiming {
  startTime: number
  duration: number
}

export interface TextStyleSettings {
  fontSize: number
  color: string
  align: 'left' | 'center' | 'right'
}

export interface BackgroundStyleSettings {
  width: number
  height: number
  color: string
  opacity: number
  radius: number
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

export const createDefaultOverlaySettings = (): OverlaySettings => ({
  timing: { startTime: 0, duration: 5 },
  text: { fontSize: 42, color: '#ffffff', align: 'center' },
  background: {
    width: 420,
    height: 160,
    color: '#000000',
    opacity: 0.55,
    radius: 18,
    position: 'center'
  }
})

export const buildDefaultOverlaySettings = createDefaultOverlaySettings

export const createDefaultProfileSettings = (): StrategyProfileSettings => ({
  focusStrength: 0.8,
  motionSpeed: 1.0,
  contrast: 1.0,
  grain: 0.6
})

export const createDefaultStrategy = (id: StrategyType): VideoStrategy => ({
  id,
  status: 'default',
  overlaySettings: createDefaultOverlaySettings(),
  profileSettings: createDefaultProfileSettings()
})

export const createDefaultStrategies = (): Record<StrategyType, VideoStrategy> => ({
  IG1: createDefaultStrategy('IG1'),
  IG2: createDefaultStrategy('IG2'),
  IG3: createDefaultStrategy('IG3'),
  IG4: createDefaultStrategy('IG4')
})
