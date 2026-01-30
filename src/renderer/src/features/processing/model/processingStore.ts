import { create } from 'zustand'
import { apiClient } from '@api/apiClient'
import { useFilesStore } from '@features/files/model/filesStore'
import type { StrategyType, VideoStrategy } from '@shared/types'
import type {
  FfmpegLogEvent,
  ProcessingTask,
  ProcessingProgressEvent,
  ProcessingCompleteEvent
} from '@shared/ipc/contracts'
import { clampTiming } from '@shared/domain/overlayTiming'

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
    startProcessing: () => Promise<void>
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

function buildTasks(
  files: Array<{
    id: string
    filename: string
    fullPath: string
    duration?: number
    strategies: Record<StrategyType, VideoStrategy>
  }>
): ProcessingTask[] {
  const tasks: ProcessingTask[] = []
  for (const file of files) {
    const strategies = Object.values(file.strategies)
    for (const s of strategies) {
      const timing = clampTiming(file.duration, {
        startTime: s.overlaySettings.timing.startTime,
        duration: s.overlaySettings.timing.duration
      })
      tasks.push({
        inputPath: file.fullPath,
        outputName: getOutputName(file.filename, s.id),
        strategyId: s.id,
        overlayPath: s.overlayPath,
        overlayStart: timing.startTime,
        overlayDuration: timing.duration,
        overlayFadeOutDuration: s.overlaySettings.timing.fadeOutDuration,
        overlayFadeInDuration: s.overlaySettings.timing.fadeInDuration,
        profileSettings: s.profileSettings,
        fileId: file.id,
        filename: file.filename
      })
    }
  }
  return tasks
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

    stop: () => {
      set({ stopRequested: true })
      void apiClient.processingStop()
    },

    startProcessing: async () => {
      const { files, outputDir } = useFilesStore.getState()

      if (!outputDir) {
        set({ error: 'No output folder selected' })
        return
      }
      if (files.length === 0) {
        set({ error: 'No files to process' })
        return
      }

      const tasks = buildTasks(files)
      const total = tasks.length

      const totalPerFile = new Map<string, number>()
      for (const file of files) {
        totalPerFile.set(file.id, Object.values(file.strategies).length)
      }
      const fileProgress = new Map<
        string,
        { total: number; completed: number; hasError: boolean }
      >()
      for (const [fid, t] of totalPerFile) {
        fileProgress.set(fid, { total: t, completed: 0, hasError: false })
      }

      set({
        isRendering: true,
        lastResult: null,
        error: null,
        progress: { completed: 0, total },
        stopRequested: false
      })

      const unsubProgress = apiClient.onProcessingProgress((e: ProcessingProgressEvent) => {
        set({ progress: { completed: e.completed, total: e.total } })
        if (e.fileId) {
          const cur = fileProgress.get(e.fileId)
          if (cur) {
            if (e.status === 'started') {
              get().actions.setFileStatus(e.fileId, 'processing')
            } else if (e.status === 'done' || e.status === 'error') {
              cur.completed += 1
              if (e.status === 'error') cur.hasError = true
              if (cur.completed >= cur.total) {
                get().actions.setFileStatus(
                  e.fileId,
                  cur.hasError ? 'error' : 'done'
                )
              }
            }
          }
        }
      })

      const unsubComplete = apiClient.onProcessingComplete((e: ProcessingCompleteEvent) => {
        set({
          isRendering: false,
          lastResult: !e.stopped,
          stopRequested: false
        })
        unsubProgress()
        unsubComplete()
        unsubLog()
      })

      const unsubLog = apiClient.onFfmpegLog((ev) => get().actions.pushLog(ev))

      try {
        await apiClient.processingStart({ outputDir, tasks })
      } catch (err) {
        set({
          isRendering: false,
          error: String(err),
          lastResult: false,
          stopRequested: false
        })
        unsubProgress()
        unsubComplete()
        unsubLog()
      }
    }
  }
}))
