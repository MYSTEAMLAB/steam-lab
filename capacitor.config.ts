import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.mysteamlab.app',
  appName: 'MY STEAM LAB',
  webDir: 'out/renderer',
  android: {
    allowMixedContent: true // needed to reach the desktop's local compile server over plain http:// on the LAN
  }
}

export default config
