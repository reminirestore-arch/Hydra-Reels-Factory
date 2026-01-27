// src/shared/config/renderer.ts
// Renderer-specific config that uses window.env or defaults
import { z } from 'zod'

// Extend Window interface for environment variables
interface WindowWithEnv extends Window {
  __ENV__?: Record<string, string | undefined>
}

const ConfigSchema = z.object({
  canvas: z.object({
    width: z.number().int().positive().default(450),
    height: z.number().int().positive().default(800)
  }),
  ffmpeg: z.object({
    maxConcurrent: z.number().int().positive().default(4),
    timeout: z.number().int().positive().default(300000)
  }),
  processing: z.object({
    maxLogs: z.number().int().positive().default(600),
    retryAttempts: z.number().int().min(0).max(5).default(3)
  }),
  features: z.object({
    enableAdvancedFilters: z.boolean().default(false),
    enableBatchProcessing: z.boolean().default(true),
    enablePreviewCache: z.boolean().default(true)
  })
})

type RendererConfig = z.infer<typeof ConfigSchema>

// Helper to get env values in renderer (if injected via window)
function getEnvNumber(key: string, defaultValue: number): number {
  if (typeof window !== 'undefined') {
    const windowWithEnv = window as WindowWithEnv
    if (windowWithEnv.__ENV__) {
      const value = windowWithEnv.__ENV__[key]
      if (value) {
        const parsed = Number(value)
        if (!Number.isNaN(parsed)) return parsed
      }
    }
  }
  return defaultValue
}

function getEnvBoolean(key: string, defaultValue: boolean): boolean {
  if (typeof window !== 'undefined') {
    const windowWithEnv = window as WindowWithEnv
    if (windowWithEnv.__ENV__) {
      const value = windowWithEnv.__ENV__[key]
      if (value !== undefined) return value === 'true' || value === '1'
    }
  }
  return defaultValue
}

// In renderer, we can't access process.env directly
// Use defaults or inject via window if needed
export const rendererConfig: RendererConfig = ConfigSchema.parse({
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
  }
})

export function getRendererConfig(): RendererConfig {
  return rendererConfig
}
