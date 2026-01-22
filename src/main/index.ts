import { app, shell, BrowserWindow, ipcMain, dialog } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import * as fs from 'fs'
import * as path from 'path'
import * as crypto from 'crypto'
import pLimit from 'p-limit'
import {
  extractFrameAsDataUrl,
  generateThumbnail,
  getVideoDuration,
  renderStrategyVideo,
  saveOverlayFromDataUrl
} from './ffmpeg'
import { StrategyType, VideoFile } from '../shared/types'

const createEmptyStrategies = (): VideoFile['strategies'] => ({
  IG1: { id: 'IG1', isReady: false },
  IG2: { id: 'IG2', isReady: false },
  IG3: { id: 'IG3', isReady: false },
  IG4: { id: 'IG4', isReady: false }
})

ipcMain.handle('extract-frame', async (_, filePath: string): Promise<string> => {
  if (!filePath) throw new Error('Путь к файлу не найден')
  return extractFrameAsDataUrl(filePath)
})

ipcMain.handle('select-folder', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    properties: ['openDirectory'],
    title: 'Выберите папку с видео'
  })
  if (canceled) return null
  return filePaths[0]
})

ipcMain.handle('select-output-folder', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    properties: ['openDirectory'],
    title: 'Выберите папку для результата'
  })
  if (canceled) return null
  return filePaths[0]
})

ipcMain.handle('scan-folder', async (_, folderPath: string): Promise<VideoFile[]> => {
  if (!folderPath) return []

  try {
    const entries = await fs.promises.readdir(folderPath)
    const videoExtensions = ['.mp4', '.mov', '.m4v', '.avi']

    const files = entries.filter((file) => {
      const ext = path.extname(file).toLowerCase()
      return videoExtensions.includes(ext) && !file.startsWith('.')
    })

    const limit = pLimit(2)
    const results = await Promise.all(
      files.map((fileName) =>
        limit(async () => {
          const fullPath = path.join(folderPath, fileName)
          const [thumbnail, duration] = await Promise.all([
            generateThumbnail(fullPath),
            getVideoDuration(fullPath)
          ])

          return {
            id: crypto.randomUUID(),
            filename: fileName,
            fullPath,
            thumbnailPath: thumbnail?.path ?? '',
            thumbnailDataUrl: thumbnail?.dataUrl ?? '',
            duration,
            overlayDuration: 5,
            strategies: createEmptyStrategies()
          }
        })
      )
    )

    return results
  } catch (err) {
    console.error('Scan Error:', err)
    return []
  }
})

ipcMain.handle('save-overlay', async (_, dataUrl: string): Promise<string> => {
  if (!dataUrl) return ''
  try {
    return await saveOverlayFromDataUrl(dataUrl)
  } catch (err) {
    console.error('Save overlay error:', err)
    return ''
  }
})

ipcMain.handle(
  'render-strategy',
  async (
    _,
    payload: {
      inputPath: string
      outputDir: string
      outputName: string
      overlayPath?: string
      overlayDuration?: number
      strategyId: StrategyType
    }
  ): Promise<boolean> => {
    try {
      await renderStrategyVideo({
        inputPath: payload.inputPath,
        outputPath: path.join(payload.outputDir, payload.outputName),
        overlayPath: payload.overlayPath,
        overlayDuration: payload.overlayDuration,
        strategyId: payload.strategyId
      })
      return true
    } catch (err) {
      console.error('Render error:', err)
      return false
    }
  }
)

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
      sandbox: false,
      contextIsolation: true
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.electron')
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  createWindow()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
