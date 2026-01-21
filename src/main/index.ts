import { app, shell, BrowserWindow, ipcMain, dialog } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from 'ffmpeg-static';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as crypto from 'crypto';
// 👇 Импортируем общий тип
import { VideoFile } from '@shared/types';

if (ffmpegPath) {
  ffmpeg.setFfmpegPath(ffmpegPath.replace('app.asar', 'app.asar.unpacked'));
}

// --- УТИЛИТЫ ---

/**
 * Умное ожидание файла (Polling).
 * Проверяет наличие файла каждые `interval` мс до истечения `timeout`.
 */
const waitForFile = (filePath: string, timeout = 2000, interval = 100): Promise<void> => {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();

    const check = () => {
      fs.access(filePath, fs.constants.F_OK, (err) => {
        if (!err) {
          // Файл найден! Но дадим еще крошечный буфер на завершение записи байтов
          setTimeout(resolve, 50);
        } else if (Date.now() - startTime > timeout) {
          reject(new Error(`Timeout waiting for file: ${filePath}`));
        } else {
          setTimeout(check, interval); // Пробуем снова
        }
      });
    };
    check();
  });
};

// --- API HANDLERS ---

ipcMain.handle('extract-frame', async (_, filePath: string): Promise<string> => {
  if (!filePath) throw new Error('Путь к файлу не найден');

  const tempDir = os.tmpdir();
  const fileName = `thumb_${crypto.randomUUID()}.jpg`;
  const outputPath = path.join(tempDir, fileName);

  return new Promise((resolve) => {
    ffmpeg(filePath)
      .on('start', () => console.log('📸 Start frame:', fileName))
      .seekInput('1.0')
      .frames(1)
      .output(outputPath)
      .on('end', async () => {
        try {
          // 👇 ИСПОЛЬЗУЕМ POLLING ВМЕСТО SETTIMEOUT
          await waitForFile(outputPath);

          const imgBuffer = fs.readFileSync(outputPath);
          const base64 = `data:image/jpeg;base64,${imgBuffer.toString('base64')}`;
          fs.unlinkSync(outputPath);
          resolve(base64);
        } catch (e) {
          console.error('Ошибка чтения превью:', e);
          resolve(''); // Возвращаем пустоту, чтобы не крашить UI
        }
      })
      .on('error', (err) => {
        console.error('FFmpeg Error:', err);
        resolve('');
      })
      .run();
  });
});

ipcMain.handle('select-folder', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    properties: ['openDirectory'],
    title: 'Выберите папку с видео'
  });
  if (canceled) return null;
  return filePaths[0];
});

// 👇 Типизируем возвращаемое значение
ipcMain.handle('scan-folder', async (_, folderPath: string): Promise<VideoFile[]> => {
  if (!folderPath) return [];

  try {
    const files = fs.readdirSync(folderPath);
    const videoExtensions = ['.mp4', '.mov', '.m4v', '.avi'];

    return files
      .filter(file => {
        const ext = path.extname(file).toLowerCase();
        return videoExtensions.includes(ext) && !file.startsWith('.');
      })
      .map(fileName => ({
        id: crypto.randomUUID(),
        name: fileName,
        path: path.join(folderPath, fileName),
        // thumbnail пока undefined
      }));
  } catch (err) {
    console.error('Scan Error:', err);
    return [];
  }
});

// ... далее код создания окна (createWindow) без изменений ...
function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1200,
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
