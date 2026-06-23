import { ipcMain, dialog, BrowserWindow, app } from 'electron';
import * as fs from 'fs/promises';
import { join } from 'path';

const RECENT_PROJECTS_FILE = join(app.getPath('userData'), 'recent-projects.json');
const AUTO_SAVE_FILE = join(app.getPath('userData'), 'autosave.msl');

import { setupApplicationMenu } from '../menu';

export async function getRecentProjects(): Promise<string[]> {
  try {
    const data = await fs.readFile(RECENT_PROJECTS_FILE, 'utf-8');
    return JSON.parse(data);
  } catch {
    return [];
  }
}

async function addRecentProject(filePath: string) {
  let recents = await getRecentProjects();
  recents = recents.filter(p => p !== filePath);
  recents.unshift(filePath);
  if (recents.length > 10) {
    recents = recents.slice(0, 10);
  }
  await fs.writeFile(RECENT_PROJECTS_FILE, JSON.stringify(recents, null, 2));
  setupApplicationMenu(); // Rebuild menu to show new recents
}

export function registerProjectHandlers() {
  ipcMain.handle('project:open', async (event, filePath?: string) => {
    let targetPath = filePath;
    const window = BrowserWindow.fromWebContents(event.sender);
    
    if (!targetPath) {
      if (!window) return null;
      const result = await dialog.showOpenDialog(window, {
        title: 'Open MY STEAM LAB Project',
        filters: [{ name: 'MY STEAM LAB Project', extensions: ['msl'] }],
        properties: ['openFile']
      });

      if (result.canceled || result.filePaths.length === 0) {
        return null;
      }
      targetPath = result.filePaths[0];
    }

    try {
      const data = await fs.readFile(targetPath, 'utf-8');
      const json = JSON.parse(data);
      await addRecentProject(targetPath);
      return { path: targetPath, data: json };
    } catch (err) {
      console.error('Failed to open project:', err);
      if (window) {
        dialog.showErrorBox('Open Error', 'Failed to open the project file. It may be corrupted or inaccessible.');
      }
      return null;
    }
  });

  ipcMain.handle('project:save', async (event, { path, data }: { path: string, data: any }) => {
    try {
      data.version = 1; // Project file versioning
      await fs.writeFile(path, JSON.stringify(data, null, 2));
      await addRecentProject(path);
      return { success: true, path };
    } catch (err) {
      console.error('Failed to save project:', err);
      return { success: false, error: String(err) };
    }
  });

  ipcMain.handle('project:saveAs', async (event, data: any) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (!window) return null;

    const result = await dialog.showSaveDialog(window, {
      title: 'Save MY STEAM LAB Project',
      filters: [{ name: 'MY STEAM LAB Project', extensions: ['msl'] }],
      defaultPath: data.projectName || 'Untitled Project'
    });

    if (result.canceled || !result.filePath) {
      return null;
    }

    try {
      data.version = 1; // Project file versioning
      await fs.writeFile(result.filePath, JSON.stringify(data, null, 2));
      await addRecentProject(result.filePath);
      return { success: true, path: result.filePath };
    } catch (err) {
      console.error('Failed to save project:', err);
      return { success: false, error: String(err) };
    }
  });

  ipcMain.handle('project:exportIno', async (event, { code, defaultName }: { code: string, defaultName: string }) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (!window) return null;

    const result = await dialog.showSaveDialog(window, {
      title: 'Export Arduino Code',
      filters: [{ name: 'Arduino Sketch', extensions: ['ino'] }],
      defaultPath: defaultName || 'sketch'
    });

    if (result.canceled || !result.filePath) {
      return null;
    }

    try {
      await fs.writeFile(result.filePath, code);
      return { success: true, path: result.filePath };
    } catch (err) {
      console.error('Failed to export .ino:', err);
      return { success: false, error: String(err) };
    }
  });

  ipcMain.handle('project:getRecents', async () => {
    return await getRecentProjects();
  });

  ipcMain.handle('project:autoSave', async (event, data: any) => {
    try {
      data.version = 1;
      await fs.writeFile(AUTO_SAVE_FILE, JSON.stringify(data));
      return true;
    } catch {
      return false;
    }
  });

  ipcMain.handle('project:checkRecovery', async () => {
    try {
      const stats = await fs.stat(AUTO_SAVE_FILE);
      if (stats.size > 0) {
        const data = await fs.readFile(AUTO_SAVE_FILE, 'utf-8');
        return JSON.parse(data);
      }
    } catch {
      // File doesn't exist or is invalid
    }
    return null;
  });

  ipcMain.handle('project:clearRecovery', async () => {
    try {
      await fs.unlink(AUTO_SAVE_FILE);
    } catch {
      // Ignore if file doesn't exist
    }
  });
}
