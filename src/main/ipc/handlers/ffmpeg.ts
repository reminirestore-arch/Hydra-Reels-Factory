import type { IpcMain, IpcMainInvokeEvent } from 'electron'
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
import { extractFrameAsDataUrl } from '@services/ffmpeg'
import { runRenderTask } from '@services/ffmpeg/runRenderTask'

const logger = createLogger('FFmpegHandler')

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
  const sendLog = (e: FfmpegLogEvent): void => {
    event.sender.send(IPC.FfmpegLog, e)
  }
  return runRenderTask(payload, sendLog)
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
