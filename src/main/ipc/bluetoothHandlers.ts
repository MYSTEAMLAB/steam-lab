import { ipcMain } from 'electron';
import { execFile } from 'child_process';
import fs from 'fs';
import { SerialPort } from 'serialport';
import { ReadlineParser } from '@serialport/parser-readline';

// ─────────────────────────────────────────────────────────────────────────────
// Bluetooth (Classic SPP) support
//
// An ESP32 running BluetoothSerial shows up on Windows, once paired, as a pair of
// virtual COM ports — so talking to it is ordinary serial I/O and the existing
// serial handlers already work. What Windows does NOT tell you from the COM port
// alone is *which* board it belongs to: every one of them is called "Standard
// Serial over Bluetooth link (COMn)". listDevices below resolves each of those
// ports back to the paired device's real name so the student can pick "MY_STEAM_LAB"
// instead of guessing between COM7 and COM12.
// ─────────────────────────────────────────────────────────────────────────────

export interface BluetoothPort {
  path: string
  /** Paired device name, e.g. "MY_STEAM_LAB" — falls back to the port label. */
  deviceName: string
  friendlyName: string
  /** Windows exposes both an outgoing and an incoming SPP port; only the outgoing one connects. */
  outgoing: boolean
}

// A bound (outgoing) SPP port carries the paired board's BD address bare in its
// instance path, just before the trailing underscore:
//   BTHENUM\{00001101-...}_LOCALMFG&0002\7&2EC60C50&0&68FE718711DE_C00000000
// Windows' own incoming-listener ports use an all-zero address instead, and never
// reach a board — those are the ones we mark unusable:
//   BTHENUM\{00001101-...}_LOCALMFG&0000\7&2EC60C50&0&000000000000_00000000
// The address then resolves to the paired device's real name via its BTHENUM\DEV_ entry.
const LIST_BT_PORTS_PS = `
$ErrorActionPreference = 'SilentlyContinue'
$all = Get-CimInstance Win32_PnPEntity
$ports = $all | Where-Object { $_.PNPClass -eq 'Ports' -and $_.PNPDeviceID -like 'BTHENUM*' }
$devs  = $all | Where-Object { $_.PNPDeviceID -like 'BTHENUM\\DEV_*' }
$out = @()
foreach ($p in $ports) {
  $addr = ''
  if ($p.PNPDeviceID -match '&([0-9A-Fa-f]{12})_') { $addr = $Matches[1] }
  $name = ''
  if ($addr -and $addr -ne '000000000000') {
    $d = $devs | Where-Object { $_.PNPDeviceID -like "*DEV_$addr*" } | Select-Object -First 1
    if ($d) { $name = $d.Name }
  } else {
    $addr = ''
  }
  $out += [PSCustomObject]@{ Port = $p.Name; Device = $name; Address = $addr }
}
$out | ConvertTo-Json -Compress
`;

function listBluetoothPorts(): Promise<BluetoothPort[]> {
  return new Promise((resolve) => {
    if (process.platform !== 'win32') {
      resolve([]);
      return;
    }
    execFile(
      'powershell',
      ['-NoProfile', '-NonInteractive', '-Command', LIST_BT_PORTS_PS],
      { encoding: 'utf8', timeout: 20000 },
      (err, stdout) => {
        if (err || !stdout || !stdout.trim()) {
          resolve([]);
          return;
        }
        try {
          const parsed = JSON.parse(stdout.trim());
          const rows = Array.isArray(parsed) ? parsed : [parsed];
          const result: BluetoothPort[] = [];
          for (const row of rows) {
            const label: string = row?.Port || '';
            const match = label.match(/\((COM\d+)\)/i);
            if (!match) continue;
            const address: string = row?.Address || '';
            result.push({
              path: match[1].toUpperCase(),
              deviceName: row?.Device || label,
              friendlyName: label,
              outgoing: address.length === 12
            });
          }
          // Outgoing ports first — those are the ones that actually connect.
          result.sort((a, b) => Number(b.outgoing) - Number(a.outgoing));
          resolve(result);
        } catch {
          resolve([]);
        }
      }
    );
  });
}

/**
 * Streams a compiled .bin to a board running the StreamLab Bluetooth upload agent
 * (injected by any sketch that uses Bluetooth blocks — see ensureBluetoothOta in
 * the Arduino generator). The agent writes it to the spare OTA partition and
 * reboots into it.
 *
 * Frame: ESC "SLOTA" <byte count> '\n', then the raw image. The agent answers
 * SLOTA_READY, then SLOTA_OK or SLOTA_FAIL.
 */
export function uploadFirmwareOverBluetooth(
  binPath: string,
  comPort: string,
  onLog: (msg: string) => void
): Promise<{ success: boolean; error?: string }> {
  return new Promise((resolve) => {
    let image: Buffer;
    try {
      image = fs.readFileSync(binPath);
    } catch (e: any) {
      resolve({ success: false, error: `Could not read compiled binary: ${e.message}` });
      return;
    }

    // Baud rate is meaningless over an SPP link but the API requires one.
    const port = new SerialPort({ path: comPort, baudRate: 115200, autoOpen: false });
    const parser = port.pipe(new ReadlineParser({ delimiter: '\n' }));

    let settled = false;
    const lines: string[] = [];
    const waiters: Array<{ match: (l: string) => boolean; done: (l: string) => void }> = [];

    const finish = (success: boolean, error?: string) => {
      if (settled) return;
      settled = true;
      try {
        if (port.isOpen) port.close(() => {});
      } catch {}
      resolve({ success, error });
    };

    parser.on('data', (raw: string) => {
      const line = String(raw).trim();
      if (!line) return;
      lines.push(line);
      if (line.startsWith('SLOTA')) onLog(`[Bluetooth] Board: ${line}`);
      for (let i = waiters.length - 1; i >= 0; i--) {
        if (waiters[i].match(line)) {
          const w = waiters[i];
          waiters.splice(i, 1);
          w.done(line);
        }
      }
    });

    port.on('error', (err) => finish(false, err.message));

    const waitForLine = (match: (l: string) => boolean, timeoutMs: number, what: string) =>
      new Promise<string>((res, rej) => {
        const existing = lines.find(match);
        if (existing) { res(existing); return; }
        const timer = setTimeout(() => {
          const idx = waiters.findIndex(w => w.match === match);
          if (idx >= 0) waiters.splice(idx, 1);
          rej(new Error(`Timed out waiting for ${what}`));
        }, timeoutMs);
        waiters.push({
          match,
          done: (l) => { clearTimeout(timer); res(l); }
        });
      });

    const write = (chunk: Buffer | string) =>
      new Promise<void>((res, rej) => {
        port.write(chunk, (err) => (err ? rej(err) : res()));
      });

    const drain = () =>
      new Promise<void>((res, rej) => {
        port.drain((err) => (err ? rej(err) : res()));
      });

    port.open(async (err) => {
      if (err) {
        finish(false, `Could not open ${comPort}: ${err.message}. Is the board paired, powered on and in range?`);
        return;
      }

      try {
        onLog(`[Bluetooth] Connected on ${comPort}. Handing over ${image.length} bytes...`);

        // ESC-prefixed header: ordinary user messages never start with 0x1B, so the
        // agent can tell a firmware frame apart from normal Bluetooth traffic.
        await write(Buffer.concat([
          Buffer.from([0x1b]),
          Buffer.from(`SLOTA${image.length}\n`, 'ascii')
        ]));

        await waitForLine(
          l => l.startsWith('SLOTA_READY') || l.startsWith('SLOTA_FAIL'),
          20000,
          'the board to accept the update (is it running a sketch with a Bluetooth block, uploaded over USB first?)'
        ).then(l => {
          if (l.startsWith('SLOTA_FAIL')) throw new Error(`Board refused the update: ${l}`);
        });

        const CHUNK = 1024;
        let sent = 0;
        let lastPct = -5;
        while (sent < image.length) {
          const end = Math.min(sent + CHUNK, image.length);
          await write(image.subarray(sent, end));
          await drain();
          sent = end;
          const pct = Math.floor((sent / image.length) * 100);
          if (pct >= lastPct + 5) {
            lastPct = pct;
            onLog(`[Bluetooth] Sending firmware... ${pct}% (${sent}/${image.length} bytes)`);
          }
        }

        const verdict = await waitForLine(
          l => l.startsWith('SLOTA_OK') || l.startsWith('SLOTA_FAIL'),
          120000,
          'the board to finish writing the update'
        );

        if (verdict.startsWith('SLOTA_OK')) {
          onLog('[Bluetooth] Board wrote the update and is rebooting into it.');
          finish(true);
        } else {
          finish(false, `Board reported: ${verdict}`);
        }
      } catch (e: any) {
        finish(false, e.message);
      }
    });
  });
}

export function registerBluetoothHandlers() {
  ipcMain.handle('bluetooth:listDevices', async (event) => {
    const ports = await listBluetoothPorts();
    if (event?.sender) {
      if (ports.length === 0) {
        event.sender.send(
          'serial:data',
          '[System] No paired Bluetooth serial devices found. Pair the board in Windows Settings > Bluetooth first.'
        );
      } else {
        ports.forEach(p =>
          event.sender.send(
            'serial:data',
            `[System] Bluetooth: ${p.deviceName} on ${p.path}${p.outgoing ? '' : ' (incoming — not usable)'}`
          )
        );
      }
    }
    return ports;
  });
}
