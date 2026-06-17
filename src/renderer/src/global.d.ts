import type { ElectronApi } from '../../../main/preload'

/**
 * Global type augmentation for window.api.
 * This file is referenced in tsconfig.json via the "include" array so
 * TypeScript automatically picks it up — no explicit import needed.
 */
declare global {
  interface Window {
    api: ElectronApi
  }
}

declare module '*?worker' {
  const workerConstructor: {
    new (): Worker
  }
  export default workerConstructor
}

declare module '*.jpeg' {
  const src: string
  export default src
}

