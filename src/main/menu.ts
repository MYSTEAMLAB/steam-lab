import { app, Menu, dialog, BrowserWindow } from 'electron';
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
        { label: 'Connect Device', click: showComingSoon },
        { label: 'Disconnect Device', click: showComingSoon },
        { label: 'Scan COM Ports', click: showComingSoon },
        { type: 'separator' },
        { label: 'ESP32 Information', click: showComingSoon },
        { label: 'Firmware Tools', click: showComingSoon }
      ]
    },
    {
      label: 'HELP',
      submenu: [
        { label: 'User Guide', click: showComingSoon },
        { label: 'Keyboard Shortcuts', click: showComingSoon },
        { label: 'Documentation', click: showComingSoon },
        { type: 'separator' },
        { label: 'Report Issue', click: showComingSoon },
        { label: 'Check for Updates', click: showComingSoon },
        { type: 'separator' },
        { label: 'About MY STREAM LAB', click: showComingSoon }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}
