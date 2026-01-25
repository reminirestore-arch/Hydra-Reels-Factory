import ffmpeg from 'fluent-ffmpeg'
import type { StrategyType } from '@shared/types'

export type VideoEncoderId = 'h264_videotoolbox' | 'h264_nvenc' | 'libx264'

export type EncoderProfile = {
  videoCodec: VideoEncoderId
  videoBitrate: string // e.g. '12M'
  pixelFormat: 'yuv420p'
  movFlags: '+faststart'
  audioCodec: 'aac'
  audioBitrate: string // e.g. '256k'
  // если понадобится — пресеты, профили и т.п.
}

const DEFAULT_PROFILE: EncoderProfile = {
  videoCodec: 'libx264',
  videoBitrate: '12M',
  pixelFormat: 'yuv420p',
  movFlags: '+faststart',
  audioCodec: 'aac',
  audioBitrate: '256k'
}

let cachedEncoders: Set<string> | null = null

async function listFfmpegEncoders(): Promise<Set<string>> {
  if (cachedEncoders) return cachedEncoders

  // fluent-ffmpeg умеет получать список кодеков
  const codecs = await new Promise<Record<string, { canEncode: boolean }>>((resolve, reject) => {
    ffmpeg.getAvailableCodecs((err, data) => {
      if (err || !data) reject(err)
      else resolve(data)
    })
  })

  const set = new Set<string>()
  for (const [name, meta] of Object.entries(codecs)) {
    if (meta?.canEncode) set.add(name)
  }

  cachedEncoders = set
  return set
}

async function isEncoderAvailable(encoder: VideoEncoderId): Promise<boolean> {
  try {
    const enc = await listFfmpegEncoders()
    return enc.has(encoder)
  } catch {
    return false
  }
}

export async function pickEncoderProfile(_strategyId: StrategyType): Promise<EncoderProfile> {
  // стратегию можно использовать позже, если решим разные битрейты/настройки

  if (process.platform === 'darwin') {
    return {
      ...DEFAULT_PROFILE,
      videoCodec: 'h264_videotoolbox'
    }
  }

  if (process.platform === 'win32') {
    if (await isEncoderAvailable('h264_nvenc')) {
      return {
        ...DEFAULT_PROFILE,
        videoCodec: 'h264_nvenc'
      }
    }
    return DEFAULT_PROFILE
  }

  // linux/прочее
  return DEFAULT_PROFILE
}
