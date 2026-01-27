// src/main/services/fs/scanFolder.ts
import * as fs from 'node:fs'
import { extname, join as pathJoin } from 'node:path'
import { randomUUID } from 'node:crypto'
import type { VideoFile } from '@shared/types'
import { createVideoFile } from '@shared/domain/video'
import { extractFrameAsDataUrl, getVideoDuration } from '@services/ffmpeg'
import { getConfig } from '@shared/config'
import { createLogger } from '@shared/logger'
import { pathValidator } from '@shared/security/pathValidation'

const logger = createLogger('ScanFolder')
const config = getConfig()
const VIDEO_EXT = new Set(config.paths.allowedExtensions)

export async function scanFolder(pathToDir: string): Promise<VideoFile[]> {
  // Validate path
  const pathValidation = pathValidator.validatePath(pathToDir)
  if (!pathValidation.valid) {
    logger.error('Invalid path', undefined, { path: pathToDir, error: pathValidation.error })
    throw new Error(pathValidation.error)
  }

  const validatedPath = pathValidation.sanitized!

  const stat = await fs.promises.stat(validatedPath)
  if (!stat.isDirectory()) {
    throw new Error('Input path is not a directory')
  }

  logger.info('Scanning folder', { path: validatedPath })

  const dirents = await fs.promises.readdir(validatedPath, { withFileTypes: true })
  const fileNames = dirents
    .filter((d) => d.isFile())
    .map((d) => d.name)
    .filter((name) => {
      const ext = extname(name).toLowerCase()
      const isValid = VIDEO_EXT.has(ext)
      if (!isValid) {
        logger.debug('Skipping file with invalid extension', { filename: name, extension: ext })
      }
      return isValid
    })
    .sort((a, b) => a.localeCompare(b))

  logger.info(`Found ${fileNames.length} video files`, { count: fileNames.length })

  // p-limit v7 is ESM-only, use dynamic import
  const { default: pLimit } = await import('p-limit')
  const limit = pLimit(config.ffmpeg.maxConcurrent)

  const tasks = fileNames.map((filename) =>
    limit(async () => {
      const fullPath = pathJoin(validatedPath, filename)
      
      // Validate full path
      const fullPathValidation = pathValidator.validatePath(fullPath, validatedPath)
      if (!fullPathValidation.valid) {
        logger.warn('Skipping file with invalid path', { filename, error: fullPathValidation.error })
        return null // Return null instead of throwing to continue processing other files
      }

      try {
        const [duration, thumb] = await Promise.all([
          getVideoDuration(fullPathValidation.sanitized!),
          extractFrameAsDataUrl(fullPathValidation.sanitized!, 180, 320, undefined, 0)
        ])

        return createVideoFile({
          id: randomUUID(),
          filename: pathValidator.sanitizeFilename(filename),
          fullPath: fullPathValidation.sanitized!,
          duration,
          thumbnailDataUrl: thumb,
          thumbnailPath: ''
        })
      } catch (error) {
        logger.error('Error processing file', error instanceof Error ? error : new Error(String(error)), {
          filename,
          error: error instanceof Error ? error.message : String(error)
        })
        // Return null instead of throwing to continue processing other files
        return null
      }
    })
  )

  // Use Promise.allSettled to handle errors gracefully
  const results = await Promise.allSettled(tasks)
  
  // Filter out failed and null results
  const validFiles: VideoFile[] = []
  for (const result of results) {
    if (result.status === 'fulfilled' && result.value !== null) {
      validFiles.push(result.value)
    } else if (result.status === 'rejected') {
      logger.warn('Task rejected', { error: result.reason })
    }
  }

  logger.info(`Successfully processed ${validFiles.length} out of ${fileNames.length} files`)
  return validFiles
}
