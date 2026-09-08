import { ipcMain, app } from 'electron';
import fs from 'fs';
import path from 'path';
import https from 'https';
import { exec, spawn } from 'child_process';
import AdmZip from 'adm-zip';
import { uploadFirmwareOverBluetooth } from './bluetoothHandlers';

export const COMPILER_DIR = path.join(app.getPath('userData'), 'compiler');
export const CLI_PATH = path.join(COMPILER_DIR, 'arduino-cli.exe');
// Deliberately NOT under app.getPath('temp') — that's the OS temp folder,
// which Windows, antivirus tools, and disk-cleanup utilities can and do wipe
// between sessions. This build-path is arduino-cli's incremental cache (skips
// recompiling unchanged core/library object files); losing it silently turns
// every "first compile after restarting the app" into a full from-scratch
// ESP32 core rebuild (~3.5 minutes measured here) instead of the ~30 seconds
// a warm cache gives. userData is this app's own persistent directory
// (same base COMPILER_DIR already uses), not subject to generic temp sweeps.
const TEMP_DIR = path.join(app.getPath('userData'), 'build');

// Libraries required by sensor/display blocks that are not bundled with the ESP32
// core — detected from the generated sketch itself rather than hardcoded as one
// fixed list, so a compile that doesn't use the OLED or DS18B20 blocks isn't
// slowed down installing libraries it will never include.
//
// This previously only covered OneWire/DallasTemperature, so any project with an
// OLED block failed to compile with "Adafruit_SSD1306.h: No such file or
// directory" — the generator emits the #include, but nothing ever installed the
// library for it.
export function getRequiredLibraries(code: string): string[] {
  const libs: string[] = [];
  if (code.includes('<OneWire.h>')) libs.push('OneWire');
  if (code.includes('<DallasTemperature.h>')) libs.push('DallasTemperature');
  if (code.includes('<Adafruit_SSD1306.h>')) libs.push('Adafruit GFX Library', 'Adafruit SSD1306');
  // Same class of bug as the OLED one above: the color sensor's codegen
  // (arduinoGenerator.ts) emits this #include whenever a color_sensor
  // device is placed, but nothing installed the library for it — every
  // project using the Color Sensor block failed to compile with
  // "Adafruit_TCS34725.h: No such file or directory" until this was added.
  if (code.includes('<Adafruit_TCS34725.h>')) libs.push('Adafruit TCS34725', 'Adafruit BusIO');
  // Same class of bug again: LED Matrix blocks (arduinoGenerator.ts,
  // ensureLedMatrixRuntime) emit this #include for AI Junior's onboard 6x6
  // WS2812 matrix, but nothing installed the library for it.
  if (code.includes('<FastLED.h>')) libs.push('FastLED');
  return libs;
}

// Small, fast libraries worth pre-installing once during initial toolchain setup
// (compiler:install below), before any sketch exists to detect requirements from.
// Everything else — notably the OLED libraries — installs on-demand at compile
// time via getRequiredLibraries, the first time a project actually needs it.
const BASE_LIBRARIES = ['OneWire', 'DallasTemperature'];

// Locates the ESP32 core's bundled `espota` tool for wireless (OTA) uploads.
// We invoke it directly instead of `arduino-cli upload -l network` because
// that path requires arduino-cli's own mDNS discovery to have already
// resolved the target IP into a full port record (host, OTA port, etc.) —
// confirmed experimentally: it fails with "port not found" for a plain IP
// that hasn't shown up in a completed discovery scan. espota talks straight
// to the given IP:port, so it doesn't depend on mDNS/multicast working
// reliably on the local network (a real concern on school WiFi).
function findEspotaPath(): Promise<string | null> {
  return new Promise((resolve) => {
    exec(`"${CLI_PATH}" config get directories.data`, { cwd: COMPILER_DIR }, (err, stdout) => {
      if (err) { resolve(null); return; }
      const dataDir = stdout.trim();
      const esp32HwDir = path.join(dataDir, 'packages', 'esp32', 'hardware', 'esp32');
      try {
        const versions = fs.readdirSync(esp32HwDir).filter(v => fs.statSync(path.join(esp32HwDir, v)).isDirectory());
        if (versions.length === 0) { resolve(null); return; }
        versions.sort().reverse(); // newest version folder first
        const espotaPath = path.join(esp32HwDir, versions[0], 'tools', 'espota.exe');
        resolve(fs.existsSync(espotaPath) ? espotaPath : null);
      } catch {
        resolve(null);
      }
    });
  });
}

// BluetoothSerial (Bluedroid) is a big library, and Bluetooth uploads additionally
// need a spare app slot to write the incoming image into. Neither fits the ESP32's
// default 1.2 MB app partition, so any sketch using Bluetooth is built with the
// min_spiffs scheme (~1.9 MB per app slot) instead. The partition table is only
// rewritten during a USB upload — which is precisely why the first upload of a
// Bluetooth project has to go over the cable before wireless uploads can work.
export function withBluetoothPartition(fqbn: string, code: string): string {
  if (!code.includes('BluetoothSerial.h')) return fqbn;
  if (fqbn.includes('PartitionScheme=')) return fqbn;
  // An FQBN is vendor:arch:board[:opt=val,opt=val] — options join with a comma
  // once the board already carries some.
  const hasOptions = fqbn.split(':').length > 3;
  return `${fqbn}${hasOptions ? ',' : ':'}PartitionScheme=min_spiffs`;
}

export function ensureLibrariesInstalled(
  libs: string[],
  onLog: (msg: string) => void,
  onDone: () => void
) {
  if (libs.length === 0) {
    onDone();
    return;
  }
  const [lib, ...rest] = libs;
  exec(`"${CLI_PATH}" lib list "${lib}"`, { cwd: COMPILER_DIR }, (_err, stdout) => {
    const alreadyInstalled = !!stdout && stdout.toLowerCase().includes(lib.toLowerCase());
    if (alreadyInstalled) {
      ensureLibrariesInstalled(rest, onLog, onDone);
      return;
    }
    onLog(`[Compiler] Installing library: ${lib}...`);
    exec(
      `"${CLI_PATH}" lib install "${lib}"`,
      { cwd: COMPILER_DIR, maxBuffer: 1024 * 1024 * 5 },
      (err2, _stdout2, stderr2) => {
        if (err2) {
          onLog(`[Compiler] Warning: failed to install library ${lib}: ${stderr2}`);
        }
        ensureLibrariesInstalled(rest, onLog, onDone);
      }
    );
  });
}

// A persistent build-path cache (see TEMP_DIR / LAN_BUILD_DIR) makes repeat
// compiles ~10x faster by letting arduino-cli skip recompiling unchanged
// core/library object files — but if a compile is ever killed mid-write
// (app closed while compiling, machine sleeps, a crash), the cached core.a
// archive can end up with some object files rebuilt and others stale from a
// half-finished pass. The result is a compile that "succeeds" at compiling
// every source file but fails at the *link* step with dozens of "undefined
// reference to `EspClass::...`/`HardwareSerial::...`" errors — confirmed by
// reproducing it here after an interrupted compile. That failure has nothing
// to do with the user's actual code, so silently making them see it (and
// then keep seeing it on every future compile, since the corruption never
// heals itself) would be a real regression from the caching win. Detect this
// specific signature and self-heal with exactly one full rebuild.
function looksLikeCorruptBuildCache(log: string): boolean {
  return log.includes('ld returned 1 exit status')
    && /undefined reference to `(HardwareSerial|EspClass|HEXBuilder|UartClass)/.test(log);
}

/** Runs one arduino-cli compile, auto-retrying once with a wiped build dir
 *  if the failure looks like build-cache corruption rather than a real
 *  error in the user's code. */
export function compileWithSelfHeal(
  args: string[],
  buildDir: string,
  onLog: (msg: string) => void
): Promise<{ success: boolean; log: string }> {
  const runOnce = (): Promise<{ success: boolean; log: string }> => {
    return new Promise((resolve) => {
      const proc = spawn(CLI_PATH, args);
      let fullLog = '';
      proc.stdout.on('data', (data) => {
        const chunk = data.toString();
        fullLog += chunk;
        onLog(chunk.trim());
      });
      proc.stderr.on('data', (data) => {
        const chunk = data.toString();
        fullLog += chunk;
        onLog(`[Error] ${chunk.trim()}`);
      });
      proc.on('close', (exitCode) => {
        resolve({ success: exitCode === 0, log: fullLog });
      });
    });
  };

  return runOnce().then((result) => {
    if (result.success || !looksLikeCorruptBuildCache(result.log)) return result;
    onLog('[Compiler] Build cache looks corrupted from an interrupted compile — rebuilding from scratch once...');
    try {
      fs.rmSync(buildDir, { recursive: true, force: true });
      fs.mkdirSync(buildDir, { recursive: true });
    } catch (e: any) {
      onLog(`[Compiler] Could not clear build cache: ${e.message}`);
      return result;
    }
    return runOnce();
  });
}

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
                  event.sender.send('compiler:log', '[Installer] Installing sensor libraries...');
                  ensureLibrariesInstalled(
                    BASE_LIBRARIES,
                    (msg) => event.sender.send('compiler:log', msg),
                    () => {
                      event.sender.send('compiler:log', '[Installer] Complete!');
                      resolve(true);
                    }
                  );
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

  ipcMain.handle('compiler:compile', async (event, code: string, rawFqbn: string) => {
    const fqbn = withBluetoothPartition(rawFqbn, code);
    return new Promise<{success: boolean, log: string}>((resolve) => {
      try {
        if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true });
        
        const sketchDir = path.join(TEMP_DIR, 'sketch');
        if (!fs.existsSync(sketchDir)) fs.mkdirSync(sketchDir, { recursive: true });
        
        const buildDir = path.join(TEMP_DIR, 'build');
        if (!fs.existsSync(buildDir)) fs.mkdirSync(buildDir, { recursive: true });

        // Force rebuild of the sketch by deleting the cached binary
        try {
          fs.rmSync(path.join(buildDir, 'sketch.ino.bin'), { force: true });
          fs.rmSync(path.join(buildDir, 'sketch.ino.elf'), { force: true });
        } catch(e) {}
        
        const sketchPath = path.join(sketchDir, 'sketch.ino');
        fs.writeFileSync(sketchPath, code);

        event.sender.send('compiler:log', ' ');
        event.sender.send('compiler:log', `==== COMPILATION START ====`);
        event.sender.send('compiler:log', `[Compiler] Compiling for ${fqbn}...`);
        event.sender.send('compiler:log', `[Debug] Sketch code length: ${code.length} bytes`);

        ensureLibrariesInstalled(
          getRequiredLibraries(code),
          (msg) => event.sender.send('compiler:log', msg),
          async () => {
            const result = await compileWithSelfHeal(
              ['compile', '-b', fqbn, '-j', '0', '--build-path', buildDir, sketchDir],
              buildDir,
              (msg) => event.sender.send('compiler:log', msg)
            );
            event.sender.send('compiler:log', result.success ? `==== COMPILATION SUCCESS ====` : `==== COMPILATION FAILED ====`);
            resolve(result);
          }
        );

      } catch (e: any) {
        resolve({ success: false, log: e.message });
      }
    });
  });

  ipcMain.handle('compiler:upload', async (
    event,
    code: string,
    rawFqbn: string,
    port: string,
    wifiTarget?: { ip: string; password?: string },
    btTarget?: { port: string }
  ) => {
    const fqbn = withBluetoothPartition(rawFqbn, code);
    return new Promise<{success: boolean, log: string}>((resolve) => {
      try {
        const sketchDir = path.join(TEMP_DIR, 'sketch');
        const buildDir = path.join(TEMP_DIR, 'build');

        if (!fs.existsSync(sketchDir)) fs.mkdirSync(sketchDir, { recursive: true });
        if (!fs.existsSync(buildDir)) fs.mkdirSync(buildDir, { recursive: true });

        // Force rebuild of the sketch by deleting the cached binary
        try {
          fs.rmSync(path.join(buildDir, 'sketch.ino.bin'), { force: true });
          fs.rmSync(path.join(buildDir, 'sketch.ino.elf'), { force: true });
        } catch(e) {}

        // Always save fresh code before upload
        fs.writeFileSync(path.join(sketchDir, 'sketch.ino'), code);

        event.sender.send('compiler:log', ' ');
        event.sender.send('compiler:log', `==== UPLOAD START ====`);
        event.sender.send('compiler:log', wifiTarget
          ? `[Compiler] Uploading wirelessly (OTA) to ${wifiTarget.ip}...`
          : btTarget
            ? `[Compiler] Uploading over Bluetooth via ${btTarget.port}...`
            : `[Compiler] Uploading to ${port}...`);
        if (fqbn !== rawFqbn) {
          event.sender.send('compiler:log', `[Compiler] Bluetooth sketch — building with ${fqbn.split(':').pop()}.`);
        }
        event.sender.send('compiler:log', `[Debug] Upload sketch code length: ${code.length} bytes`);

        ensureLibrariesInstalled(
          getRequiredLibraries(code),
          (msg) => event.sender.send('compiler:log', msg),
          async () => {
            // ── USB (serial) upload — unchanged single-step compile+upload ──
            if (!wifiTarget && !btTarget) {
              const result = await compileWithSelfHeal(
                ['compile', '--upload', '-b', fqbn, '-p', port, '-j', '0', '--build-path', buildDir, sketchDir],
                buildDir,
                (msg) => event.sender.send('compiler:log', msg)
              );
              event.sender.send('compiler:log', result.success ? `==== UPLOAD SUCCESS ====` : `==== UPLOAD FAILED ====`);
              resolve(result);
              return;
            }

            // ── Wireless upload (WiFi OTA or Bluetooth) — compile only, then push
            // the .bin to the board over the chosen link. Either way the board must
            // already be running code that can receive it, from a prior USB upload:
            // WiFi needs the ArduinoOTA service (WiFi Connect block), Bluetooth needs
            // the upload agent (any Bluetooth block).
            const compileResult = await compileWithSelfHeal(
              ['compile', '-b', fqbn, '-j', '0', '--build-path', buildDir, sketchDir],
              buildDir,
              (msg) => event.sender.send('compiler:log', msg)
            );
            let fullLog = compileResult.log;

            {
              if (!compileResult.success) {
                event.sender.send('compiler:log', `==== UPLOAD FAILED (compile step) ====`);
                resolve({ success: false, log: fullLog });
                return;
              }

              const binPath = path.join(buildDir, 'sketch.ino.bin');

              // ── Bluetooth upload — stream the image to the sketch's own agent ──
              if (btTarget) {
                if (!fs.existsSync(binPath)) {
                  event.sender.send('compiler:log', `[Error] Compiled binary not found for Bluetooth upload.`);
                  event.sender.send('compiler:log', `==== UPLOAD FAILED ====`);
                  resolve({ success: false, log: fullLog });
                  return;
                }
                const btResult = await uploadFirmwareOverBluetooth(
                  binPath,
                  btTarget.port,
                  (msg) => {
                    fullLog += msg + '\n';
                    event.sender.send('compiler:log', msg);
                  }
                );
                if (btResult.success) {
                  event.sender.send('compiler:log', `==== UPLOAD SUCCESS ====`);
                  resolve({ success: true, log: fullLog });
                } else {
                  event.sender.send('compiler:log', `[Error] ${btResult.error}`);
                  event.sender.send('compiler:log', `==== UPLOAD FAILED ====`);
                  resolve({ success: false, log: fullLog });
                }
                return;
              }

              const espotaPath = await findEspotaPath();
              if (!espotaPath || !fs.existsSync(binPath)) {
                event.sender.send('compiler:log', `[Error] Could not locate the espota tool or compiled binary for wireless upload.`);
                event.sender.send('compiler:log', `==== UPLOAD FAILED ====`);
                resolve({ success: false, log: fullLog });
                return;
              }

              event.sender.send('compiler:log', `[Compiler] Sending firmware over WiFi to ${wifiTarget.ip}:3232...`);
              const espotaArgs = ['-i', wifiTarget.ip, '-p', '3232', '-f', binPath];
              if (wifiTarget.password) espotaArgs.push('-a', wifiTarget.password);

              const uploadProc = spawn(espotaPath, espotaArgs);
              uploadProc.stdout.on('data', (data) => {
                const chunk = data.toString();
                fullLog += chunk;
                event.sender.send('compiler:log', chunk.trim());
              });
              uploadProc.stderr.on('data', (data) => {
                const chunk = data.toString();
                fullLog += chunk;
                event.sender.send('compiler:log', `[Error] ${chunk.trim()}`);
              });
              uploadProc.on('close', (uploadCode) => {
                if (uploadCode !== 0) {
                  event.sender.send('compiler:log', `==== UPLOAD FAILED ====`);
                  resolve({ success: false, log: fullLog });
                } else {
                  event.sender.send('compiler:log', `==== UPLOAD SUCCESS ====`);
                  resolve({ success: true, log: fullLog });
                }
              });
            }
          }
        );

      } catch (e: any) {
        resolve({ success: false, log: e.message });
      }
    });
  });
}
