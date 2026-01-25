// src/main/ipc/handlers/dialogs.ts
import type { IpcMain, OpenDialogOptions } from 'electron'
import { BrowserWindow, dialog } from 'electron'
import { IPC } from '@shared/ipc/channels'
import type { SelectFolderResult, SelectOutputFolderResult, Result } from '@shared/ipc/contracts'
import { ok, toUnknownErr } from './_result'

function getDialogParentWindow(): BrowserWindow | undefined {
  return BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
}

async function pickDirectory(): Promise<string | null> {
  const options: OpenDialogOptions = {
    properties: ['openDirectory', 'createDirectory'],
    title: 'Select folder'
  }
  const parent = getDialogParentWindow()
  const result = await dialog.showOpenDialog(parent ?? undefined, options)
  if (result.canceled || result.filePaths.length === 0) return null
  return result.filePaths[0] ?? null
}

export function registerDialogsHandlers(ipcMain: IpcMain): void {
  ipcMain.handle(IPC.SelectFolder, async (): Promise<Result<SelectFolderResult>> => {
    try {
      return ok(await pickDirectory())
    } catch (e) {
      return toUnknownErr(e)
    }
  })

  ipcMain.handle(IPC.SelectOutputFolder, async (): Promise<Result<SelectOutputFolderResult>> => {
    try {
      return ok(await pickDirectory())
    } catch (e) {
      return toUnknownErr(e)
    }
  })
}
