// src/main/services/ffmpeg/runRenderTask.ts
// Shared "run one render" helper used by IPC RenderStrategy handler and processing queue.
import { join as pathJoin } from 'node:path'
import type { RenderStrategyPayload, FfmpegLogEvent } from '@shared/ipc/contracts'
import { pathValidator } from '@shared/security/pathValidation'
import { createLogger } from '@shared/logger'
import { renderStrategyVideo } from './index'

const logger = createLogger('runRenderTask')

export type SendLog = (e: FfmpegLogEvent) => void

export async function runRenderTask(
  payload: RenderStrategyPayload,
  sendLog: SendLog
): Promise<boolean> {
  const inputPathValidation = pathValidator.validatePath(payload.inputPath)
  if (!inputPathValidation.valid) {
    logger.error('Invalid input path', undefined, {
      path: payload.inputPath,
      error: inputPathValidation.error
    })
    throw new Error(inputPathValidation.error)
  }

  const outputDirValidation = pathValidator.validatePath(payload.outputDir)
  if (!outputDirValidation.valid) {
    logger.error('Invalid output directory', undefined, {
      path: payload.outputDir,
      error: outputDirValidation.error
    })
    throw new Error(outputDirValidation.error)
  }

  const sanitizedOutputName = pathValidator.sanitizeFilename(payload.outputName)
  const outputName = sanitizedOutputName.endsWith('.mp4')
    ? sanitizedOutputName
    : `${sanitizedOutputName}.mp4`
  const outputPath = pathJoin(outputDirValidation.sanitized!, outputName)

  logger.info('Rendering strategy', {
    inputPath: inputPathValidation.sanitized,
    outputPath,
    strategyId: payload.strategyId
  })

  const log = (level: FfmpegLogEvent['level'], line: string): void => {
    sendLog({
      ts: Date.now(),
      level,
      line,
      fileId: payload.fileId,
      filename: payload.filename,
      strategyId: payload.strategyId
    })
  }

  try {
    await renderStrategyVideo({
      inputPath: inputPathValidation.sanitized!,
      outputPath,
      overlayPath: payload.overlayPath
        ? pathValidator.validatePath(payload.overlayPath).sanitized
        : undefined,
      overlayStart: payload.overlayStart,
      overlayDuration: payload.overlayDuration,
      overlayFadeOutDuration: payload.overlayFadeOutDuration,
      overlayFadeInDuration: payload.overlayFadeInDuration,
      strategyId: payload.strategyId,
      profileSettings: payload.profileSettings,
      onLog: (line) => log('stderr', line),
      onProgress: (p) => log('progress', p)
    })
    logger.info('Render completed successfully', { outputPath })
    return true
  } catch (e) {
    const error = e instanceof Error ? e : new Error(String(e))
    logger.error('Render failed', error, { outputPath })
    log('info', `Render failed: ${error.message}`)
    return false
  }
}
