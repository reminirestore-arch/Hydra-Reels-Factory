import { ElectronAPI } from '@electron-toolkit/preload'
import { StrategyType, VideoFile } from '@shared/types'

declare global {
  interface Window {
    electron: ElectronAPI
    api: {
      selectFolder: () => Promise<string | null>
      selectOutputFolder: () => Promise<string | null>
      scanFolder: (path: string) => Promise<VideoFile[]>
      extractFrame: (filePath: string, strategyId: StrategyType) => Promise<string>
      saveOverlay: (dataUrl: string) => Promise<string>
      renderStrategy: (payload: {
        inputPath: string
        outputDir: string
        outputName: string
        overlayPath?: string
        overlayStart?: number
        overlayDuration?: number
        strategyId: StrategyType
      }) => Promise<boolean>
      getFilePath: (file: File) => string
    }
  }
}
