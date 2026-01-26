// src/main/services/fs/scanFolder.ts
import * as fs from 'node:fs'
import { extname, join as pathJoin } from 'node:path'
import { randomUUID } from 'node:crypto'
import type { VideoFile } from '@shared/types'
import { createVideoFile } from '@shared/domain/video'
import { extractFrameAsDataUrl, getVideoDuration } from '../ffmpeg'

const VIDEO_EXT = new Set(['.mp4', '.mov', '.m4v', '.webm', '.mkv'])

export async function scanFolder(pathToDir: string): Promise<VideoFile[]> {
  const stat = await fs.promises.stat(pathToDir)
  if (!stat.isDirectory()) {
    throw new Error('Input path is not a directory')
  }

  const dirents = await fs.promises.readdir(pathToDir, { withFileTypes: true })
  const fileNames = dirents
    .filter((d) => d.isFile())
    .map((d) => d.name)
    .filter((name) => VIDEO_EXT.has(extname(name).toLowerCase()))
    .sort((a, b) => a.localeCompare(b))

  // p-limit v7 is ESM-only, use dynamic import
  const { default: pLimit } = await import('p-limit')
  const limit = pLimit(4)

  const tasks = fileNames.map((filename) =>
    limit(async () => {
      const fullPath = pathJoin(pathToDir, filename)
      const [duration, thumb] = await Promise.all([
        getVideoDuration(fullPath),
        extractFrameAsDataUrl(fullPath, 180, 320, undefined, 0)
      ])

      return createVideoFile({
        id: randomUUID(),
        filename,
        fullPath,
        duration,
        thumbnailDataUrl: thumb,
        thumbnailPath: ''
      })
    })
  )

  return Promise.all(tasks)
}
