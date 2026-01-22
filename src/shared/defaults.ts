import { OverlaySettings, StrategyProfileSettings, StrategyType, VideoStrategy } from './types'

export const buildDefaultOverlaySettings = (): OverlaySettings => ({
  timing: {
    startTime: 0,
    duration: 5
  },
  text: {
    fontSize: 32,
    color: '#ffffff',
    align: 'center'
  },
  background: {
    width: 320,
    height: 120,
    color: '#000000',
    opacity: 0.6,
    radius: 12,
    position: 'center'
  }
})

const buildDefaultProfileSettings = (strategyId: StrategyType): StrategyProfileSettings => {
  switch (strategyId) {
    case 'IG1':
      return {
        focusStrength: 0.7,
        motionSpeed: 1.0,
        contrast: 1.0,
        grain: 0.2
      }
    case 'IG2':
      return {
        focusStrength: 0.5,
        motionSpeed: 1.15,
        contrast: 1.0,
        grain: 0.1
      }
    case 'IG3':
      return {
        focusStrength: 0.6,
        motionSpeed: 1.0,
        contrast: 1.2,
        grain: 0.15
      }
    case 'IG4':
    default:
      return {
        focusStrength: 0.4,
        motionSpeed: 0.95,
        contrast: 0.9,
        grain: 0.35
      }
  }
}

export const createDefaultStrategy = (strategyId: StrategyType): VideoStrategy => ({
  id: strategyId,
  status: 'default',
  overlaySettings: buildDefaultOverlaySettings(),
  profileSettings: buildDefaultProfileSettings(strategyId)
})
