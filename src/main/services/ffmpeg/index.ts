import ffmpeg from 'fluent-ffmpeg'
import ffmpegPath from 'ffmpeg-static'
import * as fs from 'node:fs'
import type { StrategyType } from '@shared/types'
import { buildAudioFilter, buildStrategyFilter } from './filters'
import {
  createTempPath,
  removeTempFile,
  waitForFile,
  cleanupTempFiles as cleanupTemp
} from '../temp/tempFiles'
import { pickEncoderProfile } from './encoders'


if (ffmpegPath) {
  ffmpeg.setFfmpegPath(ffmpegPath.replace('app.asar', 'app.asar.unpacked'))
}

export const cleanupTempFiles = async (): Promise<void> => cleanupTemp()

export const getVideoDuration = (filePath: string): Promise<number> => {
  return new Promise((resolve) => {
    ffmpeg.ffprobe(filePath, (err, data) => {
      if (err || !data.format?.duration) {
        resolve(0)
        return
      }
      resolve(Number(data.format.duration))
    })
  })
}

const hasAudioStream = (filePath: string): Promise<boolean> => {
  return new Promise((resolve) => {
    ffmpeg.ffprobe(filePath, (err, data) => {
      if (err || !data.streams) {
        resolve(false)
        return
      }
      resolve(data.streams.some((stream) => stream.codec_type === 'audio'))
    })
  })
}

export async function extractFrameAsDataUrl(
  inputPath: string,
  previewWidth = 450,
  previewHeight = 800,
  strategyId?: StrategyType,
  atSeconds = 0
): Promise<string> {
  const tempPath = createTempPath('preview', 'jpg')

  try {
    const filter = strategyId
      ? `${buildStrategyFilter(strategyId)},scale=${previewWidth}:${previewHeight}`
      : `scale=${previewWidth}:${previewHeight}`

    await new Promise<void>((resolve, reject) => {
      ffmpeg(inputPath)
        .seekInput(String(atSeconds))
        .videoFilters(filter)
        .outputOptions(['-frames:v 1', '-q:v 2'])
        .output(tempPath)
        .on('end', async () => {
          try {
            await waitForFile(tempPath)
            resolve()
          } catch (e) {
            reject(e)
          }
        })
        .on('error', (err) => reject(err))
        .run()
    })

    const buffer = fs.readFileSync(tempPath)
    await removeTempFile(tempPath)
    return `data:image/jpeg;base64,${buffer.toString('base64')}`
  } catch (error) {
    console.error('Extract frame error:', error)
    void removeTempFile(tempPath)
    return ''
  }
}

export const saveOverlayFromDataUrl = async (dataUrl: string): Promise<string> => {
  const base64Data = dataUrl.replace(/^data:image\/(png|jpeg);base64,/, '')
  const outputPath = createTempPath('overlay', 'png')
  await fs.promises.writeFile(outputPath, Buffer.from(base64Data, 'base64'))
  return outputPath
}

export const renderStrategyVideo = async (options: {
  inputPath: string
  outputPath: string
  overlayPath?: string
  overlayStart?: number
  overlayDuration?: number
  strategyId: StrategyType
  onLog?: (line: string) => void
  onProgress?: (line: string) => void
}): Promise<void> => {
  const {
    inputPath,
    outputPath,
    overlayPath,
    overlayStart = 0,
    overlayDuration = 5,
    strategyId,
    onLog,
    onProgress
  } = options

  const includeAudio = await hasAudioStream(inputPath)
  const durationSeconds = await getVideoDuration(inputPath)

  const runWithProfile = (
    profile: {
      videoCodec: string
      videoBitrate: string
      audioBitrate: string
      pixelFormat: string
      movFlags: string
    },
    audioFilter: string
  ): Promise<void> => {
    return new Promise((resolve, reject) => {
      const command = ffmpeg(inputPath)

      const videoFilter = buildStrategyFilter(strategyId, durationSeconds)

      if (overlayPath) {
        command.input(overlayPath)
        const overlayEnd = overlayStart + overlayDuration

        const graph = [
          `[0:v]${videoFilter}[v0]`,
          `[1:v]format=rgba[ov0]`,
          `[ov0][v0]scale2ref=w=iw:h=ih[ov][v1]`,
          `[v1][ov]overlay=0:0:enable='between(t,${overlayStart},${overlayEnd})'[vout]`
        ].join(';')

        command.complexFilter(graph)
      } else {
        command.videoFilters(videoFilter)
      }

      if (includeAudio && audioFilter) {
        command.audioFilters(audioFilter)
      }

      const outputOptions = [
        '-map_metadata',
        '-1',
        ...(overlayPath ? ['-map', '[vout]'] : []),
        ...(overlayPath ? (includeAudio ? ['-map', '0:a?'] : ['-an']) : []),

        '-b:v',
        profile.videoBitrate,
        '-c:v',
        profile.videoCodec,
        '-movflags',
        profile.movFlags,
        '-pix_fmt',
        profile.pixelFormat
      ]

      if (!overlayPath) {
        // no overlay: rely on default mapping. Still keep audio selection consistent.
        if (includeAudio) outputOptions.push('-b:a', profile.audioBitrate, '-c:a', 'aac')
        else outputOptions.push('-an')
      } else {
        if (includeAudio) outputOptions.push('-b:a', profile.audioBitrate, '-c:a', 'aac')
      }

      command
        .outputOptions(outputOptions)
        .on('stderr', (line) => {
          onLog?.(line)
        })
        .on('progress', (p) => {
          // p.timemark e.g. '00:00:03.12'
          const msg = p?.timemark ? `time=${p.timemark}` : JSON.stringify(p)
          onProgress?.(msg)
        })
        .on('error', (err) => reject(err))
        .on('end', () => resolve())
        .save(outputPath)
    })
  }

  const profile = await pickEncoderProfile(strategyId)
  const audioFilter = includeAudio ? buildAudioFilter(strategyId) : ''

  try {
    await runWithProfile(profile, audioFilter)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)

    // audio filter fallback
    if (
      includeAudio &&
      audioFilter &&
      (message.includes('No such filter') ||
        message.includes('Error while filtering') ||
        message.includes('matches no streams'))
    ) {
      onLog?.('Audio filter failed, retrying without audio filters...')
      await runWithProfile(profile, '')
      return
    }

    // encoder fallback
    if (profile.videoCodec !== 'libx264') {
      onLog?.(`Encoder ${profile.videoCodec} failed, retrying with libx264...`)
      await runWithProfile({ ...profile, videoCodec: 'libx264' }, audioFilter)
      return
    }

    throw error
  }
}
