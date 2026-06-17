import { app, BrowserWindow, ipcMain, shell } from 'electron';
import { join } from 'path';
import { is } from '@electron-toolkit/utils';
import { registerBoardHandlers } from './ipc/boardHandlers';
import { registerCompilerHandlers } from './ipc/compilerHandlers';
import { registerSerialHandlers } from './ipc/serialHandlers';

// ─────────────────────────────────────────────────────────────────────────────
// Security note: contextIsolation + contextBridge is the primary security
// boundary. Full OS sandbox (app.enableSandbox) is intentionally NOT used
// because it prevents the preload script from accessing ipcRenderer.
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────

if (is.dev) {
  process.env['ELECTRON_DISABLE_SECURITY_WARNINGS'] = 'true';
}

let mainWindow: BrowserWindow | null = null;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 680,
    show: false, // hidden until ready-to-show to avoid flash
    frame: true,
    titleBarStyle: 'default',
    backgroundColor: '#0f172a',
    title: 'MY STREAM LAB',
    icon: join(__dirname, '../../resources/icon.png'),
    webPreferences: {
      // ── Security configuration ──────────────────────────────────────────
      preload: join(__dirname, '../preload/preload.mjs'),
      sandbox: false,           // Must be false so preload can use ipcRenderer
      contextIsolation: true,   // window.api exposed only via contextBridge
      nodeIntegration: false,   // No raw Node.js access in renderer
      webSecurity: true,
      allowRunningInsecureContent: false,
    },
  });

  // ── Window events ─────────────────────────────────────────────────────────
  mainWindow.on('ready-to-show', () => {
    mainWindow?.show();
    if (is.dev) {
      mainWindow?.webContents.openDevTools({ mode: 'detach' });
    }
  });



  // Open external links in the OS default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // Content Security Policy — dev mode is permissive for Vite HMR; prod is locked down.
  mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    const devCsp =
      "default-src 'self' localhost:* http://localhost:*;" +
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' localhost:* http://localhost:*;" +
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;" +
      "font-src 'self' https://fonts.gstatic.com data:;" +
      "img-src 'self' data: blob:;" +
      "connect-src 'self' localhost:* http://localhost:* ws://localhost:* wss://localhost:*;"

    const prodCsp =
      "default-src 'self';" +
      "script-src 'self' 'unsafe-inline';" +
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;" +
      "font-src 'self' https://fonts.gstatic.com data:;" +
      "img-src 'self' data: blob:;" +
      "connect-src 'self';"

    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [is.dev ? devCsp : prodCsp]
      }
    })
  });

  // ── Load the renderer ─────────────────────────────────────────────────────
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL']);
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// App lifecycle
// ─────────────────────────────────────────────────────────────────────────────
import { setupApplicationMenu } from './menu';
import { registerProjectHandlers } from './ipc/projectHandlers';

app.whenReady().then(() => {
  setupApplicationMenu();
  // Register IPC handlers **before** the window opens
  registerProjectHandlers();
  registerBoardHandlers(ipcMain);
  registerCompilerHandlers();
  registerSerialHandlers();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
