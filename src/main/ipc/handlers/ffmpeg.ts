import type { IpcMain, IpcMainInvokeEvent } from 'electron'
import { join as pathJoin } from 'node:path'
import { IPC } from '@shared/ipc/channels'
import type {
  ExtractFrameArgs,
  ExtractFrameResult,
  RenderStrategyPayload,
  RenderStrategyResult,
  Result,
  FfmpegLogEvent
} from '@shared/ipc/contracts'
import { ok, err, toUnknownErr } from './_result'
import {
  ExtractFrameArgsSchema,
  RenderStrategyPayloadSchema,
  safeParse
} from '@shared/validation/schemas'
import { pathValidator } from '@shared/security/pathValidation'
import { createLogger } from '@shared/logger'

const logger = createLogger('FFmpegHandler')

import { extractFrameAsDataUrl, renderStrategyVideo } from '@services/ffmpeg'

async function extractFrameImpl(args: ExtractFrameArgs): Promise<ExtractFrameResult> {
  const { path: inputPath, strategyId, atSeconds, profileSettings } = args

  // Validate and sanitize path
  const pathValidation = pathValidator.validatePath(inputPath)
  if (!pathValidation.valid) {
    logger.error('Invalid path in extractFrame', undefined, {
      path: inputPath,
      error: pathValidation.error
    })
    throw new Error(pathValidation.error)
  }

  logger.info('Extracting frame', {
    path: inputPath,
    strategyId,
    atSeconds,
    hasProfileSettings: !!profileSettings
  })
  return extractFrameAsDataUrl(
    pathValidation.sanitized!,
    450,
    800,
    strategyId,
    atSeconds ?? 0,
    profileSettings
  )
}

async function renderStrategyImpl(
  event: IpcMainInvokeEvent,
  payload: RenderStrategyPayload
): Promise<RenderStrategyResult> {
  // Validate and sanitize paths
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

  const sendLog = (level: FfmpegLogEvent['level'], line: string): void => {
    event.sender.send(IPC.FfmpegLog, {
      ts: Date.now(),
      level,
      line,
      fileId: payload.fileId,
      filename: payload.filename,
      strategyId: payload.strategyId
    } satisfies FfmpegLogEvent)
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
      strategyId: payload.strategyId,
      profileSettings: payload.profileSettings,
      onLog: (line) => sendLog('stderr', line),
      onProgress: (p) => sendLog('progress', p)
    })
    logger.info('Render completed successfully', { outputPath })
    return true
  } catch (e) {
    const error = e instanceof Error ? e : new Error(String(e))
    logger.error('Render failed', error, { outputPath })
    sendLog('info', `Render failed: ${error.message}`)
    return false
  }
}

export function registerFfmpegHandlers(ipcMain: IpcMain): void {
  ipcMain.handle(
    IPC.ExtractFrame,
    async (
      _event: IpcMainInvokeEvent,
      args: ExtractFrameArgs
    ): Promise<Result<ExtractFrameResult>> => {
      try {
        // Validate input with Zod
        const validation = safeParse(ExtractFrameArgsSchema, args)
        if (!validation.success) {
          logger.warn('Invalid ExtractFrame args', { errors: validation.error.issues })
          return err(
            'VALIDATION',
            `Invalid arguments: ${validation.error.issues.map((e) => e.message).join(', ')}`
          )
        }

        return ok(await extractFrameImpl(validation.data))
      } catch (e) {
        logger.error('ExtractFrame error', e instanceof Error ? e : new Error(String(e)))
        return toUnknownErr(e)
      }
    }
  )

  ipcMain.handle(
    IPC.RenderStrategy,
    async (
      event: IpcMainInvokeEvent,
      payload: RenderStrategyPayload
    ): Promise<Result<RenderStrategyResult>> => {
      try {
        // Validate input with Zod
        const validation = safeParse(RenderStrategyPayloadSchema, payload)
        if (!validation.success) {
          logger.warn('Invalid RenderStrategy payload', { errors: validation.error.issues })
          return err(
            'VALIDATION',
            `Invalid payload: ${validation.error.issues.map((e) => e.message).join(', ')}`
          )
        }

        return ok(await renderStrategyImpl(event, validation.data))
      } catch (e) {
        logger.error('RenderStrategy error', e instanceof Error ? e : new Error(String(e)))
        return toUnknownErr(e)
      }
    }
  )
}
