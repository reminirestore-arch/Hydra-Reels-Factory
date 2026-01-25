import type { StrategyType } from '@shared/types'

export function buildStrategyFilter(strategyId: StrategyType): string {
  const normalize = 'scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1'

  switch (strategyId) {
    case 'IG1':
      return `crop=iw*0.98:ih*0.98,${normalize},vignette=PI/8`
    case 'IG2':
      return `setpts=0.99*PTS,eq=gamma=1.0:saturation=1.2,${normalize}`
    case 'IG3':
      return `unsharp=5:5:0.5:5:5:0.0,eq=contrast=1.1,fade=t=in:st=0:d=0.3,fade=t=out:st=0:d=0.3,${normalize}`
    case 'IG4':
    default:
      return 'rotate=0.3*PI/180,scale=1085:1930,crop=1080:1920,noise=c0s=7:allf=t,fade=t=in:st=0:d=0.5,fade=t=out:st=0:d=0.5,setsar=1'
  }
}

export function buildAudioFilter(strategyId: StrategyType): string {
  switch (strategyId) {
    case 'IG1':
      return 'acompressor=threshold=-12dB:ratio=2:attack=200:release=1000'
    case 'IG2':
      return 'atempo=1.01'
    case 'IG3':
      return 'equalizer=f=200:t=q:w=1:g=-2,equalizer=f=6000:t=q:w=1:g=2'
    case 'IG4':
      return 'acompressor=threshold=-20dB:ratio=9:attack=200:release=1000,treble=g=5:f=12000'
    default:
      return ''
  }
}
