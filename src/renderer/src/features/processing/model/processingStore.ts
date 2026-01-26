import { create } from 'zustand'
import { apiClient } from '@api/apiClient'
import { useFilesStore } from '@features/files/model/filesStore'
import type { StrategyType } from '@shared/types'
import type { FfmpegLogEvent } from '@shared/ipc/contracts'

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
  maxLogs: 600,

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
        for (const file of files) {
          if (get().stopRequested) break

          get().actions.setFileStatus(file.id, 'processing')

          const strategies = Object.values(file.strategies)

          try {
            for (const strategy of strategies) {
              if (get().stopRequested) break

              const ok = await apiClient.renderStrategy({
                inputPath: file.fullPath,
                outputDir,
                outputName: getOutputName(file.filename, strategy.id),
                overlayPath: strategy.overlayPath,
                overlayStart: strategy.overlaySettings.timing.startTime,
                overlayDuration: strategy.overlaySettings.timing.duration,
                strategyId: strategy.id,
                fileId: file.id,
                filename: file.filename
              })

              if (!ok) throw new Error('Render failed')

              completed += 1
              set({ progress: { completed, total } })
            }

            get().actions.setFileStatus(file.id, get().stopRequested ? 'idle' : 'done')
          } catch (e) {
            console.error('Render file failed:', file.filename, e)
            get().actions.setFileStatus(file.id, 'error')
          }
        }

        set({ isRendering: false, lastResult: !get().stopRequested })
      } catch (e) {
        set({ isRendering: false, error: String(e), lastResult: false })
      } finally {
        unsubscribe()
      }
    }
  }
}))
