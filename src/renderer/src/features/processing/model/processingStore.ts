import { create } from 'zustand'
import { apiClient } from '@api/apiClient'
import { useFilesStore } from '@features/files/model/filesStore'
import type { StrategyType } from '@shared/types'
import type { FfmpegLogEvent } from '@shared/ipc/contracts'
import { getRendererConfig } from '@shared/config/renderer'
import { retry } from '@shared/utils/retry'

const config = getRendererConfig()

// Dynamic import for p-limit (ESM only)
// p-limit v7 is ESM-only, use dynamic import
const getPLimit = async (): Promise<typeof import('p-limit').default> => {
  const { default: pLimit } = await import('p-limit')
  return pLimit
}

type Progress = { completed: number; total: number }

export type FileProcessingStatus = 'idle' | 'processing' | 'done' | 'error'

type ProcessingState = {
  isRendering: boolean
  lastResult: boolean | null
  error: string | null
  progress: Progress
  stopRequested: boolean

  statusByFileId: Record<string, FileProcessingStatus>

  logs: FfmpegLogEvent[]
  maxLogs: number

  actions: {
    renderAll: () => Promise<void>
    stop: () => void
    reset: () => void
    setFileStatus: (fileId: string, status: FileProcessingStatus) => void
    clearStatuses: () => void
    clearLogs: () => void
    pushLog: (e: FfmpegLogEvent) => void
  }
}

const getOutputName = (filename: string, strategy: StrategyType): string => {
  const base = filename.replace(/\.[^/.]+$/, '')
  return `${base}_${strategy}.mp4`
}

export const useProcessingStore = create<ProcessingState>((set, get) => ({
  isRendering: false,
  lastResult: null,
  error: null,
  progress: { completed: 0, total: 0 },
  stopRequested: false,

  statusByFileId: {},

  logs: [],
  maxLogs: 600, // Default, can be configured via IPC if needed

  actions: {
    reset: () =>
      set({
        isRendering: false,
        lastResult: null,
        error: null,
        progress: { completed: 0, total: 0 },
        stopRequested: false,
        statusByFileId: {},
        logs: []
      }),

    clearStatuses: () => set({ statusByFileId: {} }),
    clearLogs: () => set({ logs: [] }),

    pushLog: (e) =>
      set((s) => {
        const next = [...s.logs, e]
        const overflow = next.length - s.maxLogs
        return { logs: overflow > 0 ? next.slice(overflow) : next }
      }),

    setFileStatus: (fileId, status) =>
      set((s) => ({
        statusByFileId: { ...s.statusByFileId, [fileId]: status }
      })),

    stop: () => set({ stopRequested: true }),

    renderAll: async () => {
      const { files, outputDir } = useFilesStore.getState()

      if (!outputDir) {
        set({ error: 'No output folder selected' })
        return
      }
      if (files.length === 0) {
        set({ error: 'No files to process' })
        return
      }

      const total = files.reduce((acc, file) => acc + Object.values(file.strategies).length, 0)

      set({
        isRendering: true,
        lastResult: null,
        error: null,
        progress: { completed: 0, total },
        stopRequested: false
      })

      // subscribe to ffmpeg logs
      const unsubscribe = apiClient.onFfmpegLog((e) => get().actions.pushLog(e))

      let completed = 0

      try {
        // Initialize p-limit for parallel processing
        const pLimit = await getPLimit()
        const limit = pLimit(config.ffmpeg.maxConcurrent)

        // Track completed strategies per file
        const fileProgress = new Map<string, number>()

        // Create all render tasks
        const tasks: Array<() => Promise<void>> = []

        for (const file of files) {
          const strategies = Object.values(file.strategies)
          fileProgress.set(file.id, 0)

          for (const strategy of strategies) {
            tasks.push(async () => {
              if (get().stopRequested) return

              // Set file status to processing when starting first strategy
              const currentStatus = get().statusByFileId[file.id]
              if (currentStatus !== 'processing' && currentStatus !== 'done') {
                get().actions.setFileStatus(file.id, 'processing')
              }

              try {
                const ok = await retry(
                  () =>
                    apiClient.renderStrategy({
                      inputPath: file.fullPath,
                      outputDir,
                      outputName: getOutputName(file.filename, strategy.id),
                      overlayPath: strategy.overlayPath,
                      overlayStart: strategy.overlaySettings.timing.startTime,
                      overlayDuration: strategy.overlaySettings.timing.duration,
                      overlayFadeOutDuration: strategy.overlaySettings.timing.fadeOutDuration,
                      strategyId: strategy.id,
                      profileSettings: strategy.profileSettings,
                      fileId: file.id,
                      filename: file.filename
                    }),
                  {
                    maxAttempts: config.processing.retryAttempts
                  }
                )

                if (!ok) throw new Error('Render failed')

                completed += 1
                set({ progress: { completed, total } })

                // Update file progress
                const currentFileProgress = (fileProgress.get(file.id) ?? 0) + 1
                fileProgress.set(file.id, currentFileProgress)

                // Check if all strategies for this file are done
                const strategiesCount = strategies.length
                if (currentFileProgress >= strategiesCount) {
                  get().actions.setFileStatus(file.id, get().stopRequested ? 'idle' : 'done')
                }
              } catch (e) {
                console.error('Render strategy failed:', file.filename, strategy.id, e)
                get().actions.setFileStatus(file.id, 'error')
                // Still increment progress to avoid blocking
                completed += 1
                set({ progress: { completed, total } })
              }
            })
          }
        }

        // Execute all tasks in parallel (limited by maxConcurrent)
        await Promise.all(tasks.map((task) => limit(task)))

        set({ isRendering: false, lastResult: !get().stopRequested })
      } catch (e) {
        set({ isRendering: false, error: String(e), lastResult: false })
      } finally {
        unsubscribe()
      }
    }
  }
}))
