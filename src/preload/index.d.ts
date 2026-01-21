import { ElectronAPI } from '@electron-toolkit/preload'

declare global {
  interface Window {
    electron: ElectronAPI
    api: {
      extractFrame: (filePath: string) => Promise<string>
      getFilePath: (file: File) => string
    }
  }
}
