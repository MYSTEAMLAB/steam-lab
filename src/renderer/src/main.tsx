import React from 'react'
import ReactDOM from 'react-dom/client'
import { App } from './App'
import './index.css'
import { installMobileBridgeIfNeeded } from './lib/mobile/mobileBridge'

// No-op inside Electron (window.api is already provided by the preload
// script by the time this runs); installs the HTTP/Filesystem-backed
// equivalent when running in the Capacitor Android shell instead.
installMobileBridgeIfNeeded()

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
