// src/main/ipc/handlers/overlay.ts
import type { IpcMain, IpcMainInvokeEvent } from 'electron'
import { IPC } from '@shared/ipc/channels'
import type { SaveOverlayArgs, SaveOverlayResult, Result } from '@shared/ipc/contracts'
import { ok, err, toUnknownErr } from './_result'
import { SaveOverlayArgsSchema, safeParse } from '@shared/validation/schemas'
import { sanitizeDataUrl } from '@shared/security/sanitization'
import { createLogger } from '@shared/logger'
import { saveOverlayFromDataUrl } from '@services/ffmpeg'

const logger = createLogger('OverlayHandler')

async function saveOverlayImpl(dataUrl: string): Promise<SaveOverlayResult> {
  // Sanitize data URL
  const sanitization = sanitizeDataUrl(dataUrl)
  if (!sanitization.valid) {
    logger.error('Invalid data URL', undefined, { error: sanitization.error })
    throw new Error(sanitization.error)
  }

  logger.info('Saving overlay from data URL')
  return saveOverlayFromDataUrl(sanitization.sanitized!)
}

export function registerOverlayHandlers(ipcMain: IpcMain): void {
  ipcMain.handle(
    IPC.SaveOverlay,
    async (
      _event: IpcMainInvokeEvent,
      args: SaveOverlayArgs
    ): Promise<Result<SaveOverlayResult>> => {
      try {
        // Validate input with Zod
        const validation = safeParse(SaveOverlayArgsSchema, args)
        if (!validation.success) {
          logger.warn('Invalid SaveOverlay args', { errors: validation.error.issues })
          return err(
            'VALIDATION',
            `Invalid arguments: ${validation.error.issues.map((e) => e.message).join(', ')}`
          )
        }

        return ok(await saveOverlayImpl(validation.data.dataUrl))
      } catch (e) {
        logger.error('SaveOverlay error', e instanceof Error ? e : new Error(String(e)))
        return toUnknownErr(e)
      }
    }
  )
}
