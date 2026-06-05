import { ipcMain } from 'electron';
import { SerialPort } from 'serialport';
import { ReadlineParser } from '@serialport/parser-readline';

let currentPort: SerialPort | null = null;

export function registerSerialHandlers() {
  ipcMain.handle('serial:getPorts', async () => {
    try {
      const ports = await SerialPort.list();
      return ports.map(p => ({
        path: p.path,
        manufacturer: p.manufacturer,
        friendlyName: (p as any).friendlyName || p.path
      }));
    } catch (e: any) {
      console.error('[Serial] Failed to list ports:', e);
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

        currentPort = new SerialPort({ path, baudRate }, (err) => {
          if (err) {
            resolve({ success: false, error: err.message });
          } else {
            resolve({ success: true });
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
