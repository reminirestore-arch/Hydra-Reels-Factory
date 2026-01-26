import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import * as crypto from 'node:crypto'

const tempFiles = new Set<string>()

export function createTempPath(prefix: string, ext: string): string {
  const tempDir = os.tmpdir()
  const appTempDir = path.join(tempDir, 'hydra-reels-temp')

  if (!fs.existsSync(appTempDir)) {
    fs.mkdirSync(appTempDir, { recursive: true })
  }

  const fileName = `${prefix}_${crypto.randomUUID()}.${ext}`
  const filePath = path.join(appTempDir, fileName)
  tempFiles.add(filePath)
  return filePath
}

export async function removeTempFile(filePath: string): Promise<void> {
  if (!tempFiles.has(filePath)) return
  try {
    await fs.promises.unlink(filePath)
  } catch {
    // ignore
  } finally {
    tempFiles.delete(filePath)
  }
}

export async function cleanupTempFiles(): Promise<void> {
  await Promise.allSettled(Array.from(tempFiles).map((p) => removeTempFile(p)))
}

export function waitForFile(filePath: string, timeout = 4000, interval = 100): Promise<void> {
  return new Promise((resolve, reject) => {
    const startTime = Date.now()
    const check = (): void => {
      fs.access(filePath, fs.constants.F_OK, (err) => {
        if (!err) {
          setTimeout(() => resolve(), 50)
        } else if (Date.now() - startTime > timeout) {
          reject(new Error(`Timeout waiting for file: ${filePath}`))
        } else {
          setTimeout(check, interval)
        }
      })
    }
    check()
  })
}
