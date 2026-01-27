import type { StrategyType, StrategyProfileSettings } from '@shared/types'
import { createDefaultProfileSettings } from '@shared/domain/strategy'

const normalize = 'scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1'

function clampFadeStart(duration: number, fadeDur: number): number {
  const start = duration - fadeDur
  return start > 0 ? start : 0
}

export function buildStrategyFilter(
  strategyId: StrategyType,
  durationSeconds?: number,
  profileSettings?: StrategyProfileSettings
): string {
  const dur = typeof durationSeconds === 'number' && durationSeconds > 0 ? durationSeconds : 0
  const settings = profileSettings ?? createDefaultProfileSettings()

  switch (strategyId) {
    case 'IG1': {
      // Calculate crop based on focusStrength (0.96 to 1.0)
      const cropFactor = 0.96 + settings.focusStrength * 0.04
      // Vignette intensity (0 to PI/8)
      const vignetteAngle = (Math.PI / 8) * settings.vignetteIntensity
      // Contrast
      const contrastValue = settings.contrast
      
      return `crop=iw*${cropFactor}:ih*${cropFactor},${normalize},vignette=${vignetteAngle},eq=contrast=${contrastValue}`
    }
    case 'IG2': {
      // Motion speed (inverse for setpts: 0.8 speed = 1/0.8 = 1.25 PTS multiplier)
      const ptsMultiplier = 1 / settings.motionSpeed
      // Saturation
      const saturationValue = settings.saturation
      // Contrast
      const contrastValue = settings.contrast
      
      return `setpts=${ptsMultiplier}*PTS,${normalize},eq=saturation=${saturationValue}:contrast=${contrastValue}`
    }
    case 'IG3': {
      const fadeInDur = settings.fadeInDuration
      const fadeOutDur = settings.fadeOutDuration
      const outStart = dur ? clampFadeStart(dur, fadeOutDur) : 0
      const fades = dur
        ? `,fade=t=in:st=0:d=${fadeInDur},fade=t=out:st=${outStart}:d=${fadeOutDur}`
        : `,fade=t=in:st=0:d=${fadeInDur}`
      
      // Sharpness (0 to 2.0, mapped to unsharp amount)
      const sharpnessAmount = settings.sharpness
      // Contrast
      const contrastValue = settings.contrast
      
      return `unsharp=5:5:${sharpnessAmount}:5:5:0.0,${normalize},eq=contrast=${contrastValue}${fades}`
    }
    case 'IG4': {
      const fadeInDur = settings.fadeInDuration
      const fadeOutDur = settings.fadeOutDuration
      const outStart = dur ? clampFadeStart(dur, fadeOutDur) : 0
      const fades = dur
        ? `,fade=t=in:st=0:d=${fadeInDur},fade=t=out:st=${outStart}:d=${fadeOutDur}`
        : `,fade=t=in:st=0:d=${fadeInDur}`
      
      // Rotation angle in radians
      const rotationRad = (settings.rotationAngle * Math.PI) / 180
      // Grain intensity (0 to 7)
      const grainIntensity = settings.grain * 7
      
      return `rotate=${rotationRad},scale=1085:1930,crop=1080:1920,noise=c0s=${grainIntensity}:allf=t,setsar=1${fades}`
    }
    default:
      return normalize
  }
}

export function buildAudioFilter(strategyId: StrategyType): string {
  switch (strategyId) {
    case 'IG1':
      return 'acompressor=threshold=-12dB:ratio=2:attack=200:release=1000'
    case 'IG2':
      return 'atempo=1.01'
    case 'IG3':
      return 'anequalizer=c0 f=200 w=100 g=-2 t=1|c0 f=6000 w=1000 g=2 t=0'
    case 'IG4':
      // оставляем мягко, без генерации белого шума в MVP
      return 'acompressor=threshold=-14dB:ratio=1.8:attack=250:release=1200'
    default:
      return ''
  }
}
