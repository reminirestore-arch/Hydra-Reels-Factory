// src/main/ipc/handlers/fs.ts
import type { IpcMain, IpcMainInvokeEvent } from 'electron'
import { IPC } from '@shared/ipc/channels'
import type { ScanFolderArgs, ScanFolderResult, Result } from '@shared/ipc/contracts'
import { ok, err, toUnknownErr } from './_result'
import { scanFolder } from '@services/fs/scanFolder'

async function scanFolderImpl(path: string): Promise<ScanFolderResult> {
  return scanFolder(path)
}

export function registerFsHandlers(ipcMain: IpcMain): void {
  ipcMain.handle(
    IPC.ScanFolder,
    async (_event: IpcMainInvokeEvent, args: ScanFolderArgs): Promise<Result<ScanFolderResult>> => {
      try {
        const p = (args?.path ?? '').trim()
        if (!p) return err('VALIDATION', 'Path is required')
        return ok(await scanFolderImpl(p))
      } catch (e) {
        return toUnknownErr(e)
      }
    }
  )
}
