import { app, shell, BrowserWindow, ipcMain, dialog } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from 'ffmpeg-static';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as crypto from 'crypto'; // Для генерации ID файлов

// Указываем путь к бинарнику FFmpeg
if (ffmpegPath) {
  ffmpeg.setFfmpegPath(ffmpegPath.replace('app.asar', 'app.asar.unpacked'));
}

// --- API HANDLERS ---

// 1. Получить кадр из видео (Preview)
ipcMain.handle('extract-frame', async (_, filePath: string) => {
  if (!filePath) throw new Error('Путь к файлу не найден');

  return new Promise((resolve, reject) => {
    const tempDir = os.tmpdir();
    const fileName = `thumb_${Date.now()}.jpg`;
    const outputPath = path.join(tempDir, fileName);

    ffmpeg()
      .input(filePath)
      .screenshots({
        count: 1,
        folder: tempDir,
        filename: fileName,
        timemarks: ['0.5'],
      })
      .on('end', () => {
        try {
          const imgBuffer = fs.readFileSync(outputPath);
          const base64 = `data:image/jpeg;base64,${imgBuffer.toString('base64')}`;
          fs.unlinkSync(outputPath);
          resolve(base64);
        } catch (e) {
          reject(e);
        }
      })
      .on('error', (err) => reject(err));
  });
});

// 2. Выбор папки (System Dialog)
ipcMain.handle('select-folder', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    properties: ['openDirectory'],
    title: 'Выберите папку с видео'
  });
  if (canceled) return null;
  return filePaths[0];
});

// 3. Сканирование папки на видеофайлы
ipcMain.handle('scan-folder', async (_, folderPath: string) => {
  if (!folderPath) return [];

  try {
    const files = fs.readdirSync(folderPath);
    const videoExtensions = ['.mp4', '.mov', '.m4v', '.avi'];

    const videoFiles = files.filter(file => {
      const ext = path.extname(file).toLowerCase();
      return videoExtensions.includes(ext) && !file.startsWith('.');
    });

    // Возвращаем список файлов для фронтенда
    return videoFiles.map(fileName => ({
      name: fileName,
      path: path.join(folderPath, fileName),
      id: crypto.randomUUID()
    }));
  } catch (err) {
    console.error('Ошибка сканирования:', err);
    return [];
  }
});

// --- WINDOW MANAGEMENT ---

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1200, // Чуть шире для дашборда
    height: 800,
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
