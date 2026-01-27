// src/shared/config/index.ts
import { z } from 'zod'

const ConfigSchema = z.object({
  // Canvas settings
  canvas: z.object({
    width: z.number().int().positive().default(450),
    height: z.number().int().positive().default(800)
  }),

  // FFmpeg settings
  ffmpeg: z.object({
    maxConcurrent: z.number().int().positive().default(4),
    timeout: z.number().int().positive().default(300000) // 5 minutes
  }),

  // Processing settings
  processing: z.object({
    maxLogs: z.number().int().positive().default(600),
    retryAttempts: z.number().int().min(0).max(5).default(3)
  }),

  // Feature flags
  features: z.object({
    enableAdvancedFilters: z.boolean().default(false),
    enableBatchProcessing: z.boolean().default(true),
    enablePreviewCache: z.boolean().default(true)
  }),

  // Path validation
  paths: z.object({
    maxPathLength: z.number().int().positive().default(4096),
    allowedExtensions: z.array(z.string()).default(['.mp4', '.mov', '.m4v', '.webm', '.mkv'])
  })
})

type Config = z.infer<typeof ConfigSchema>

function getEnvNumber(key: string, defaultValue: number): number {
  const value = process.env[key]
  if (!value) return defaultValue
  const parsed = Number(value)
  return Number.isNaN(parsed) ? defaultValue : parsed
}

function getEnvBoolean(key: string, defaultValue: boolean): boolean {
  const value = process.env[key]
  if (!value) return defaultValue
  return value === 'true' || value === '1'
}

function getEnvArray(key: string, defaultValue: string[]): string[] {
  const value = process.env[key]
  if (!value) return defaultValue
  return value.split(',').map((s) => s.trim())
}

export const config: Config = ConfigSchema.parse({
  canvas: {
    width: getEnvNumber('CANVAS_WIDTH', 450),
    height: getEnvNumber('CANVAS_HEIGHT', 800)
  },
  ffmpeg: {
    maxConcurrent: getEnvNumber('FFMPEG_MAX_CONCURRENT', 4),
    timeout: getEnvNumber('FFMPEG_TIMEOUT', 300000)
  },
  processing: {
    maxLogs: getEnvNumber('PROCESSING_MAX_LOGS', 600),
    retryAttempts: getEnvNumber('PROCESSING_RETRY_ATTEMPTS', 3)
  },
  features: {
    enableAdvancedFilters: getEnvBoolean('FEATURE_ADVANCED_FILTERS', false),
    enableBatchProcessing: getEnvBoolean('FEATURE_BATCH_PROCESSING', true),
    enablePreviewCache: getEnvBoolean('FEATURE_PREVIEW_CACHE', true)
  },
  paths: {
    maxPathLength: getEnvNumber('MAX_PATH_LENGTH', 4096),
    allowedExtensions: getEnvArray('ALLOWED_EXTENSIONS', ['.mp4', '.mov', '.m4v', '.webm', '.mkv'])
  }
})

// Type-safe config access
export const getConfig = (): Config => config
