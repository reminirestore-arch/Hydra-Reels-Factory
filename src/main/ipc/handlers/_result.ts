// src/main/ipc/handlers/_result.ts
import type { Result, IpcError, IpcErrorCode } from '@shared/ipc/contracts'

export const ok = <T>(data: T): Result<T> => ({ ok: true, data })

export const err = (code: IpcErrorCode, message: string, details?: unknown): Result<never> => ({
  ok: false,
  error: { code, message, details } satisfies IpcError
})

export const toUnknownErr = (e: unknown): Result<never> => {
  const message = e instanceof Error ? e.message : String(e)
  return err('UNKNOWN', message)
}
