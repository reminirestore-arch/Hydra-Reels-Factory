// src/main/ipc/handlers/ffmpeg.ts
import type { IpcMain, IpcMainInvokeEvent } from 'electron'
import path from 'node:path'
import { IPC } from '@shared/ipc/channels'
import type {
  ExtractFrameArgs,
  ExtractFrameResult,
  RenderStrategyPayload,
  RenderStrategyResult
} from '@shared/ipc/contracts'

import { extractFrameAsDataUrl, renderStrategyVideo } from '../../services/ffmpeg'


async function extractFrameImpl(args: ExtractFrameArgs): Promise<ExtractFrameResult> {
  const { path: inputPath, strategyId, atSeconds } = args

  // previewWidth/previewHeight — можно позже вынести в defaults.ts,
  // пока оставляем как в legacy: 450x800
  return extractFrameAsDataUrl(inputPath, 450, 800, strategyId, atSeconds ?? 0)
}

async function renderStrategyImpl(payload: RenderStrategyPayload): Promise<RenderStrategyResult> {
  const outputName = payload.outputName.endsWith('.mp4')
    ? payload.outputName
    : `${payload.outputName}.mp4`
  const outputPath = path.join(payload.outputDir, outputName)

  try {
    await renderStrategyVideo({
      inputPath: payload.inputPath,
      outputPath,
      overlayPath: payload.overlayPath,
      overlayStart: payload.overlayStart,
      overlayDuration: payload.overlayDuration,
      strategyId: payload.strategyId // StrategyType совпадает с 'IG1'|'IG2'|'IG3'|'IG4'
    })
    return true
  } catch (e) {
    console.error('renderStrategy error:', e)
    return false
  }
}

export function registerFfmpegHandlers(ipcMain: IpcMain): void {
  ipcMain.handle(
    IPC.ExtractFrame,
    async (_event: IpcMainInvokeEvent, args: ExtractFrameArgs): Promise<ExtractFrameResult> => {
      return extractFrameImpl(args)
    }
  )

  ipcMain.handle(
    IPC.RenderStrategy,
    async (
      _event: IpcMainInvokeEvent,
      payload: RenderStrategyPayload
    ): Promise<RenderStrategyResult> => {
      return renderStrategyImpl(payload)
    }
  )
}
