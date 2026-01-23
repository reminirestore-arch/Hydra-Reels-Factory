import ffmpeg from 'fluent-ffmpeg'
import type { StrategyType } from '../shared/types'
import ffmpegPath from 'ffmpeg-static'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import * as crypto from 'crypto'
import { join } from 'path'
import { tmpdir } from 'node:os'
import { readFileSync } from 'node:fs'

if (ffmpegPath) {
  ffmpeg.setFfmpegPath(ffmpegPath.replace('app.asar', 'app.asar.unpacked'))
}

const waitForFile = (filePath: string, timeout = 4000, interval = 100): Promise<void> => {
  return new Promise((resolve, reject) => {
    const startTime = Date.now()
    const check = (): void => {
      fs.access(filePath, fs.constants.F_OK, (err) => {
        if (!err) {
          setTimeout(() => resolve(), 50)
        } else if (Date.now() - startTime > timeout) {
          reject(new Error(`Timeout waiting for file: ${filePath}`))
        } else {
          setTimeout(check, interval)
        }
      })
    }
    check()
  })
}

const tempFiles = new Set<string>()

const createTempPath = (prefix: string, ext: string): string => {
  const tempDir = os.tmpdir()
  // Создаем подпапку, чтобы не мусорить в корне tmp
  const appTempDir = path.join(tempDir, 'hydra-reels-temp')

  if (!fs.existsSync(appTempDir)) {
    fs.mkdirSync(appTempDir, { recursive: true })
  }

  const fileName = `${prefix}_${crypto.randomUUID()}.${ext}`
  const filePath = path.join(appTempDir, fileName)
  tempFiles.add(filePath)
  return filePath
}

const removeTempFile = async (filePath: string): Promise<void> => {
  if (!tempFiles.has(filePath)) return
  try {
    await fs.promises.unlink(filePath)
  } catch {
    // ignore cleanup failures
  } finally {
    tempFiles.delete(filePath)
  }
}

export const cleanupTempFiles = async (): Promise<void> => {
  await Promise.allSettled(Array.from(tempFiles).map((filePath) => removeTempFile(filePath)))
}

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
  filePath: string,
  strategyId?: StrategyType,
  previewWidth = 450,
  previewHeight = 800
): Promise<string> {
  const outputPath = join(tmpdir(), `frame-${Date.now()}.png`)

  const vf = strategyId
    ? `${buildStrategyFilter(strategyId)},scale=${previewWidth}:${previewHeight}`
    : `scale=${previewWidth}:${previewHeight}`

  await new Promise<void>((resolve, reject) => {
    ffmpeg(filePath)
      .seekInput('0.5')
      .frames(1)
      .outputOptions(['-vf', vf])
      .output(outputPath)
      .on('end', resolve)
      .on('error', reject)
      .run()
  })

  const buffer = readFileSync(outputPath)
  return `data:image/png;base64,${buffer.toString('base64')}`
}

export const generateThumbnail = async (
  filePath: string
): Promise<{ path: string; dataUrl: string } | null> => {
  const outputPath = createTempPath('thumb', 'jpg')

  return new Promise((resolve) => {
    ffmpeg(filePath)
      .seekInput('0.5')
      .frames(1)
      .outputOptions(['-vf scale=360:-2'])
      .output(outputPath)
      .on('end', async () => {
        try {
          await waitForFile(outputPath)
          const imgBuffer = fs.readFileSync(outputPath)
          const base64 = `data:image/jpeg;base64,${imgBuffer.toString('base64')}`
          resolve({ path: outputPath, dataUrl: base64 })
        } catch (error) {
          console.error('Ошибка чтения миниатюры:', error)
          await removeTempFile(outputPath)
          resolve(null)
        }
      })
      .on('error', (err) => {
        console.error('FFmpeg Error:', err)
        void removeTempFile(outputPath)
        resolve(null)
      })
      .run()
  })
}

export const saveOverlayFromDataUrl = async (dataUrl: string): Promise<string> => {
  const base64Data = dataUrl.replace(/^data:image\/(png|jpeg);base64,/, '')
  const outputPath = createTempPath('overlay', 'png')
  await fs.promises.writeFile(outputPath, Buffer.from(base64Data, 'base64'))
  return outputPath
}

const buildStrategyFilter = (strategyId: StrategyType): string => {
  // Нормализация под 9:16 и ровно 1080x1920 (в редакторе это эквивалентно: cover + center-crop)
  const normalize = 'scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1'

  switch (strategyId) {
    case 'IG1':
      // лёгкий zoom + vignette, затем нормализация (важно: в конце всегда ровно 1080x1920)
      return `crop=iw*0.98:ih*0.98,${normalize},vignette=PI/8`

    case 'IG2':
      // скорость/тон, затем нормализация
      return `setpts=0.99*PTS,eq=gamma=1.0:saturation=1.2,${normalize}`

    case 'IG3':
      // sharp/contrast/fade, затем нормализация
      return `unsharp=5:5:0.5:5:5:0.0,eq=contrast=1.1,fade=t=in:st=0:d=0.3,fade=t=out:st=0:d=0.3,${normalize}`

    case 'IG4':
    default:
      // rotate + grain + fade (уже приводит к 1080x1920, но SAR всё равно фиксируем)
      return 'rotate=0.3*PI/180,scale=1085:1930,crop=1080:1920,noise=c0s=7:allf=t,fade=t=in:st=0:d=0.5,fade=t=out:st=0:d=0.5,setsar=1'
  }
}

const buildAudioFilter = (strategyId: 'IG1' | 'IG2' | 'IG3' | 'IG4'): string => {
  switch (strategyId) {
    case 'IG1':
      return 'acompressor=threshold=-12dB:ratio=2:attack=200:release=1000'
    case 'IG2':
      return 'atempo=1.01'
    case 'IG3':
      // БЕЗОПАСНЫЙ ВАРИАНТ: V-shape EQ без спецсимволов |
      return 'equalizer=f=200:t=q:w=1:g=-2,equalizer=f=6000:t=q:w=1:g=2'
    case 'IG4':
      // БЕЗОПАСНЫЙ ВАРИАНТ: High shelf (air) + компрессия без вложенных кавычек
      return 'acompressor=threshold=-20dB:ratio=9:attack=200:release=1000,treble=g=5:f=12000'
    default:
      return ''
  }
}

export const renderStrategyVideo = async (options: {
  inputPath: string
  outputPath: string
  overlayPath?: string
  overlayStart?: number
  overlayDuration?: number
  strategyId: 'IG1' | 'IG2' | 'IG3' | 'IG4'
}): Promise<void> => {
  const {
    inputPath,
    outputPath,
    overlayPath,
    overlayStart = 0,
    overlayDuration = 5,
    strategyId
  } = options
  const includeAudio = await hasAudioStream(inputPath)

  const runWithCodec = (codec: string, audioFilter: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      const command = ffmpeg(inputPath)
      const videoFilter = buildStrategyFilter(strategyId)

      const filterChain: string[] = [videoFilter]

      // ИСПРАВЛЕНИЕ: Используем complexFilter для оверлея
      if (overlayPath) {
        command.input(overlayPath)
        const overlayEnd = overlayStart + overlayDuration

        const videoFilter = filterChain.join(',') // то, что уже собрал до overlay
        const graph = [
          `[0:v]${videoFilter}[v0]`,
          `[1:v]format=rgba[ov0]`,
          `[ov0][v0]scale2ref=w=iw:h=ih[ov][v1]`,
          `[v1][ov]overlay=0:0:enable='between(t,${overlayStart},${overlayEnd})'[vout]`
        ].join(';')

        command.complexFilter(graph)

        const outputOptions = [
          '-map_metadata',
          '-1',
          '-map',
          '[vout]',
          ...(includeAudio ? ['-map', '0:a?'] : ['-an']),
          '-b:v',
          '12M',
          '-c:v',
          codec,
          ...(includeAudio ? ['-b:a', '256k', '-c:a', 'aac'] : []),
          '-movflags',
          '+faststart',
          '-pix_fmt',
          'yuv420p'
        ]

        command.outputOptions(outputOptions)
      } else {
        // videoFilters подходит только для одного входа
        command.videoFilters(filterChain.join(','))
      }

      if (includeAudio && audioFilter) {
        command.audioFilters(audioFilter)
      }

      const outputOptions = ['-map_metadata', '-1', '-b:v', '12M', '-c:v', codec]

      if (includeAudio) {
        outputOptions.push('-b:a', '256k', '-c:a', 'aac')
      } else {
        outputOptions.push('-an')
      }

      command
        .outputOptions(outputOptions)
        .on('stderr', (stderrLine) => console.log('FFmpeg Stderr:', stderrLine)) // Логируем детали
        .on('error', (err) => reject(err))
        .on('end', () => resolve())
        .save(outputPath)
    })
  }

  try {
    const audioFilter = includeAudio ? buildAudioFilter(strategyId) : ''
    try {
      await runWithCodec('h264_videotoolbox', audioFilter)
    } catch (error) {
      const message = String(error)
      // Если ошибка связана с аудио-фильтрами, пробуем без них
      if (
        includeAudio &&
        audioFilter &&
        (message.includes('No such filter') ||
          message.includes('Error while filtering') ||
          message.includes('matches no streams'))
      ) {
        console.warn('Audio filter failed, retrying without audio filters...')
        await runWithCodec('h264_videotoolbox', '')
        return
      }
      throw error
    }
  } catch (error) {
    if (String(error).includes('Unknown encoder')) {
      const audioFilter = includeAudio ? buildAudioFilter(strategyId) : ''
      try {
        await runWithCodec('libx264', audioFilter)
      } catch {
        // Fallback без аудио фильтров для libx264
        console.warn('Software encoding with filters failed, retrying plain...')
        await runWithCodec('libx264', '')
        return
      }
      return
    }
    throw error
  }
}
