/// <reference types="vite/client" />

declare global {
  interface Window {
    electron: {
      process: {
        versions: NodeJS.ProcessVersions
      }
    }
  }
}

export {}
