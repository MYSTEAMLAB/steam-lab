import { app, BrowserWindow, ipcMain, shell, protocol, net } from 'electron';
import { join } from 'path';
import { pathToFileURL } from 'url';
import { is } from '@electron-toolkit/utils';
import { registerBoardHandlers } from './ipc/boardHandlers';
import { registerCompilerHandlers } from './ipc/compilerHandlers';
import { registerSerialHandlers, closeSerialPort } from './ipc/serialHandlers';
import { registerBluetoothHandlers } from './ipc/bluetoothHandlers';
import { registerLocalCompileServerHandlers, stopLocalCompileServer } from './localCompileServer';

// ─────────────────────────────────────────────────────────────────────────────
// Security note: contextIsolation + contextBridge is the primary security
// boundary. Full OS sandbox (app.enableSandbox) is intentionally NOT used
// because it prevents the preload script from accessing ipcRenderer.
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────

if (is.dev) {
  process.env['ELECTRON_DISABLE_SECURITY_WARNINGS'] = 'true';
}

// ─────────────────────────────────────────────────────────────────────────────
// Production renderer served over a custom "app://" scheme instead of raw
// file://. The offline AI features (MobileNet via tfjs, MediaPipe's
// FilesetResolver, face-api.js) all load their bundled models with fetch(),
// and Chromium's Fetch API rejects file:// URLs outright ("Failed to
// fetch") — that failure only shows up in the packaged app, since dev mode
// loads from the Vite dev server (http://) where fetch works fine. Must be
// registered before app is ready.
// ─────────────────────────────────────────────────────────────────────────────
const APP_SCHEME = 'app';
protocol.registerSchemesAsPrivileged([
  {
    scheme: APP_SCHEME,
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true
    }
  }
]);

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
    title: 'MY STEAM LAB',
    icon: join(__dirname, '../../resources/icon.png'),
    webPreferences: {
      // ── Security configuration ──────────────────────────────────────────
      preload: join(__dirname, '../preload/preload.cjs'),
      sandbox: false,           // Must be false so preload can use ipcRenderer
      contextIsolation: true,   // window.api exposed only via contextBridge
      nodeIntegration: false,   // No raw Node.js access in renderer
      webSecurity: true,
      allowRunningInsecureContent: false,
    },
  });

  // ── Media permissions (camera/mic for the AI Vision panel) ──────────────────
  // Electron shows no browser-style permission popup by default — unhandled
  // requests are silently denied. Auto-grant, but only 'media' and only for
  // this app's own window (never a blanket allow-all).
  const ses = mainWindow.webContents.session;
  ses.setPermissionRequestHandler((webContents, permission, callback) => {
    callback(webContents.id === mainWindow?.webContents.id && permission === 'media');
  });
  ses.setPermissionCheckHandler((webContents, permission) => {
    return webContents?.id === mainWindow?.webContents.id && permission === 'media';
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
      // 'unsafe-eval' — required by two of the bundled offline AI libraries:
      // MediaPipe (gesture/object detection) needs it for WebAssembly
      // compilation on its non-SIMD wasm fallback path (streaming compile
      // sometimes slips through without it, but the fallback path always
      // needs it), and OpenCV.js (shape detection) calls `new Function(...)`
      // at startup to name its exception classes (an Emscripten runtime
      // pattern) — that specifically needs 'unsafe-eval', not just the
      // narrower 'wasm-unsafe-eval'. Both scripts are our own bundled,
      // offline assets (never remote/user-supplied), and connect-src stays
      // locked to 'self' so this doesn't open up remote code execution.
      "script-src 'self' 'unsafe-inline' 'unsafe-eval';" +
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;" +
      "font-src 'self' https://fonts.gstatic.com data:;" +
      "img-src 'self' data: blob:;" +
      // 'data:' — OpenCV.js embeds its actual WASM binary as an inline
      // base64 data: URI and loads it via fetch(), which connect-src
      // governs (not img-src). Still fully offline; no remote origins added.
      "connect-src 'self' data:;"

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
    mainWindow.loadURL(`${APP_SCHEME}://renderer/index.html`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// App lifecycle
// ─────────────────────────────────────────────────────────────────────────────
import { setupApplicationMenu } from './menu';
import { registerProjectHandlers } from './ipc/projectHandlers';
import { setupAutoUpdater } from './updater';

app.whenReady().then(() => {
  // Serve the built renderer (out/renderer) over app://renderer/... so the
  // page loads with a real "standard" origin instead of file: — required
  // for fetch() (tfjs/MediaPipe/face-api model loading) to work offline.
  const rendererDir = join(__dirname, '../renderer');
  protocol.handle(APP_SCHEME, (request) => {
    const { pathname } = new URL(request.url);
    const filePath = join(rendererDir, decodeURIComponent(pathname));
    return net.fetch(pathToFileURL(filePath).toString());
  });

  setupApplicationMenu();
  // Register IPC handlers **before** the window opens
  registerProjectHandlers();
  registerBoardHandlers(ipcMain);
  registerCompilerHandlers();
  registerSerialHandlers();
  registerBluetoothHandlers();
  registerLocalCompileServerHandlers();

  // Lets the "No paired device" empty state jump straight to Windows'
  // Bluetooth settings instead of just telling the student to go find it
  // themselves — pairing still has to happen at the OS level (Electron/Node
  // has no API for it), this just removes the "where is that setting" step.
  ipcMain.handle('system:openBluetoothSettings', () => shell.openExternal('ms-settings:bluetooth'));

  createWindow();
  setupAutoUpdater();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// Two things can hold a native/socket handle open in the background after
// every window is closed — an open serial port (left connected in the
// Serial Monitor) and the local mobile-compile HTTP server (Tools > Mobile
// Compile Server) — either one keeps the underlying Node process alive even
// though Electron considers itself "quit". That's exactly what makes an
// installer/updater's "please close the app first" check keep failing even
// after the user closes the window: the process is still genuinely running,
// just invisibly. Close both before the app actually exits.
app.on('before-quit', () => {
  closeSerialPort();
  stopLocalCompileServer();
});
