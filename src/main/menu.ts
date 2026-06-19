import { app, Menu, dialog, BrowserWindow, shell } from 'electron';
import { getRecentProjects } from './ipc/projectHandlers';
import { basename } from 'path';

export async function setupApplicationMenu() {
  const showComingSoon = (item: Electron.MenuItem, window: any) => {
    if (window) {
      dialog.showMessageBox(window, {
        type: 'info',
        title: 'Feature Coming Soon',
        message: `[${item.label}] feature coming soon!`,
        buttons: ['OK']
      });
    } else {
      dialog.showMessageBox({
        type: 'info',
        title: 'Feature Coming Soon',
        message: `[${item.label}] feature coming soon!`,
        buttons: ['OK']
      });
    }
  };

  const dispatchAction = (action: string) => {
    const windows = BrowserWindow.getAllWindows();
    if (windows.length > 0) {
      windows[0].webContents.send('menu:action', action);
    }
  };

  const dispatchRecent = (filePath: string) => {
    const windows = BrowserWindow.getAllWindows();
    if (windows.length > 0) {
      windows[0].webContents.send('menu:action', `open-recent|${filePath}`);
    }
  };

  const showShortcuts = (window: any) => {
    const message = `
Keyboard Shortcuts:
• Ctrl/Cmd + Z : Undo
• Ctrl/Cmd + Y : Redo
• Ctrl/Cmd + C : Copy
• Ctrl/Cmd + V : Paste
• Delete / Backspace : Delete selected block or component
• Scroll / Drag : Pan canvas
• Ctrl/Cmd + Scroll : Zoom canvas
    `.trim();
    if (window) dialog.showMessageBox(window, { type: 'info', title: 'Keyboard Shortcuts', message });
    else dialog.showMessageBox({ type: 'info', title: 'Keyboard Shortcuts', message });
  };

  const showUpdates = (window: any) => {
    const message = 'You are currently on the latest version (v1.0.0).';
    if (window) dialog.showMessageBox(window, { type: 'info', title: 'Check for Updates', message });
    else dialog.showMessageBox({ type: 'info', title: 'Check for Updates', message });
  };

  const showAbout = (window: any) => {
    const message = 'MY STREAM LAB\\nVersion 1.0.0\\n\\nA visual block-based IoT programming environment built for makers and educators.';
    if (window) dialog.showMessageBox(window, { type: 'info', title: 'About MY STREAM LAB', message });
    else dialog.showMessageBox({ type: 'info', title: 'About MY STREAM LAB', message });
  };

  const recents = await getRecentProjects();
  const recentSubmenu: Electron.MenuItemConstructorOptions[] = recents.length > 0 
    ? recents.map(path => ({
        label: basename(path),
        click: () => dispatchRecent(path)
      }))
    : [{ label: 'No Recent Projects', enabled: false }];

  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: 'FILE',
      submenu: [
        { label: 'New Project', click: () => dispatchAction('new-project') },
        { label: 'Open Project', click: () => dispatchAction('open-project') },
        { label: 'Save Project', click: () => dispatchAction('save-project') },
        { label: 'Save Project As', click: () => dispatchAction('save-project-as') },
        { label: 'Recent Projects', submenu: recentSubmenu },
        { type: 'separator' },
        { label: 'Export Arduino Code (.ino)', click: () => dispatchAction('export-ino') },
        { label: 'Export Project (.msl)', click: showComingSoon },
        { type: 'separator' },
        { label: 'Exit', role: 'quit' }
      ]
    },
    {
      label: 'EDIT',
      submenu: [
        { label: 'Undo', role: 'undo' },
        { label: 'Redo', role: 'redo' },
        { type: 'separator' },
        { label: 'Cut', role: 'cut' },
        { label: 'Copy', role: 'copy' },
        { label: 'Paste', role: 'paste' },
        { label: 'Delete', role: 'delete' },
        { type: 'separator' },
        { label: 'Select All', role: 'selectAll' }
      ]
    },
    {
      label: 'VIEW',
      submenu: [
        { label: 'Zoom In', role: 'zoomIn' },
        { label: 'Zoom Out', role: 'zoomOut' },
        { label: 'Reset Zoom', role: 'resetZoom' },
        { type: 'separator' },
        { label: 'Toggle Code Panel', click: showComingSoon },
        { label: 'Toggle Hardware Canvas', click: showComingSoon },
        { label: 'Toggle Serial Monitor', click: showComingSoon },
        { type: 'separator' },
        { label: 'Full Screen', role: 'togglefullscreen' }
      ]
    },
    {
      label: 'TOOLS',
      submenu: [
        { label: 'Board Manager', click: showComingSoon },
        { label: 'Port Selection', click: showComingSoon },
        { label: 'Library Manager', click: showComingSoon },
        { type: 'separator' },
        { label: 'Serial Monitor', click: showComingSoon },
        { label: 'Serial Plotter', click: showComingSoon },
        { type: 'separator' },
        { label: 'Theme Settings', click: showComingSoon }
      ]
    },
    {
      label: 'DEVICE',
      submenu: [
        { label: 'Connect Device', click: () => dispatchAction('device-connect') },
        { label: 'Disconnect Device', click: () => dispatchAction('device-disconnect') },
        { label: 'Scan COM Ports', click: () => dispatchAction('device-scan') },
        { type: 'separator' },
        { label: 'ESP32 Information', click: showComingSoon },
        { label: 'Firmware Tools', click: showComingSoon }
      ]
    },
    {
      label: 'HELP',
      submenu: [
        { label: 'User Guide', click: () => shell.openExternal('https://github.com/Tech-Anshika/streamlab#readme') },
        { label: 'Keyboard Shortcuts', click: (item, window) => showShortcuts(window) },
        { label: 'Documentation', click: () => shell.openExternal('https://github.com/Tech-Anshika/streamlab/wiki') },
        { type: 'separator' },
        { label: 'Report Issue', click: () => shell.openExternal('https://github.com/Tech-Anshika/streamlab/issues') },
        { label: 'Check for Updates', click: (item, window) => showUpdates(window) },
        { type: 'separator' },
        { label: 'About MY STREAM LAB', click: (item, window) => showAbout(window) }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}
