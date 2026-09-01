import http from 'http';
import os from 'os';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { app, ipcMain } from 'electron';
import { CLI_PATH, getRequiredLibraries, withBluetoothPartition, ensureLibrariesInstalled } from './ipc/compilerHandlers';

// ── Local-network compile server ────────────────────────────────────────────
// Lets the Android companion app compile Arduino sketches without a paid cloud
// service and without on-device compilation (confirmed infeasible — the ESP32
// Xtensa GCC toolchain is glibc-linked and doesn't run under Android's Bionic
// libc). Reuses this desktop app's already-installed arduino-cli + ESP32 core
// via a small HTTP server on the LAN. Requests are serialized (one compile at
// a time) since arduino-cli shares one toolchain data directory across every
// request — safe under concurrent access isn't guaranteed otherwise.

const PORT = 47285;
let server: http.Server | null = null;
let currentPin = '';
let compileQueue: Promise<unknown> = Promise.resolve();

function enqueue<T>(fn: () => Promise<T>): Promise<T> {
  const result = compileQueue.then(fn, fn);
  compileQueue = result.catch(() => undefined);
  return result;
}

function getLanIp(): string | null {
  const ifaces = os.networkInterfaces();
  for (const name of Object.keys(ifaces)) {
    for (const iface of ifaces[name] || []) {
      if (iface.family === 'IPv4' && !iface.internal) return iface.address;
    }
  }
  return null;
}

function generatePin(): string {
  return String(crypto.randomInt(100000, 999999));
}

function readJsonBody(req: http.IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
      if (data.length > 20 * 1024 * 1024) req.destroy(new Error('Request body too large'));
    });
    req.on('end', () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

function compileOne(
  code: string,
  rawFqbn: string,
  onLog: (msg: string) => void
): Promise<{ success: boolean; log: string; binBase64?: string }> {
  const fqbn = withBluetoothPartition(rawFqbn, code);
  return new Promise((resolve) => {
    const reqId = crypto.randomBytes(6).toString('hex');
    const buildRoot = path.join(app.getPath('temp'), 'edublocks_lan_build', reqId);
    const sketchDir = path.join(buildRoot, 'sketch');
    const buildDir = path.join(buildRoot, 'build');

    try {
      fs.mkdirSync(sketchDir, { recursive: true });
      fs.mkdirSync(buildDir, { recursive: true });
      fs.writeFileSync(path.join(sketchDir, 'sketch.ino'), code);
    } catch (e: any) {
      resolve({ success: false, log: e.message });
      return;
    }

    const cleanup = () => fs.rm(buildRoot, { recursive: true, force: true }, () => {});

    onLog(`[Compiler] Compiling for ${fqbn}...`);

    ensureLibrariesInstalled(getRequiredLibraries(code), onLog, () => {
      const proc = spawn(CLI_PATH, ['compile', '-b', fqbn, '--build-path', buildDir, sketchDir]);
      let fullLog = '';

      proc.stdout.on('data', (d) => {
        const chunk = d.toString();
        fullLog += chunk;
        onLog(chunk.trim());
      });
      proc.stderr.on('data', (d) => {
        const chunk = d.toString();
        fullLog += chunk;
        onLog(`[Error] ${chunk.trim()}`);
      });

      proc.on('close', (exitCode) => {
        if (exitCode !== 0) {
          onLog('==== COMPILATION FAILED ====');
          resolve({ success: false, log: fullLog });
          cleanup();
          return;
        }
        try {
          const bin = fs.readFileSync(path.join(buildDir, 'sketch.ino.bin'));
          onLog('==== COMPILATION SUCCESS ====');
          resolve({ success: true, log: fullLog, binBase64: bin.toString('base64') });
        } catch (e: any) {
          resolve({ success: false, log: `${fullLog}\n${e.message}` });
        }
        cleanup();
      });
    });
  });
}

export function startLocalCompileServer(): { port: number; pin: string; lanIp: string | null } {
  if (server) {
    return { port: PORT, pin: currentPin, lanIp: getLanIp() };
  }

  currentPin = generatePin();
  server = http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Pair-Pin');
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    if (req.method === 'GET' && req.url === '/ping') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
      return;
    }

    if (req.method === 'POST' && req.url === '/compile') {
      if (req.headers['x-pair-pin'] !== currentPin) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, log: 'Invalid pairing PIN.' }));
        return;
      }

      if (!fs.existsSync(CLI_PATH)) {
        res.writeHead(503, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: false,
          log: 'Arduino toolchain is not installed on this computer yet — open MY STEAM LAB and compile something once first.'
        }));
        return;
      }

      readJsonBody(req)
        .then((body) => {
          const { code, fqbn } = body || {};
          if (typeof code !== 'string' || typeof fqbn !== 'string') {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, log: 'Missing code or fqbn.' }));
            return;
          }
          const logs: string[] = [];
          return enqueue(() => compileOne(code, fqbn, (msg) => logs.push(msg))).then((result) => {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(result));
          });
        })
        .catch((e: any) => {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, log: e.message || 'Unknown error' }));
        });
      return;
    }

    res.writeHead(404);
    res.end();
  });

  server.listen(PORT, '0.0.0.0');
  return { port: PORT, pin: currentPin, lanIp: getLanIp() };
}

export function stopLocalCompileServer(): void {
  if (server) {
    server.close();
    server = null;
    currentPin = '';
  }
}

export function getLocalCompileServerStatus(): { running: boolean; port: number; pin: string; lanIp: string | null } {
  return { running: !!server, port: PORT, pin: currentPin, lanIp: getLanIp() };
}

export function registerLocalCompileServerHandlers() {
  ipcMain.handle('mobileServer:start', () => startLocalCompileServer());
  ipcMain.handle('mobileServer:stop', () => stopLocalCompileServer());
  ipcMain.handle('mobileServer:status', () => getLocalCompileServerStatus());
}
