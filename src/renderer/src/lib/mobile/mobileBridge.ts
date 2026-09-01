import { Capacitor } from '@capacitor/core'
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem'
import { Preferences } from '@capacitor/preferences'
import { boardRegistry } from '@shared/boards'

// ── Mobile bridge ────────────────────────────────────────────────────────────
// Implements the exact same shape as window.api (see src/main/preload.ts's
// ElectronApi) so the whole existing renderer — Toolbar, ToolchainInstaller,
// SerialMonitor, useProjectManager, etc. — runs completely unmodified inside
// the Capacitor WebView. Only installed when there is no real Electron
// preload already present (see index.tsx's bootstrap check).
//
// Compilation goes over HTTP to a paired desktop running the local compile
// server (see src/main/localCompileServer.ts) — there is no on-device
// compilation on Android (confirmed infeasible: the ESP32 GCC toolchain is
// glibc-linked, Android's Bionic libc can't run it). Upload (WiFi/Bluetooth
// from the phone straight to a board) isn't implemented yet — a later phase.

const PROJECTS_DIR = 'MySteamLabProjects'
const AUTOSAVE_FILE = `${PROJECTS_DIR}/.autosave.msl`
const PAIR_PREFS_KEY = 'mobileCompileServer'

interface PairInfo {
  host: string // e.g. "192.168.1.6"
  port: number
  pin: string
}

async function ensureProjectsDir() {
  try {
    await Filesystem.mkdir({ path: PROJECTS_DIR, directory: Directory.Documents, recursive: true })
  } catch {
    // already exists — fine
  }
}

export async function getPairedServer(): Promise<PairInfo | null> {
  const { value } = await Preferences.get({ key: PAIR_PREFS_KEY })
  if (!value) return null
  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}

export async function setPairedServer(info: PairInfo): Promise<void> {
  await Preferences.set({ key: PAIR_PREFS_KEY, value: JSON.stringify(info) })
}

async function pairedServerUrl(path: string): Promise<{ url: string; pin: string } | null> {
  const pair = await getPairedServer()
  if (!pair) return null
  return { url: `http://${pair.host}:${pair.port}${path}`, pin: pair.pin }
}

// ── Menu-action pub/sub ──────────────────────────────────────────────────────
// useProjectManager.ts subscribes via window.api.onMenuAction the exact same
// way whether the action came from Electron's native menu or (on mobile) the
// MobileToolbar component calling dispatchMobileAction() with the identical
// action strings ('new-project', 'save-project', 'open-example|<id>', ...).
type MenuActionListener = (action: string) => void
const menuActionListeners = new Set<MenuActionListener>()

export function dispatchMobileAction(action: string) {
  menuActionListeners.forEach((l) => l(action))
}

function readProjectFile(name: string): Promise<{ path: string; data: any } | null> {
  return Filesystem.readFile({ path: `${PROJECTS_DIR}/${name}`, directory: Directory.Documents, encoding: Encoding.UTF8 })
    .then((res) => ({ path: name, data: JSON.parse(res.data as string) }))
    .catch(() => null)
}

async function writeProjectFile(name: string, data: any): Promise<{ success: boolean; path: string; error?: string }> {
  try {
    await ensureProjectsDir()
    await Filesystem.writeFile({
      path: `${PROJECTS_DIR}/${name}`,
      directory: Directory.Documents,
      data: JSON.stringify(data),
      encoding: Encoding.UTF8
    })
    return { success: true, path: name }
  } catch (e: any) {
    return { success: false, path: name, error: e.message || String(e) }
  }
}

function sanitizeFileName(name: string): string {
  return (name || 'project').replace(/[\\/:*?"<>|]/g, '_').trim() || 'project'
}

export const mobileApi = {
  getBoards: async () =>
    boardRegistry.getAll().map((board: any) => ({
      id: board.id,
      name: board.name,
      fqbn: board.fqbn,
      capabilities: board.capabilities,
      description: board.description ?? ''
    })),

  getVersion: async () => '1.0.0-android',

  compiler: {
    // No on-device toolchain to check for — compilation always goes through
    // the paired desktop. Returning true skips ToolchainInstaller's download
    // prompt entirely on mobile.
    check: async () => true,
    install: async () => true,

    compile: async (code: string, fqbn: string): Promise<{ success: boolean; log: string; binBase64?: string }> => {
      const target = await pairedServerUrl('/compile')
      if (!target) {
        return { success: false, log: 'Not paired with a desktop compile server yet. Open Settings and pair with your computer first.' }
      }
      try {
        const res = await fetch(target.url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Pair-Pin': target.pin },
          body: JSON.stringify({ code, fqbn })
        })
        const json = await res.json()
        if (res.status === 401) {
          return { success: false, log: 'Pairing PIN was rejected — re-pair with your computer (the PIN changes each time the server is started).' }
        }
        return json
      } catch (e: any) {
        return { success: false, log: `Could not reach the paired computer: ${e.message || e}. Make sure it's on the same WiFi network and the compile server is running.` }
      }
    },

    // Uploading straight from the phone to a board (WiFi/Bluetooth) isn't
    // implemented yet — a later phase. Compiling still works fully.
    upload: async () => ({
      success: false,
      log: 'Uploading directly from the mobile app is not available yet. For now, compile here, then finish uploading from the MY STEAM LAB desktop app.'
    }),

    onLog: (_callback: (log: string) => void) => {
      // The mobile compile call is request/response (no live log stream) —
      // Toolbar.tsx already displays the final `log` string it gets back
      // from compile()/upload(), so this is a harmless no-op subscription.
      return () => {}
    }
  },

  bluetooth: {
    listDevices: async () => []
  },

  serial: {
    getPorts: async () => [],
    open: async () => ({ success: false, error: 'USB serial is not available on mobile.' }),
    close: async () => {},
    write: async () => {},
    onData: () => () => {},
    onError: () => () => {},
    onClosed: () => () => {}
  },

  system: {
    // No Windows Settings equivalent to deep-link to on Android, and
    // Bluetooth pairing from the mobile app isn't implemented yet anyway —
    // Toolbar.tsx only shows the button this backs when window.api.system
    // is meaningfully wired up, so this just needs to not throw.
    openBluetoothSettings: async () => {}
  },

  mobileServer: {
    start: async () => ({ port: 0, pin: '', lanIp: null }),
    stop: async () => {},
    status: async () => ({ running: false, port: 0, pin: '', lanIp: null })
  },

  project: {
    open: async (fileName?: string) => {
      if (fileName) return readProjectFile(fileName)
      // No native OS file picker wired up yet — MobileToolbar's Open button
      // lists files itself and calls this with a chosen name instead.
      return null
    },

    save: async (fileName: string, data: any) => writeProjectFile(fileName, data),

    saveAs: async (data: any) => {
      const name = `${sanitizeFileName(data?.projectName)}.msl`
      const result = await writeProjectFile(name, data)
      return result
    },

    exportIno: async (code: string, defaultName: string) => {
      try {
        await ensureProjectsDir()
        const name = sanitizeFileName(defaultName)
        await Filesystem.writeFile({
          path: `${PROJECTS_DIR}/${name}`,
          directory: Directory.Documents,
          data: code,
          encoding: Encoding.UTF8
        })
        return { success: true, path: name }
      } catch (e: any) {
        return { success: false, error: e.message || String(e) }
      }
    },

    getRecents: async () => {
      try {
        await ensureProjectsDir()
        const res = await Filesystem.readdir({ path: PROJECTS_DIR, directory: Directory.Documents })
        return res.files.filter((f) => f.name.endsWith('.msl') && !f.name.startsWith('.')).map((f) => f.name)
      } catch {
        return []
      }
    },

    autoSave: async (data: any) => {
      try {
        await ensureProjectsDir()
        await Filesystem.writeFile({
          path: AUTOSAVE_FILE,
          directory: Directory.Documents,
          data: JSON.stringify(data),
          encoding: Encoding.UTF8
        })
      } catch {
        // best-effort
      }
    },

    checkRecovery: async () => {
      try {
        const res = await Filesystem.readFile({ path: AUTOSAVE_FILE, directory: Directory.Documents, encoding: Encoding.UTF8 })
        return JSON.parse(res.data as string)
      } catch {
        return null
      }
    },

    clearRecovery: async () => {
      try {
        await Filesystem.deleteFile({ path: AUTOSAVE_FILE, directory: Directory.Documents })
      } catch {
        // nothing to clear
      }
    }
  },

  onMenuAction: (callback: (action: string) => void) => {
    menuActionListeners.add(callback)
    return () => { menuActionListeners.delete(callback) }
  }
}

export function isMobilePlatform(): boolean {
  return Capacitor.isNativePlatform()
}

/** Installs the mobile bridge as window.api, unless a real Electron preload already did. */
export function installMobileBridgeIfNeeded() {
  if (typeof (window as any).api === 'undefined') {
    ;(window as any).api = mobileApi
  }
}
