// src/shared/domain/strategy.ts
export type StrategyType = 'IG1' | 'IG2' | 'IG3' | 'IG4'
export type StrategyStatus = 'default' | 'custom'

export interface OverlayTiming {
  startTime: number
  duration: number
  fadeOutDuration?: number // длительность плавного исчезновения в миллисекундах
}

export interface TextStyleSettings {
  fontSize: number
  color: string
  align: 'left' | 'center' | 'right'
  fontWeight?: string | number
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
  // IG1 (Focus Profile)
  focusStrength: number // 0.0-1.0 - сила кропа
  vignetteIntensity: number // 0.0-1.0 - интенсивность виньетки
  
  // IG2 (Motion Profile)
  motionSpeed: number // 0.8-1.3 - скорость воспроизведения
  saturation: number // 0.8-1.5 - насыщенность цветов
  
  // IG3 (Contrast Profile)
  contrast: number // 0.8-1.5 - контраст
  sharpness: number // 0.0-2.0 - резкость
  
  // IG4 (Grain Profile)
  grain: number // 0.0-1.0 - интенсивность зерна
  rotationAngle: number // -2.0 to +2.0 - угол поворота (градусы)
  
  // Fade effects (used by IG3 and IG4)
  fadeInDuration: number // 0.1-1.0 - длительность fade in (сек)
  fadeOutDuration: number // 0.1-1.0 - длительность fade out (сек)
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
  timing: { startTime: 0, duration: 5, fadeOutDuration: 500 },
  text: { fontSize: 42, color: '#ffffff', align: 'center', fontWeight: 'bold' },
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
  // IG1 defaults
  focusStrength: 0.8,
  vignetteIntensity: 1.0,
  
  // IG2 defaults
  motionSpeed: 1.0,
  saturation: 1.2,
  
  // IG3 defaults
  contrast: 1.1,
  sharpness: 0.5,
  
  // IG4 defaults
  grain: 0.6,
  rotationAngle: 0.3,
  
  // Fade defaults (IG3 uses 0.3, IG4 uses 0.5)
  fadeInDuration: 0.3,
  fadeOutDuration: 0.3
})

export const createDefaultStrategy = (id: StrategyType): VideoStrategy => {
  const baseSettings = createDefaultProfileSettings()
  
  // Set profile-specific fade defaults
  if (id === 'IG3') {
    baseSettings.fadeInDuration = 0.3
    baseSettings.fadeOutDuration = 0.3
  } else if (id === 'IG4') {
    baseSettings.fadeInDuration = 0.5
    baseSettings.fadeOutDuration = 0.5
  }
  
  return {
    id,
    status: 'default',
    overlaySettings: createDefaultOverlaySettings(),
    profileSettings: baseSettings
  }
}

export const createDefaultStrategies = (): Record<StrategyType, VideoStrategy> => ({
  IG1: createDefaultStrategy('IG1'),
  IG2: createDefaultStrategy('IG2'),
  IG3: createDefaultStrategy('IG3'),
  IG4: createDefaultStrategy('IG4')
})
