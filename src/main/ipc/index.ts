// src/main/ipc/index.ts
import type { IpcMain } from 'electron'
import { registerDialogsHandlers } from './handlers/dialogs'
import { registerFsHandlers } from './handlers/fs'
import { registerOverlayHandlers } from './handlers/overlay'
import { registerFfmpegHandlers } from './handlers/ffmpeg'
import { registerProcessingHandlers } from './handlers/processing'

export function registerIpcHandlers(ipcMain: IpcMain): void {
  registerDialogsHandlers(ipcMain)
  registerFsHandlers(ipcMain)
  registerOverlayHandlers(ipcMain)
  registerFfmpegHandlers(ipcMain)
  registerProcessingHandlers(ipcMain)
}
