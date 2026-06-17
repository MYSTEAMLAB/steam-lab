import { ipcMain } from 'electron';
import { SerialPort } from 'serialport';
import { ReadlineParser } from '@serialport/parser-readline';

let currentPort: SerialPort | null = null;

export function registerSerialHandlers() {
  ipcMain.handle('serial:getPorts', async (event) => {
    try {
      if (event && event.sender) {
        event.sender.send('serial:data', '[System] Rescanning COM ports...');
      }
      const ports = await SerialPort.list();
      
      // Fallback for Windows COM ports that serialport might miss
      if (process.platform === 'win32') {
        try {
          const { execSync } = require('child_process');
          const ps = execSync('powershell -Command "[System.IO.Ports.SerialPort]::GetPortNames()"', { encoding: 'utf8' });
          const psPorts = ps.trim().split(/\\s+/).filter((p: string) => p.startsWith('COM'));
          for (const p of psPorts) {
            if (!ports.find(x => x.path === p)) {
              ports.push({ path: p, manufacturer: 'Unknown', friendlyName: p } as any);
            }
          }
        } catch (e) {}
      }

      const formattedPorts = ports.map(p => {
        const anyP = p as any;
        let finalFriendlyName = anyP.friendlyName;
        if (!finalFriendlyName) {
          finalFriendlyName = p.manufacturer ? `${p.path} - ${p.manufacturer}` : p.path;
        }
        return {
          path: p.path,
          manufacturer: p.manufacturer,
          friendlyName: finalFriendlyName
        };
      });

      if (event && event.sender) {
        if (formattedPorts.length === 0) {
          event.sender.send('serial:data', '[System] No COM ports detected by serialport or WMI fallback. Ensure device is plugged in or drivers are installed.');
        } else {
          formattedPorts.forEach(p => {
            event.sender.send('serial:data', `[System] Found: ${p.path} (${p.friendlyName})`);
          });
        }
      }

      return formattedPorts;
    } catch (e: any) {
      console.error('[Serial] Failed to list ports:', e);
      if (event && event.sender) {
        event.sender.send('serial:error', `[System] Error listing COM ports: ${e.message}`);
      }
      return [];
    }
  });

  ipcMain.handle('serial:open', async (event, path: string, baudRate: number) => {
    return new Promise<{success: boolean, error?: string}>((resolve) => {
      try {
        if (currentPort) {
          if (currentPort.isOpen) currentPort.close();
          currentPort = null;
        }

        currentPort = new SerialPort({ path, baudRate, autoOpen: false });
        currentPort.open((err) => {
          if (err) {
            resolve({ success: false, error: err.message });
          } else {
            // For ESP32: pulse DTR/RTS to explicitly reboot the board (Arduino IDE behavior).
            // This ensures we catch early setup() logs and don't hold the board in reset.
            currentPort?.set({ dtr: false, rts: true }, () => {
              setTimeout(() => {
                currentPort?.set({ dtr: false, rts: false }, (errSet) => {
                  if (errSet) console.warn('Failed to set DTR/RTS:', errSet);
                  resolve({ success: true });
                });
              }, 50);
            });
          }
        });

        const parser = currentPort.pipe(new ReadlineParser({ delimiter: '\n' }));
        parser.on('data', (data) => {
          event.sender.send('serial:data', data);
        });

        currentPort.on('error', (err) => {
          event.sender.send('serial:error', err.message);
        });

        currentPort.on('close', () => {
          event.sender.send('serial:closed');
        });

      } catch (e: any) {
        resolve({ success: false, error: e.message });
      }
    });
  });

  ipcMain.handle('serial:close', async () => {
    return new Promise<boolean>((resolve) => {
      if (currentPort && currentPort.isOpen) {
        currentPort.close((err) => {
          currentPort = null;
          resolve(!err);
        });
      } else {
        currentPort = null;
        resolve(true);
      }
    });
  });

  ipcMain.handle('serial:write', async (event, data: string) => {
    return new Promise<boolean>((resolve) => {
      if (currentPort && currentPort.isOpen) {
        currentPort.write(data, (err) => {
          resolve(!err);
        });
      } else {
        resolve(false);
      }
    });
  });
}
