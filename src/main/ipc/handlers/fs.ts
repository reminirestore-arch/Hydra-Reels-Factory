// src/main/ipc/handlers/fs.ts
import type { IpcMain, IpcMainInvokeEvent } from 'electron'
import { IPC } from '@shared/ipc/channels'
import type { ScanFolderArgs, ScanFolderResult } from '@shared/ipc/contracts'

async function scanFolderImpl(path: string): Promise<ScanFolderResult> {
  // TODO: подключим реальную реализацию скана из legacy-кода
  // Сейчас главное — чтобы IPC-контур работал и проект компилировался.
  void path
  return []
}

export function registerFsHandlers(ipcMain: IpcMain): void {
  ipcMain.handle(
    IPC.ScanFolder,
    async (_event: IpcMainInvokeEvent, args: ScanFolderArgs): Promise<ScanFolderResult> => {
      return scanFolderImpl(args.path)
    }
  )
}
