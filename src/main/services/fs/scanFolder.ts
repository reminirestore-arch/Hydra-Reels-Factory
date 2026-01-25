// src/main/services/fs/scanFolder.ts
import * as fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import pLimit from 'p-limit'
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
    .filter((name) => VIDEO_EXT.has(path.extname(name).toLowerCase()))
    .sort((a, b) => a.localeCompare(b))

  const limit = pLimit(4)

  const tasks = fileNames.map((filename) =>
    limit(async () => {
      const fullPath = path.join(pathToDir, filename)
      const [duration, thumb] = await Promise.all([
        getVideoDuration(fullPath),
        extractFrameAsDataUrl(fullPath, 180, 320, undefined, 0)
      ])

      return createVideoFile({
        id: crypto.randomUUID(),
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
