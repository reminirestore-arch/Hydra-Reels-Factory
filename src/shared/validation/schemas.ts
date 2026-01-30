import { z } from 'zod'

// Strategy schemas
export const StrategyTypeSchema = z.enum(['IG1', 'IG2', 'IG3', 'IG4'])
export const StrategyStatusSchema = z.enum(['default', 'custom'])

export const OverlayTimingSchema = z.object({
  startTime: z.number().min(0),
  duration: z.number().min(1).max(300), // D_MIN = 1 sec
  fadeOutDuration: z.number().min(0).max(5000).optional(), // в миллисекундах
  fadeInDuration: z.number().min(0).max(5000).optional() // в миллисекундах
})

export const TextStyleSettingsSchema = z.object({
  fontSize: z.number().int().min(8).max(200),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid hex color'),
  align: z.enum(['left', 'center', 'right']),
  verticalAlign: z.enum(['top', 'center', 'bottom']).default('center'),
  contentAlign: z.enum(['left', 'center', 'right']).default('center'),
  fontWeight: z.union([z.string(), z.number()]).optional()
})

export const BackgroundStyleSettingsSchema = z.object({
  width: z.number().min(20).max(2000),
  height: z.number().min(20).max(2000),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid hex color'),
  opacity: z.number().min(0).max(1),
  radius: z.number().min(0).max(1000),
  position: z.literal('center')
})

export const OverlaySettingsSchema = z.object({
  timing: OverlayTimingSchema,
  text: TextStyleSettingsSchema,
  background: BackgroundStyleSettingsSchema
})

export const StrategyProfileSettingsSchema = z.object({
  // IG1
  focusStrength: z.number().min(0).max(1),
  vignetteIntensity: z.number().min(0).max(1),
  // IG2
  motionSpeed: z.number().min(0.1).max(3),
  saturation: z.number().min(0.1).max(3),
  // IG3
  contrast: z.number().min(0.1).max(3),
  sharpness: z.number().min(0).max(2),
  // IG4
  grain: z.number().min(0).max(1),
  rotationAngle: z.number().min(-2).max(2),
  // Fade (IG3, IG4)
  fadeInDuration: z.number().min(0.1).max(1.0),
  fadeOutDuration: z.number().min(0.1).max(1.0)
})

export const VideoStrategySchema = z.object({
  id: StrategyTypeSchema,
  status: StrategyStatusSchema,
  overlayPath: z.string().optional(),
  canvasState: z.record(z.string(), z.unknown()).optional(),
  textData: z.string().max(1000).optional(),
  overlaySettings: OverlaySettingsSchema,
  profileSettings: StrategyProfileSettingsSchema
})

// Video file schema
export const VideoFileSchema = z.object({
  id: z.string().uuid(),
  filename: z.string().min(1).max(500),
  fullPath: z.string().min(1),
  thumbnailPath: z.string(),
  thumbnailDataUrl: z.string().startsWith('data:image/'),
  duration: z.number().min(0),
  strategies: z.record(StrategyTypeSchema, VideoStrategySchema),
  processingStatus: z.enum(['idle', 'processing', 'done', 'error'])
})

// IPC contract schemas
export const ExtractFrameArgsSchema = z.object({
  path: z.string().min(1),
  strategyId: StrategyTypeSchema.optional(),
  atSeconds: z.number().min(0).optional(),
  profileSettings: StrategyProfileSettingsSchema.optional()
})

export const SaveOverlayArgsSchema = z.object({
  dataUrl: z.string().startsWith('data:image/')
})

export const RenderStrategyPayloadSchema = z.object({
  inputPath: z.string().min(1),
  outputDir: z.string().min(1),
  outputName: z.string().min(1).max(500),
  strategyId: StrategyTypeSchema,
  overlayPath: z.string().optional(),
  overlayStart: z.number().min(0).optional(),
  overlayDuration: z.number().min(1).optional(), // D_MIN = 1 sec
  overlayFadeOutDuration: z.number().min(0).max(5000).optional(), // в миллисекундах
  overlayFadeInDuration: z.number().min(0).max(5000).optional(), // в миллисекундах
  profileSettings: StrategyProfileSettingsSchema.optional(),
  fileId: z.string().uuid().optional(),
  filename: z.string().max(500).optional()
})

export const ScanFolderArgsSchema = z.object({
  path: z.string().min(1)
})

export const ProcessingTaskSchema = z.object({
  inputPath: z.string().min(1),
  outputName: z.string().min(1).max(500),
  strategyId: StrategyTypeSchema,
  overlayPath: z.string().optional(),
  overlayStart: z.number().min(0).optional(),
  overlayDuration: z.number().min(1).optional(), // D_MIN = 1 sec
  overlayFadeOutDuration: z.number().min(0).max(5000).optional(),
  overlayFadeInDuration: z.number().min(0).max(5000).optional(),
  profileSettings: StrategyProfileSettingsSchema.optional(),
  fileId: z.string().uuid().optional(),
  filename: z.string().max(500).optional()
})

export const ProcessingStartPayloadSchema = z.object({
  outputDir: z.string().min(1),
  tasks: z.array(ProcessingTaskSchema).min(1)
})

// Validation helpers
export function validateAndParse<T>(schema: z.ZodSchema<T>, data: unknown): T {
  return schema.parse(data)
}

export function safeParse<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; error: z.ZodError } {
  const result = schema.safeParse(data)
  if (result.success) {
    return { success: true, data: result.data }
  }
  return { success: false, error: result.error }
}
