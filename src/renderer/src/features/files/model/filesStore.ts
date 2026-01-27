import { create } from 'zustand'
import type { VideoFile } from '@shared/types'
import { apiClient } from '@api/apiClient'
import { VideoFileSchema, safeParse } from '@shared/validation/schemas'
import { createLogger } from '@shared/logger'

const logger = createLogger('FilesStore')

type FilesState = {
  inputDir: string | null
  outputDir: string | null

  files: VideoFile[]
  selectedFile: VideoFile | null

  isLoading: boolean
  error: string | null

  actions: {
    pickInputDir: () => Promise<void>
    pickOutputDir: () => Promise<void>
    scan: () => Promise<void>
    selectFile: (file: VideoFile | null) => void
    setInputDir: (path: string | null) => void
    setOutputDir: (path: string | null) => void
    updateFile: (file: VideoFile) => void
  }
}

export const useFilesStore = create<FilesState>((set, get) => ({
  inputDir: null,
  outputDir: null,
  files: [],
  selectedFile: null,
  isLoading: false,
  error: null,

  actions: {
    setInputDir: (p) => set({ inputDir: p }),
    setOutputDir: (p) => set({ outputDir: p }),
    selectFile: (file) => set({ selectedFile: file }),

    pickInputDir: async () => {
      const picked = await apiClient.selectFolder()
      if (!picked) return
      set({ inputDir: picked })
      await get().actions.scan()
    },

    pickOutputDir: async () => {
      const picked = await apiClient.selectOutputFolder()
      if (!picked) return
      set({ outputDir: picked })
    },

    scan: async () => {
      const { inputDir } = get()
      if (!inputDir) return

      set({ isLoading: true, error: null })
      try {
        const files = await apiClient.scanFolder(inputDir)

        // Validate files with Zod
        const validatedFiles: VideoFile[] = []
        for (const file of files) {
          const validation = safeParse(VideoFileSchema, file)
          if (validation.success) {
            validatedFiles.push(validation.data)
          } else {
            logger.warn('Invalid video file skipped', {
              errors: validation.error.issues,
              fileId: file.id
            })
          }
        }

        const prevSelectedId = get().selectedFile?.id ?? null
        const nextSelected =
          validatedFiles.find((f) => f.id === prevSelectedId) ?? validatedFiles[0] ?? null

        logger.info('Files scanned', {
          count: validatedFiles.length,
          skipped: files.length - validatedFiles.length
        })
        set({ files: validatedFiles, selectedFile: nextSelected, isLoading: false })
      } catch (e) {
        const error = e instanceof Error ? e : new Error(String(e))
        logger.error('Scan failed', error)
        set({ isLoading: false, error: error.message })
      }
    },

    updateFile: (file) =>
      set((s) => ({
        files: s.files.map((f) => (f.id === file.id ? file : f)),
        selectedFile: s.selectedFile?.id === file.id ? file : s.selectedFile
      }))
  }
}))
