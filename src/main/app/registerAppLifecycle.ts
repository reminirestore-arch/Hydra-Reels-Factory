import { app, BrowserWindow, ipcMain } from 'electron'
import { electronApp } from '@electron-toolkit/utils'
import { createWindow } from './createWindow'
import { registerIpcHandlers } from '@ipc'
import { cleanupTempFiles } from '@services/ffmpeg'

export function registerAppLifecycle(): void {
  electronApp.setAppUserModelId('com.electron')

  app.whenReady().then(() => {
    registerIpcHandlers(ipcMain)
    createWindow()

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  })

  app.on('before-quit', () => {
    void cleanupTempFiles()
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })
}
