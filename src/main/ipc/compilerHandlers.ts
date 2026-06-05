import { ipcMain, app } from 'electron';
import fs from 'fs';
import path from 'path';
import https from 'https';
import { exec } from 'child_process';
import AdmZip from 'adm-zip';

const COMPILER_DIR = path.join(app.getPath('userData'), 'compiler');
const CLI_PATH = path.join(COMPILER_DIR, 'arduino-cli.exe');
const TEMP_DIR = path.join(app.getPath('temp'), 'edublocks_build');

export function registerCompilerHandlers() {
  ipcMain.handle('compiler:check', async (event) => {
    return new Promise<boolean>((resolve) => {
      if (fs.existsSync(CLI_PATH)) {
        resolve(true);
      } else {
        resolve(false);
      }
    });
  });

  ipcMain.handle('compiler:install', async (event) => {
    return new Promise<boolean>((resolve, reject) => {
      if (!fs.existsSync(COMPILER_DIR)) {
        fs.mkdirSync(COMPILER_DIR, { recursive: true });
      }

      event.sender.send('compiler:log', '[Installer] Downloading Arduino CLI...');
      const zipPath = path.join(COMPILER_DIR, 'arduino-cli.zip');
      const file = fs.createWriteStream(zipPath);

      https.get('https://downloads.arduino.cc/arduino-cli/arduino-cli_latest_Windows_64bit.zip', (response) => {
        if (response.statusCode === 301 || response.statusCode === 302) {
          // Handle redirect
          https.get(response.headers.location!, (res2) => {
            res2.pipe(file);
            file.on('finish', () => {
              file.close();
              extractZip();
            });
          });
        } else {
          response.pipe(file);
          file.on('finish', () => {
            file.close();
            extractZip();
          });
        }
      }).on('error', (err) => {
        fs.unlinkSync(zipPath);
        reject(err);
      });

      function extractZip() {
        try {
          event.sender.send('compiler:log', '[Installer] Extracting CLI...');
          const zip = new AdmZip(zipPath);
          zip.extractAllTo(COMPILER_DIR, true);
          fs.unlinkSync(zipPath);
          
          event.sender.send('compiler:log', '[Installer] Installing ESP32 core. This may take a few minutes...');
          
          // Add ESP32 board URL
          exec(`"${CLI_PATH}" config init`, { cwd: COMPILER_DIR }, () => {
            exec(`"${CLI_PATH}" config add board_manager.additional_urls https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json`, { cwd: COMPILER_DIR }, () => {
              exec(`"${CLI_PATH}" core update-index`, { cwd: COMPILER_DIR }, (err, stdout, stderr) => {
                exec(`"${CLI_PATH}" core install esp32:esp32`, { cwd: COMPILER_DIR, maxBuffer: 1024 * 1024 * 5 }, (err2, stdout2, stderr2) => {
                  if (err2) {
                    event.sender.send('compiler:log', '[Installer] Warning: ESP32 core install had errors: ' + stderr2);
                  }
                  event.sender.send('compiler:log', '[Installer] Complete!');
                  resolve(true);
                });
              });
            });
          });
        } catch (e) {
          reject(e);
        }
      }
    });
  });

  ipcMain.handle('compiler:compile', async (event, code: string, fqbn: string) => {
    return new Promise<{success: boolean, log: string}>((resolve) => {
      try {
        if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true });
        
        const sketchDir = path.join(TEMP_DIR, 'sketch');
        if (!fs.existsSync(sketchDir)) fs.mkdirSync(sketchDir, { recursive: true });
        
        const sketchPath = path.join(sketchDir, 'sketch.ino');
        fs.writeFileSync(sketchPath, code);

        event.sender.send('compiler:log', `[Compiler] Compiling for ${fqbn}...`);
        
        exec(`"${CLI_PATH}" compile -b ${fqbn} "${sketchDir}"`, { maxBuffer: 1024 * 1024 * 5 }, (err, stdout, stderr) => {
          if (err) {
            resolve({ success: false, log: stdout + '\n' + stderr });
          } else {
            resolve({ success: true, log: stdout });
          }
        });
      } catch (e: any) {
        resolve({ success: false, log: e.message });
      }
    });
  });

  ipcMain.handle('compiler:upload', async (event, code: string, fqbn: string, port: string) => {
    return new Promise<{success: boolean, log: string}>((resolve) => {
      try {
        const sketchDir = path.join(TEMP_DIR, 'sketch');
        
        // Always save fresh code before upload
        if (!fs.existsSync(sketchDir)) fs.mkdirSync(sketchDir, { recursive: true });
        fs.writeFileSync(path.join(sketchDir, 'sketch.ino'), code);

        event.sender.send('compiler:log', `[Compiler] Uploading to ${port}...`);
        
        exec(`"${CLI_PATH}" upload -b ${fqbn} -p ${port} "${sketchDir}"`, { maxBuffer: 1024 * 1024 * 5 }, (err, stdout, stderr) => {
          if (err) {
            resolve({ success: false, log: stdout + '\n' + stderr });
          } else {
            resolve({ success: true, log: stdout });
          }
        });
      } catch (e: any) {
        resolve({ success: false, log: e.message });
      }
    });
  });
}
