// Timeline logic constants and helpers for overlay start/duration (spec: Timeline Logic)

/** Minimum overlay duration in seconds (hard limit). */
export const D_MIN = 1

/** Minimum video duration in seconds to allow adding overlay (N/2 must have headroom above D_MIN). */
export const T_MIN_VIDEO = 3

export interface OverlayTimingSlice {
  startTime: number
  duration: number
}

/**
 * Whether adding a new overlay block is allowed (video long enough).
 */
export function canAddOverlay(videoDuration: number | undefined): boolean {
  return typeof videoDuration === 'number' && videoDuration >= T_MIN_VIDEO
}

/**
 * Default timing when adding a new overlay: start 0, duration = half of video (or fallback 5s).
 */
export function defaultOverlayTiming(
  videoDuration: number | undefined
): OverlayTimingSlice {
  if (typeof videoDuration !== 'number' || videoDuration <= 0) {
    return { startTime: 0, duration: Math.max(D_MIN, 5) }
  }
  const duration = Math.max(D_MIN, videoDuration / 2)
  return { startTime: 0, duration }
}

/**
 * Clamp timing to valid range: D_MIN <= duration, start + duration <= videoDuration,
 * start <= videoDuration - D_MIN (compression rule applied).
 */
export function clampTiming(
  videoDuration: number | undefined,
  timing: OverlayTimingSlice
): OverlayTimingSlice {
  let { startTime, duration } = timing
  if (typeof videoDuration !== 'number' || videoDuration <= 0) {
    return {
      startTime: Math.max(0, startTime),
      duration: Math.max(D_MIN, duration)
    }
  }
  const maxStart = Math.max(0, videoDuration - D_MIN)
  startTime = Math.max(0, Math.min(startTime, maxStart))
  const available = videoDuration - startTime
  duration = Math.max(D_MIN, Math.min(duration, available))
  return { startTime, duration }
}

/**
 * Max value for "Start" slider so remainder is at least D_MIN.
 */
export function startTimeMax(videoDuration: number | undefined): number {
  if (typeof videoDuration !== 'number' || videoDuration <= 0) return 15
  return Math.max(0, videoDuration - D_MIN)
}

/**
 * Max value for "Duration" slider given current start.
 */
export function durationMax(
  videoDuration: number | undefined,
  startTime: number
): number {
  if (typeof videoDuration !== 'number' || videoDuration <= 0) return 15
  return Math.max(D_MIN, videoDuration - startTime)
}
