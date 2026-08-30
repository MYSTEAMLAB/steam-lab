import { app, dialog, BrowserWindow } from 'electron';
import { autoUpdater } from 'electron-updater';

// Never auto-download — always ask first, whether the check was triggered
// silently at startup or manually from the HELP menu.
autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = true;

// Distinguishes a user-initiated check from the silent startup check: only
// the manual path shows "you're already up to date" / error dialogs.
let manualCheckPending = false;

function activeWindow(): BrowserWindow | null {
  return BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0] ?? null;
}

async function showBox(options: Electron.MessageBoxOptions): Promise<Electron.MessageBoxReturnValue> {
  const window = activeWindow();
  return window ? dialog.showMessageBox(window, options) : dialog.showMessageBox(options);
}

/** Wires up update event handling. Call once at startup; also kicks off a silent check. */
export function setupAutoUpdater(): void {
  autoUpdater.on('update-available', async (info) => {
    const { response } = await showBox({
      type: 'info',
      title: 'Update Available',
      message: `A new version (v${info.version}) is available. You are on v${app.getVersion()}.`,
      detail: 'Would you like to download it now?',
      buttons: ['Download', 'Later'],
      cancelId: 1
    });
    manualCheckPending = false;
    if (response === 0) autoUpdater.downloadUpdate();
  });

  autoUpdater.on('update-not-available', () => {
    if (manualCheckPending) {
      showBox({
        type: 'info',
        title: 'Check for Updates',
        message: `You are currently on the latest version (v${app.getVersion()}).`
      });
    }
    manualCheckPending = false;
  });

  autoUpdater.on('error', (error) => {
    if (manualCheckPending) {
      showBox({
        type: 'error',
        title: 'Check for Updates',
        message: `Could not check for updates.\n\n${error.message}`
      });
    } else {
      console.error('[autoUpdater]', error);
    }
    manualCheckPending = false;
  });

  autoUpdater.on('update-downloaded', async (info) => {
    const { response } = await showBox({
      type: 'info',
      title: 'Update Ready',
      message: `Version ${info.version} has been downloaded.`,
      detail: 'Restart MY STEAM LAB now to install the update?',
      buttons: ['Restart Now', 'Later'],
      cancelId: 1
    });
    if (response === 0) autoUpdater.quitAndInstall();
  });

  // Silent background check shortly after launch — only interrupts the user
  // once an update is actually found (see 'update-available' above).
  if (app.isPackaged) {
    autoUpdater.checkForUpdates().catch((error) => {
      console.error('[autoUpdater] startup check failed', error);
    });
  }
}

/** Triggered from the HELP > Check for Updates menu item — always gives feedback. */
export function checkForUpdatesManually(): void {
  if (!app.isPackaged) {
    showBox({
      type: 'info',
      title: 'Check for Updates',
      message: 'Update checks are only available in the packaged app, not in development mode.'
    });
    return;
  }
  if (manualCheckPending) return;

  manualCheckPending = true;
  autoUpdater.checkForUpdates().catch((error) => {
    showBox({
      type: 'error',
      title: 'Check for Updates',
      message: `Could not check for updates.\n\n${(error as Error).message}`
    });
    manualCheckPending = false;
  });
}
