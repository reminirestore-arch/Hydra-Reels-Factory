// src/main/ipc/handlers/overlay.ts
import type { IpcMain, IpcMainInvokeEvent } from 'electron'
import { IPC } from '@shared/ipc/channels'
import type { SaveOverlayArgs, SaveOverlayResult, Result } from '@shared/ipc/contracts'
import { ok, err, toUnknownErr } from './_result'
import { saveOverlayFromDataUrl } from '../../services/ffmpeg'

async function saveOverlayImpl(dataUrl: string): Promise<SaveOverlayResult> {
  return saveOverlayFromDataUrl(dataUrl)
}

export function registerOverlayHandlers(ipcMain: IpcMain): void {
  ipcMain.handle(
    IPC.SaveOverlay,
    async (_event: IpcMainInvokeEvent, args: SaveOverlayArgs): Promise<Result<SaveOverlayResult>> => {
      try {
        const dataUrl = args?.dataUrl ?? ''
        if (!dataUrl.startsWith('data:image/')) {
          return err('VALIDATION', 'Invalid image dataUrl')
        }
        return ok(await saveOverlayImpl(dataUrl))
      } catch (e) {
        return toUnknownErr(e)
      }
    }
  )
}
