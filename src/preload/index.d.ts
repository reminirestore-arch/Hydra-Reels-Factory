import { ElectronAPI } from '@electron-toolkit/preload'
import { VideoFile } from '@shared/types'

declare global {
  interface Window {
    electron: ElectronAPI
    api: {
      selectFolder: () => Promise<string | null>
      scanFolder: (path: string) => Promise<VideoFile[]>
      extractFrame: (filePath: string) => Promise<string>
    }
  }
}
