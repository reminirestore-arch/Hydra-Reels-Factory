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

import { extractFrameAsDataUrl, renderStrategyVideo } from '../../services/ffmpeg'

async function extractFrameImpl(args: ExtractFrameArgs): Promise<ExtractFrameResult> {
  const { path: inputPath, strategyId, atSeconds } = args
  console.log(`[IPC] extractFrameImpl called for: ${inputPath}`)
  return extractFrameAsDataUrl(inputPath, 450, 800, strategyId, atSeconds ?? 0)
}

async function renderStrategyImpl(
  event: IpcMainInvokeEvent,
  payload: RenderStrategyPayload
): Promise<RenderStrategyResult> {
  const outputName = payload.outputName.endsWith('.mp4')
    ? payload.outputName
    : `${payload.outputName}.mp4`
  const outputPath = pathJoin(payload.outputDir, outputName)

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
      inputPath: payload.inputPath,
      outputPath,
      overlayPath: payload.overlayPath,
      overlayStart: payload.overlayStart,
      overlayDuration: payload.overlayDuration,
      strategyId: payload.strategyId,
      onLog: (line) => sendLog('stderr', line),
      onProgress: (p) => sendLog('progress', p)
    })
    return true
  } catch (e) {
    sendLog('info', `Render failed: ${e instanceof Error ? e.message : String(e)}`)
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
        if (!args?.path) return err('VALIDATION', 'Path is required')
        return ok(await extractFrameImpl(args))
      } catch (e) {
        // Теперь ошибка дойдет сюда из сервиса и будет отправлена фронтенду
        console.error('[IPC] extractFrame error:', e)
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
        if (!payload?.inputPath) return err('VALIDATION', 'inputPath is required')
        if (!payload?.outputDir) return err('VALIDATION', 'outputDir is required')
        if (!payload?.outputName) return err('VALIDATION', 'outputName is required')
        return ok(await renderStrategyImpl(event, payload))
      } catch (e) {
        return toUnknownErr(e)
      }
    }
  )
}
