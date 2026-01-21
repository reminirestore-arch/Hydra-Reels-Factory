import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'

// --- ДОБАВЛЯЕМ ЭТОТ БЛОК ---
import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from 'ffmpeg-static';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

// Указываем путь к бинарнику
if (ffmpegPath) {
  ffmpeg.setFfmpegPath(ffmpegPath.replace('app.asar', 'app.asar.unpacked'));
}

// Обработчик: Получить кадр из видео
ipcMain.handle('extract-frame', async (_, filePath: string) => {
  // 1. ЗАЩИТА: Проверяем, пришел ли путь
  if (!filePath) {
    console.error('❌ ОШИБКА: В extract-frame пришел пустой путь к файлу!');
    throw new Error('Путь к файлу не найден (filePath is undefined/null)');
  }

  console.log('🎬 Начинаю обработку видео:', filePath);

  return new Promise((resolve, reject) => {
    const tempDir = os.tmpdir();
    const fileName = `thumb_${Date.now()}.jpg`;
    const outputPath = path.join(tempDir, fileName);

    // 2. ЯВНОЕ УКАЗАНИЕ ВХОДА (.input)
    // Это лечит ошибку "reading source", если fluent-ffmpeg запутался
    ffmpeg()
      .input(filePath)
      .screenshots({
        count: 1,
        folder: tempDir,
        filename: fileName,
        timemarks: ['0.5'], // Кадр на 0.5 сек
      })
      .on('end', () => {
        console.log('✅ Скриншот создан:', outputPath);
        try {
          const imgBuffer = fs.readFileSync(outputPath);
          const base64 = `data:image/jpeg;base64,${imgBuffer.toString('base64')}`;
          fs.unlinkSync(outputPath); // Чистим за собой
          resolve(base64);
        } catch (e) {
          console.error('Ошибка чтения скриншота:', e);
          reject(e);
        }
      })
      .on('error', (err) => {
        console.error('❌ Ошибка FFmpeg:', err);
        reject(err);
      });
  });
});
// --- КОНЕЦ БЛОКА ---

function createWindow(): void {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.electron')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // IPC test
  ipcMain.on('ping', () => console.log('pong'))

  createWindow()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
