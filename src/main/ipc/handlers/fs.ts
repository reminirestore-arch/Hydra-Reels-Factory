// src/main/ipc/handlers/fs.ts
import type { IpcMain, IpcMainInvokeEvent } from 'electron'
import { IPC } from '@shared/ipc/channels'
import type { ScanFolderArgs, ScanFolderResult, Result } from '@shared/ipc/contracts'
import { ok, err, toUnknownErr } from './_result'
import { ScanFolderArgsSchema, safeParse } from '@shared/validation/schemas'
import { pathValidator } from '@shared/security/pathValidation'
import { createLogger } from '@shared/logger'
import { scanFolder } from '@services/fs/scanFolder'

const logger = createLogger('FSHandler')

async function scanFolderImpl(path: string): Promise<ScanFolderResult> {
  // Validate and sanitize path
  const pathValidation = pathValidator.validatePath(path)
  if (!pathValidation.valid) {
    logger.error('Invalid path in scanFolder', undefined, { path, error: pathValidation.error })
    throw new Error(pathValidation.error)
  }

  logger.info('Scanning folder', { path: pathValidation.sanitized })
  return scanFolder(pathValidation.sanitized!)
}

export function registerFsHandlers(ipcMain: IpcMain): void {
  ipcMain.handle(
    IPC.ScanFolder,
    async (_event: IpcMainInvokeEvent, args: ScanFolderArgs): Promise<Result<ScanFolderResult>> => {
      try {
        // Validate input with Zod
        const validation = safeParse(ScanFolderArgsSchema, args)
        if (!validation.success) {
          logger.warn('Invalid ScanFolder args', { errors: validation.error.issues })
          return err(
            'VALIDATION',
            `Invalid arguments: ${validation.error.issues.map((e) => e.message).join(', ')}`
          )
        }

        return ok(await scanFolderImpl(validation.data.path))
      } catch (e) {
        logger.error('ScanFolder error', e instanceof Error ? e : new Error(String(e)))
        return toUnknownErr(e)
      }
    }
  )
}
