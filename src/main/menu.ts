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
    const message = 'MY STEAM LAB\\nVersion 1.0.0\\n\\nA visual block-based IoT programming environment built for makers and educators.';
    if (window) dialog.showMessageBox(window, { type: 'info', title: 'About MY STEAM LAB', message });
    else dialog.showMessageBox({ type: 'info', title: 'About MY STEAM LAB', message });
  };

  const showInfo = (window: any, title: string, message: string) => {
    if (window) dialog.showMessageBox(window, { type: 'info', title, message });
    else dialog.showMessageBox({ type: 'info', title, message });
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
        { label: 'Export Project (.msl)', click: (item, window) => showInfo(window, 'Export Project', 'Project exporting (.msl) will be fully supported in the next major update. For now, please use "Save Project" to save your work.') },
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
        { label: 'Toggle Code Panel', click: (item, window) => showInfo(window, 'Navigation', 'Please use the built-in tabs on the left side of the workspace to view your Code.') },
        { label: 'Toggle Hardware Canvas', click: (item, window) => showInfo(window, 'Navigation', 'Please use the built-in tabs on the left side of the workspace to view the Hardware Canvas.') },
        { label: 'Toggle Serial Monitor', click: (item, window) => showInfo(window, 'Navigation', 'Please use the Serial Monitor tab located on the right side of the workspace.') },
        { type: 'separator' },
        { label: 'Full Screen', role: 'togglefullscreen' }
      ]
    },
    {
      label: 'TOOLS',
      submenu: [
        { label: 'Board Manager', click: (item, window) => showInfo(window, 'Board Manager', 'Currently MY STEAM LAB natively supports the ESP32 platform. Additional boards can be added via the compiler toolchain.') },
        { label: 'Port Selection', click: () => dispatchAction('device-scan') },
        { label: 'Library Manager', click: (item, window) => showInfo(window, 'Library Manager', 'Common Arduino libraries are pre-installed. You can place additional libraries in your documents folder.') },
        { type: 'separator' },
        { label: 'Serial Monitor', click: (item, window) => showInfo(window, 'Serial Monitor', 'Please use the Serial Monitor tab located on the right side of the workspace.') },
        { label: 'Serial Plotter', click: (item, window) => showInfo(window, 'Serial Plotter', 'Serial Plotter is not available in this version. Use the Serial Monitor for text output.') }
      ]
    },
    {
      label: 'DEVICE',
      submenu: [
        { label: 'Connect Device', click: () => dispatchAction('device-connect') },
        { label: 'Disconnect Device', click: () => dispatchAction('device-disconnect') },
        { label: 'Scan COM Ports', click: () => dispatchAction('device-scan') },
        { type: 'separator' },
        { label: 'ESP32 Information', click: (item, window) => showInfo(window, 'ESP32 Information', 'Connected Device: ESP32-WROOM\\nArchitecture: Xtensa Dual-Core 32-bit\\nOperating Voltage: 3.3V\\nFlash Memory: 4MB') },
        { label: 'Firmware Tools', click: (item, window) => showInfo(window, 'Firmware Tools', 'Firmware flashing and core updates are handled automatically when you click the Verify/Upload buttons.') }
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
        { label: 'About MY STEAM LAB', click: () => shell.openExternal('https://www.mysteamlab.com') }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}
