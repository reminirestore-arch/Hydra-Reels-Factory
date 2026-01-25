// src/main/ipc/handlers/overlay.ts
import type { IpcMain, IpcMainInvokeEvent } from 'electron'
import { IPC } from '@shared/ipc/channels'
import type { SaveOverlayArgs, SaveOverlayResult } from '@shared/ipc/contracts'

import { saveOverlayFromDataUrl } from '../../services/ffmpeg'


async function saveOverlayImpl(dataUrl: string): Promise<SaveOverlayResult> {
  const savedPath = await saveOverlayFromDataUrl(dataUrl)
  return { path: savedPath }
}

export function registerOverlayHandlers(ipcMain: IpcMain): void {
  ipcMain.handle(
    IPC.SaveOverlay,
    async (_event: IpcMainInvokeEvent, args: SaveOverlayArgs): Promise<SaveOverlayResult> => {
      return saveOverlayImpl(args.dataUrl)
    }
  )
}
