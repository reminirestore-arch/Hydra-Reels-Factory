// src/main/ipc/handlers/processing.ts
import type { IpcMain, IpcMainInvokeEvent } from 'electron'
import { IPC } from '@shared/ipc/channels'
import type { ProcessingStartPayload, Result } from '@shared/ipc/contracts'
import { ok, err, toUnknownErr } from './_result'
import { ProcessingStartPayloadSchema, safeParse } from '@shared/validation/schemas'
import { createLogger } from '@shared/logger'
import { runQueue } from '@services/processing/queue'

const logger = createLogger('ProcessingHandler')

let currentAbortController: AbortController | null = null

export function registerProcessingHandlers(ipcMain: IpcMain): void {
  ipcMain.handle(
    IPC.ProcessingStart,
    async (event: IpcMainInvokeEvent, payload: ProcessingStartPayload): Promise<Result<void>> => {
      try {
        if (currentAbortController) {
          return err('INTERNAL', 'Processing already running. Stop it first.')
        }

        const validation = safeParse(ProcessingStartPayloadSchema, payload)
        if (!validation.success) {
          logger.warn('Invalid ProcessingStart payload', { errors: validation.error.issues })
          return err(
            'VALIDATION',
            `Invalid payload: ${validation.error.issues.map((e) => e.message).join(', ')}`
          )
        }

        const controller = new AbortController()
        currentAbortController = controller
        const webContents = event.sender

        void runQueue(webContents, validation.data, controller.signal).finally(() => {
          currentAbortController = null
        })

        return ok(undefined)
      } catch (e) {
        logger.error('ProcessingStart error', e instanceof Error ? e : new Error(String(e)))
        return toUnknownErr(e)
      }
    }
  )

  ipcMain.handle(IPC.ProcessingStop, async (): Promise<Result<void>> => {
    try {
      if (currentAbortController) {
        currentAbortController.abort()
      }
      return ok(undefined)
    } catch (e) {
      logger.error('ProcessingStop error', e instanceof Error ? e : new Error(String(e)))
      return toUnknownErr(e)
    }
  })
}
