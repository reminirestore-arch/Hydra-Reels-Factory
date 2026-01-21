import { ElectronAPI } from '@electron-toolkit/preload'
// 👇 Импорт типа (обрати внимание на путь, он относителен этого файла)
import { VideoFile } from '../shared/types'

declare global {
  interface Window {
    electron: ElectronAPI
    api: {
      getFilePath: (file: File) => string
      extractFrame: (filePath: string) => Promise<string>
      selectFolder: () => Promise<string | null>
      scanFolder: (folderPath: string) => Promise<VideoFile[]>
    }
  }
}
