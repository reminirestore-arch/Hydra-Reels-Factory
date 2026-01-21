import { ElectronAPI } from '@electron-toolkit/preload'

// Интерфейс файла, который возвращает бэкенд
interface VideoFile {
  name: string;
  path: string;
  id: string;
}

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
