// eslint-disable-next-line @typescript-eslint/no-require-imports
const ffmpeg = require('fluent-ffmpeg')
// eslint-disable-next-line @typescript-eslint/no-require-imports
const ffmpegPathModule = require('ffmpeg-static')
const ffmpegPath: string | undefined =
  typeof ffmpegPathModule === 'string' ? ffmpegPathModule : (ffmpegPathModule?.default ?? undefined)
import * as fs from 'node:fs'
import { app } from 'electron'
import { join } from 'node:path'
import type { StrategyType } from '@shared/types'
import { buildAudioFilter, buildStrategyFilter } from './filters'
import {
  createTempPath,
  removeTempFile,
  waitForFile,
  cleanupTempFiles as cleanupTemp
} from '@services/temp/tempFiles'
import { pickEncoderProfile } from './encoders'
import { createLogger } from '@shared/logger'
import { getConfig } from '@shared/config'
import { retry } from '@shared/utils/retry'

const logger = createLogger('FFmpegService')
const config = getConfig()

/**
 * Resolves the correct path to ffmpeg executable in Electron app
 * Handles both development and production (packaged) environments
 */
function resolveFfmpegPath(rawPath: string | undefined): string | undefined {
  if (!rawPath) return undefined

  // In development, use the path as-is
  if (!app.isPackaged) {
    return rawPath
  }

  // In production, we need to handle the asar unpacked path
  const appPath = app.getAppPath()

  // Normalize path separators for cross-platform compatibility
  const normalizedRawPath = rawPath.replace(/\\/g, '/')

  // If the path contains app.asar, replace it with app.asar.unpacked
  if (normalizedRawPath.includes('app.asar') && !normalizedRawPath.includes('app.asar.unpacked')) {
    const unpackedPath = normalizedRawPath.replace('app.asar', 'app.asar.unpacked')
    // Convert back to platform-specific separators
    const platformPath =
      process.platform === 'win32' ? unpackedPath.replace(/\//g, '\\') : unpackedPath
    if (fs.existsSync(platformPath)) {
      return platformPath
    }
  }

  // If path is relative to app.asar, construct the unpacked path
  if (appPath.includes('app.asar')) {
    const unpackedAppPath = appPath.replace('app.asar', 'app.asar.unpacked')
    // Extract relative path from app.asar (handle both / and \)
    const relativePath = normalizedRawPath.replace(/^.*app\.asar[\\/]/, '')
    const resolvedPath = join(unpackedAppPath, relativePath)
    if (fs.existsSync(resolvedPath)) {
      return resolvedPath
    }
  }

  // Fallback: try to find ffmpeg in the unpacked node_modules
  // ffmpeg-static stores binaries in platform-specific subdirectories
  if (appPath.includes('app.asar')) {
    const unpackedAppPath = appPath.replace('app.asar', 'app.asar.unpacked')
    const platform =
      process.platform === 'win32' ? 'win32' : process.platform === 'darwin' ? 'darwin' : 'linux'
    const arch = process.arch === 'x64' ? 'x64' : process.arch === 'arm64' ? 'arm64' : 'ia32'

    // Try different possible paths
    const possiblePaths = [
      join(
        unpackedAppPath,
        'node_modules',
        'ffmpeg-static',
        platform,
        arch,
        'ffmpeg' + (process.platform === 'win32' ? '.exe' : '')
      ),
      join(
        unpackedAppPath,
        'node_modules',
        'ffmpeg-static',
        'ffmpeg' + (process.platform === 'win32' ? '.exe' : '')
      ),
      join(
        unpackedAppPath,
        'node_modules',
        'ffmpeg-static',
        'bin',
        platform,
        arch,
        'ffmpeg' + (process.platform === 'win32' ? '.exe' : '')
      )
    ]

    for (const possiblePath of possiblePaths) {
      if (fs.existsSync(possiblePath)) {
        return possiblePath
      }
    }
  }

  // Last resort: return original path
  return rawPath
}

// Initialize ffmpeg path
const resolvedFfmpegPath = resolveFfmpegPath(ffmpegPath)

logger.info('FFmpeg service initialized', {
  originalPath: ffmpegPath,
  resolvedPath: resolvedFfmpegPath,
  isPackaged: app.isPackaged,
  appPath: app.isPackaged ? app.getAppPath() : undefined
})

if (resolvedFfmpegPath) {
  // Verify the path exists before setting it
  if (fs.existsSync(resolvedFfmpegPath)) {
    ffmpeg.setFfmpegPath(resolvedFfmpegPath)
    logger.info('FFmpeg path set successfully', { path: resolvedFfmpegPath })
  } else {
    logger.error('FFmpeg path does not exist', undefined, { path: resolvedFfmpegPath })
  }
} else {
  logger.warn('FFmpeg path not resolved, ffmpeg operations may fail')
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
  atSeconds = 0,
  profileSettings?: import('@shared/types').StrategyProfileSettings
): Promise<string> {
  const tempPath = createTempPath('preview', 'jpg')

  try {
    const filter = strategyId
      ? `${buildStrategyFilter(strategyId, undefined, profileSettings)},scale=${previewWidth}:${previewHeight}`
      : `scale=${previewWidth}:${previewHeight}`

    logger.info('Extracting frame', { inputPath, atSeconds, tempPath, strategyId })

    await retry(
      () =>
        new Promise<void>((resolve, reject) => {
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
            .on('error', (err) => {
              logger.error(
                'FFmpeg extraction error',
                err instanceof Error ? err : new Error(String(err)),
                {
                  inputPath,
                  atSeconds
                }
              )
              reject(err)
            })
            .run()
        }),
      {
        maxAttempts: config.processing.retryAttempts,
        onRetry: (attempt, error) => {
          logger.warn(`Retrying frame extraction (attempt ${attempt})`, { error: error.message })
        }
      }
    )

    const buffer = fs.readFileSync(tempPath)
    await removeTempFile(tempPath)
    return `data:image/jpeg;base64,${buffer.toString('base64')}`
  } catch (error) {
    logger.error(
      'Extract frame failed',
      error instanceof Error ? error : new Error(String(error)),
      {
        inputPath,
        atSeconds,
        tempPath
      }
    )
    void removeTempFile(tempPath)
    throw error
  }
}

export const saveOverlayFromDataUrl = async (dataUrl: string): Promise<string> => {
  const base64Data = dataUrl.replace(/^data:image\/(png|jpeg);base64,/, '')
  const outputPath = createTempPath('overlay', 'png')

  logger.info('Saving overlay from data URL', { outputPath, dataSize: base64Data.length })
  await fs.promises.writeFile(outputPath, Buffer.from(base64Data, 'base64'))

  logger.info('Overlay saved successfully', { outputPath })
  return outputPath
}

export const renderStrategyVideo = async (options: {
  inputPath: string
  outputPath: string
  overlayPath?: string
  overlayStart?: number
  overlayDuration?: number
  overlayFadeOutDuration?: number // длительность исчезновения в миллисекундах
  strategyId: StrategyType
  profileSettings?: import('@shared/types').StrategyProfileSettings
  onLog?: (line: string) => void
  onProgress?: (line: string) => void
}): Promise<void> => {
  const {
    inputPath,
    outputPath,
    overlayPath,
    overlayStart = 0,
    overlayDuration = 5,
    overlayFadeOutDuration = 0, // по умолчанию без fade out
    strategyId,
    profileSettings,
    onLog,
    onProgress
  } = options

  logger.info('Starting video render', {
    inputPath,
    outputPath,
    strategyId,
    overlayPath: overlayPath ? 'present' : 'none',
    overlayStart,
    overlayDuration,
    overlayFadeOutDuration
  })

  const includeAudio = await hasAudioStream(inputPath)
  const durationSeconds = await getVideoDuration(inputPath)

  logger.debug('Video metadata', { includeAudio, durationSeconds })

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

      const videoFilter = buildStrategyFilter(strategyId, durationSeconds, profileSettings)

      if (overlayPath) {
        const overlayEnd = overlayStart + overlayDuration
        const fadeOutDurationSeconds = overlayFadeOutDuration / 1000 // конвертируем мс в секунды
        const fadeOutStart = overlayEnd - fadeOutDurationSeconds

        // Используем -loop 1 для overlay, чтобы он стал видеопотоком и можно было применить fade
        // Ограничиваем длительность overlay до overlayDuration + fadeOutDurationSeconds, чтобы fade успел завершиться
        // Время в overlay input идет от 0 до overlayDuration + fadeOutDurationSeconds
        // В fluent-ffmpeg inputOptions применяется к последнему добавленному input
        const overlayInputDuration =
          overlayFadeOutDuration > 0 && fadeOutStart > overlayStart
            ? overlayDuration + fadeOutDurationSeconds
            : overlayDuration
        command.input(overlayPath)
        command.inputOptions(['-loop', '1', '-t', String(overlayInputDuration)])

        // Строим фильтр overlay с плавным исчезновением
        // Используем фильтр fade с правильным временем относительно overlay input
        let overlayGraph: string
        if (overlayFadeOutDuration > 0 && fadeOutStart > overlayStart) {
          // Время начала fade относительно overlay input
          // overlay input длится overlayDuration + fadeOutDurationSeconds секунд (от 0 до overlayDuration + fadeOutDurationSeconds)
          // overlay отображается overlayDuration секунд (с overlayStart до overlayEnd в основном видео)
          // fade должен начаться в конце overlayDuration, т.е. в момент overlayDuration секунд в overlay input
          // fade длится fadeOutDurationSeconds
          const fadeOutStartInOverlay = overlayDuration
          // Важно: overlay должен отображаться до overlayEnd + fadeOutDurationSeconds, чтобы fade успел завершиться
          const overlayEndWithFade = overlayEnd + fadeOutDurationSeconds
          // Применяем fade out к overlay: fade начинается в fadeOutStartInOverlay и длится fadeOutDurationSeconds
          // format=rgba нужен для поддержки альфа-канала
          // Порядок: сначала обрабатываем оба потока, затем применяем scale2ref, затем fade, затем overlay
          overlayGraph = [
            `[0:v]${videoFilter}[v0]`,
            `[1:v]format=rgba[ov0]`,
            `[ov0][v0]scale2ref=w=iw:h=ih[ov1][v1]`,
            `[ov1]fade=t=out:st=${fadeOutStartInOverlay}:d=${fadeOutDurationSeconds}:alpha=1[ov]`,
            `[v1][ov]overlay=0:0:enable='between(t,${overlayStart},${overlayEndWithFade})'[vout]`
          ].join(';')
        } else {
          // Без fade out - простое включение/выключение
          overlayGraph = [
            `[0:v]${videoFilter}[v0]`,
            `[1:v]format=rgba[ov0]`,
            `[ov0][v0]scale2ref=w=iw:h=ih[ov][v1]`,
            `[v1][ov]overlay=0:0:enable='between(t,${overlayStart},${overlayEnd})'[vout]`
          ].join(';')
        }

        command.complexFilter(overlayGraph)
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
        if (includeAudio) outputOptions.push('-b:a', profile.audioBitrate, '-c:a', 'aac')
        else outputOptions.push('-an')
      } else {
        if (includeAudio) outputOptions.push('-b:a', profile.audioBitrate, '-c:a', 'aac')
      }

      command
        .outputOptions(outputOptions)
        .on('stderr', (line) => {
          onLog?.(line)
          logger.debug('FFmpeg stderr', { line })
        })
        .on('progress', (p) => {
          const msg = p?.timemark ? `time=${p.timemark}` : JSON.stringify(p)
          onProgress?.(msg)
          logger.debug('FFmpeg progress', { progress: p })
        })
        .on('error', (err) => {
          logger.error('FFmpeg render error', err instanceof Error ? err : new Error(String(err)), {
            inputPath,
            outputPath,
            strategyId
          })
          reject(err)
        })
        .on('end', () => {
          logger.info('Video render completed', { outputPath, strategyId })
          resolve()
        })
        .save(outputPath)
    })
  }

  const profile = await pickEncoderProfile(strategyId)
  const audioFilter = includeAudio ? buildAudioFilter(strategyId) : ''

  try {
    await runWithProfile(profile, audioFilter)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)

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

    if (profile.videoCodec !== 'libx264') {
      onLog?.(`Encoder ${profile.videoCodec} failed, retrying with libx264...`)
      await runWithProfile({ ...profile, videoCodec: 'libx264' }, audioFilter)
      return
    }

    throw error
  }
}
