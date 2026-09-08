import http from 'http';
import os from 'os';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { app, ipcMain } from 'electron';
import { CLI_PATH, getRequiredLibraries, withBluetoothPartition, ensureLibrariesInstalled, compileWithSelfHeal } from './ipc/compilerHandlers';

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

// Stable across requests (NOT one fresh random dir per compile) — arduino-cli
// reuses its build-path as an incremental cache (skips recompiling unchanged
// core/library object files) as long as the path stays the same, and the
// previous per-request-random-dir-then-delete-it-all approach silently threw
// that away, forcing a full from-scratch ESP32 core rebuild on *every single*
// compile. That was the real reason compiles were slow (and, combined with
// clients' fetch timeouts being shorter than a full rebuild, why they'd
// sometimes fail outright with a socket/timeout error mid-compile).
// Requests are already serialized via enqueue() below, so a shared path is
// safe — there's never two arduino-cli invocations touching it at once.
// Same reasoning as compilerHandlers.ts's TEMP_DIR: userData persists across
// sessions, the OS temp folder does not — a wiped cache silently turns every
// "first compile since restart" into a multi-minute full core rebuild.
const LAN_BUILD_ROOT = path.join(app.getPath('userData'), 'lan_build');
const LAN_SKETCH_DIR = path.join(LAN_BUILD_ROOT, 'sketch');
const LAN_BUILD_DIR = path.join(LAN_BUILD_ROOT, 'build');

function compileOne(
  code: string,
  rawFqbn: string,
  onLog: (msg: string) => void
): Promise<{ success: boolean; log: string; binBase64?: string }> {
  const fqbn = withBluetoothPartition(rawFqbn, code);
  return new Promise((resolve) => {
    try {
      fs.mkdirSync(LAN_SKETCH_DIR, { recursive: true });
      fs.mkdirSync(LAN_BUILD_DIR, { recursive: true });
      // Force a fresh link against the new code, while leaving cached core/
      // library .o files in place for arduino-cli to reuse.
      fs.rmSync(path.join(LAN_BUILD_DIR, 'sketch.ino.bin'), { force: true });
      fs.rmSync(path.join(LAN_BUILD_DIR, 'sketch.ino.elf'), { force: true });
      fs.writeFileSync(path.join(LAN_SKETCH_DIR, 'sketch.ino'), code);
    } catch (e: any) {
      resolve({ success: false, log: e.message });
      return;
    }

    onLog(`[Compiler] Compiling for ${fqbn}...`);

    ensureLibrariesInstalled(getRequiredLibraries(code), onLog, async () => {
      const result = await compileWithSelfHeal(
        ['compile', '-b', fqbn, '-j', '0', '--build-path', LAN_BUILD_DIR, LAN_SKETCH_DIR],
        LAN_BUILD_DIR,
        onLog
      );
      if (!result.success) {
        onLog('==== COMPILATION FAILED ====');
        resolve(result);
        return;
      }
      try {
        const bin = fs.readFileSync(path.join(LAN_BUILD_DIR, 'sketch.ino.bin'));
        onLog('==== COMPILATION SUCCESS ====');
        resolve({ success: true, log: result.log, binBase64: bin.toString('base64') });
      } catch (e: any) {
        resolve({ success: false, log: `${result.log}\n${e.message}` });
      }
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

  // Node's http.Server enforces a 5-minute requestTimeout and a 60s
  // headersTimeout by default (Node 14+) — fine for typical APIs, but an
  // ESP32 compile (especially a first-time library install, or just this
  // machine under load) can legitimately run past either, and Node kills
  // the connection outright when they fire: the client sees a bare "socket
  // closed"/"headers timeout" with no response at all, indistinguishable
  // from a real crash. This is a local, PIN-gated dev server (never
  // internet-facing), so there's no slow-loris concern in disabling them.
  server.requestTimeout = 0;
  server.headersTimeout = 0;
  server.timeout = 0;

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
