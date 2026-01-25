// src/main/ipc/handlers/dialogs.ts
import type { IpcMain, OpenDialogOptions } from 'electron'
import { BrowserWindow, dialog } from 'electron'
import { IPC } from '@shared/ipc/channels'

function getDialogParentWindow(): BrowserWindow | undefined {
  return BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
}

async function pickDirectory(): Promise<string | null> {
  const options: OpenDialogOptions = { properties: ['openDirectory'] }

  const parent = getDialogParentWindow()
  const res = parent
    ? await dialog.showOpenDialog(parent, options)
    : await dialog.showOpenDialog(options)

  if (res.canceled || res.filePaths.length === 0) return null
  return res.filePaths[0]
}

export function registerDialogsHandlers(ipcMain: IpcMain): void {
  ipcMain.handle(IPC.SelectFolder, async (): Promise<string | null> => pickDirectory())
  ipcMain.handle(IPC.SelectOutputFolder, async (): Promise<string | null> => pickDirectory())
}
