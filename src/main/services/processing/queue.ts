// src/main/services/processing/queue.ts
// Orchestrates batch processing in Main process. Uses p-limit, runRenderTask, emits progress via IPC.
import type { WebContents } from 'electron'
import { IPC } from '@shared/ipc/channels'
import type {
  ProcessingStartPayload,
  ProcessingTask,
  ProcessingProgressEvent,
  ProcessingCompleteEvent,
  FfmpegLogEvent,
  RenderStrategyPayload
} from '@shared/ipc/contracts'
import { getConfig } from '@shared/config'
import { retry } from '@shared/utils/retry'
import { runRenderTask } from '@services/ffmpeg/runRenderTask'
import { createLogger } from '@shared/logger'

const logger = createLogger('ProcessingQueue')
const config = getConfig()

function toRenderPayload(outputDir: string, task: ProcessingTask): RenderStrategyPayload {
  return {
    inputPath: task.inputPath,
    outputDir,
    outputName: task.outputName,
    strategyId: task.strategyId,
    overlayPath: task.overlayPath,
    overlayStart: task.overlayStart,
    overlayDuration: task.overlayDuration,
    overlayFadeOutDuration: task.overlayFadeOutDuration,
    profileSettings: task.profileSettings,
    fileId: task.fileId,
    filename: task.filename
  }
}

export async function runQueue(
  webContents: WebContents,
  payload: ProcessingStartPayload,
  signal: AbortSignal
): Promise<void> {
  const { outputDir, tasks } = payload
  const total = tasks.length
  let completed = 0

  const sendProgress = (ev: ProcessingProgressEvent): void => {
    webContents.send(IPC.ProcessingOnProgress, ev)
  }

  const sendComplete = (ev: ProcessingCompleteEvent): void => {
    webContents.send(IPC.ProcessingOnComplete, ev)
  }

  const sendLog = (e: FfmpegLogEvent): void => {
    webContents.send(IPC.FfmpegLog, e)
  }

  const limitModule = await import('p-limit')
  const pLimit = limitModule.default
  const limit = pLimit(config.ffmpeg.maxConcurrent)

  const runOne = async (task: ProcessingTask): Promise<void> => {
    if (signal.aborted) return

    const renderPayload = toRenderPayload(outputDir, task)
    sendProgress({
      fileId: task.fileId,
      filename: task.filename,
      strategyId: task.strategyId,
      status: 'started',
      completed,
      total,
      percent: total > 0 ? (completed / total) * 100 : 0
    })

    try {
      const ok = await retry(() => runRenderTask(renderPayload, sendLog), {
        maxAttempts: config.processing.retryAttempts
      })
      completed += 1
      sendProgress({
        fileId: task.fileId,
        filename: task.filename,
        strategyId: task.strategyId,
        status: ok ? 'done' : 'error',
        completed,
        total,
        percent: total > 0 ? (completed / total) * 100 : 0
      })
    } catch (e) {
      logger.error('Task failed', e instanceof Error ? e : new Error(String(e)), {
        fileId: task.fileId,
        filename: task.filename,
        strategyId: task.strategyId
      })
      completed += 1
      sendProgress({
        fileId: task.fileId,
        filename: task.filename,
        strategyId: task.strategyId,
        status: 'error',
        completed,
        total,
        percent: total > 0 ? (completed / total) * 100 : 0
      })
    }
  }

  try {
    const runners = tasks.map((task) => () => runOne(task))
    await Promise.all(runners.map((r) => limit(r)))
  } finally {
    sendComplete({
      completed,
      total,
      stopped: signal.aborted
    })
  }
}
