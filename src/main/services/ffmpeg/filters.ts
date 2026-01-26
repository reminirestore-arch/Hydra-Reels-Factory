import type { StrategyType } from '@shared/types'

const normalize = 'scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1'

function clampFadeStart(duration: number, fadeDur: number): number {
  const start = duration - fadeDur
  return start > 0 ? start : 0
}

export function buildStrategyFilter(strategyId: StrategyType, durationSeconds?: number): string {
  const dur = typeof durationSeconds === 'number' && durationSeconds > 0 ? durationSeconds : 0

  switch (strategyId) {
    case 'IG1':
      return `crop=iw*0.98:ih*0.98,${normalize},vignette=PI/8`
    case 'IG2':
      return `setpts=0.99*PTS,${normalize},eq=saturation=1.2`
    case 'IG3': {
      const fadeDur = 0.3
      const outStart = dur ? clampFadeStart(dur, fadeDur) : 0
      const fades = dur
        ? `,fade=t=in:st=0:d=${fadeDur},fade=t=out:st=${outStart}:d=${fadeDur}`
        : `,fade=t=in:st=0:d=${fadeDur}`
      return `unsharp=5:5:0.5:5:5:0.0,${normalize},eq=contrast=1.1${fades}`
    }
    case 'IG4': {
      const fadeDur = 0.5
      const outStart = dur ? clampFadeStart(dur, fadeDur) : 0
      const fades = dur
        ? `,fade=t=in:st=0:d=${fadeDur},fade=t=out:st=${outStart}:d=${fadeDur}`
        : `,fade=t=in:st=0:d=${fadeDur}`
      return `rotate=0.3*PI/180,scale=1085:1930,crop=1080:1920,noise=c0s=7:allf=t,setsar=1${fades}`
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
