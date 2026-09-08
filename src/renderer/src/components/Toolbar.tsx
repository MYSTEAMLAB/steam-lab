import React, { useEffect, useState } from 'react'
import { Play, UploadCloud, Usb, Wifi, Bluetooth, Loader2, AlertCircle, RefreshCw, Terminal, Settings2 } from 'lucide-react'
import { useAppStore } from '../store/useAppStore'
import { useT } from '@renderer/lib/i18n/useT'
import { isMobilePlatform } from '@renderer/lib/mobile/mobileBridge'

export const Toolbar: React.FC = () => {
  const t = useT()
  const { generatedCode, selectedBoard } = useAppStore()
  const setActiveRightTab = useAppStore(s => s.setActiveRightTab)
  const setStoreIsSerialConnected = useAppStore(s => s.setIsSerialConnected)
  const [ports, setPorts] = useState<any[]>([])
  const [selectedPort, setSelectedPort] = useState<string>('')
  const [uploadMode, setUploadMode] = useState<'usb' | 'wifi' | 'bluetooth'>('usb')
  const [btDevices, setBtDevices] = useState<any[]>([])
  const [selectedBtPort, setSelectedBtPort] = useState<string>('')
  const [otaIp, setOtaIp] = useState('')
  const [otaPassword, setOtaPassword] = useState('')
  const [isCompiling, setIsCompiling] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [isCompiledSuccessfully, setIsCompiledSuccessfully] = useState(false)
  const [statusText, setStatusText] = useState('Ready')
  const [isSerialConnected, setIsSerialConnectedState] = useState(false)
  const setIsSerialConnected = (connected: boolean) => {
    setIsSerialConnectedState(connected)
    setStoreIsSerialConnected(connected)
  }

  // Reset compile state if the generated code changes
  useEffect(() => {
    setIsCompiledSuccessfully(false)
    if (statusText === 'Compilation Successful!' || statusText.includes('Upload')) {
      setStatusText('Code changed. Verify required.')
    }
  }, [generatedCode])

  const fetchPorts = async (manual = false) => {
    try {
      if (manual) {
        setActiveRightTab('monitor')
      }
      if ((window as any).api?.serial) {
        const p = await (window as any).api.serial.getPorts()
        setPorts(p)
        if (p.length > 0) {
          // Check if current selected port still exists
          const currentPortExists = p.some((port: any) => port.path === selectedPort)
          if (!selectedPort || !currentPortExists) {
            setSelectedPort(p[0].path)
          }
        } else {
          setSelectedPort('')
        }
      }
    } catch (e) {
      console.error('Failed to fetch ports', e)
    }
  }

  // Paired Bluetooth (SPP) boards. Windows exposes these as ordinary COM ports, so
  // once one is picked every existing serial feature — the monitor, the send box,
  // Verify's logs — works over Bluetooth unchanged.
  const fetchBtDevices = async (manual = false) => {
    try {
      if (manual) setActiveRightTab('monitor')
      if (!(window as any).api?.bluetooth) return
      const devices = await (window as any).api.bluetooth.listDevices()
      setBtDevices(devices)
      const usable = devices.filter((d: any) => d.outgoing)
      const stillThere = devices.some((d: any) => d.path === selectedBtPort)
      if (!stillThere) setSelectedBtPort(usable.length > 0 ? usable[0].path : '')
    } catch (e) {
      console.error('Failed to fetch Bluetooth devices', e)
    }
  }

  useEffect(() => {
    fetchPorts()
  }, [])

  useEffect(() => {
    if (uploadMode === 'bluetooth' && btDevices.length === 0) fetchBtDevices()
  }, [uploadMode])

  // The port the monitor talks to: the Bluetooth link when that mode is picked,
  // the USB cable otherwise (WiFi uploads still use USB for the monitor).
  const isBluetoothMode = uploadMode === 'bluetooth'
  const activePort = isBluetoothMode ? selectedBtPort : selectedPort

  const handleConnectToggle = async () => {
    if (!activePort) return
    try {
      if (isSerialConnected) {
        await (window as any).api.serial.close()
        setIsSerialConnected(false)
        setStatusText(isBluetoothMode ? 'Bluetooth Disconnected' : 'Serial Disconnected')
      } else {
        const result = await (window as any).api.serial.open(
          activePort,
          115200,
          { skipReset: isBluetoothMode }
        )
        if (result.success) {
          setIsSerialConnected(true)
          setStatusText(isBluetoothMode ? 'Bluetooth Connected' : 'Serial Connected')
          setActiveRightTab('monitor')
        } else {
          setStatusText(isBluetoothMode ? 'Bluetooth Connect Failed' : 'Serial Connect Failed')
        }
      }
    } catch (e) {
      console.error(e)
    }
  }

  // ── Listen to Main Menu Device Actions ──────────────────────────────────
  useEffect(() => {
    if (!(window as any).api?.onMenuAction) return

    const cleanup = (window as any).api.onMenuAction(async (action: string) => {
      if (action === 'device-connect') {
        if (!isSerialConnected && activePort) {
          await handleConnectToggle()
        } else if (!activePort) {
          setStatusText(isBluetoothMode ? 'Select a Bluetooth device first!' : 'Select a COM port first!')
        }
      } else if (action === 'device-disconnect') {
        if (isSerialConnected) {
          await handleConnectToggle()
        }
      } else if (action === 'device-scan') {
        if (isBluetoothMode) fetchBtDevices(true)
        else fetchPorts(true)
      }
    })

    return () => cleanup()
  }, [isSerialConnected, activePort, isBluetoothMode])


  const handleCompile = async () => {
    if (!selectedBoard || !generatedCode) return
    setIsCompiling(true)
    setIsCompiledSuccessfully(false)
    setStatusText('Compiling...')
    try {
      const result = await (window as any).api.compiler.compile(generatedCode, selectedBoard.fqbn)
      if (result.success) {
        setIsCompiledSuccessfully(true)
        setStatusText('Compilation Successful!')
      } else {
        setStatusText('Compilation Failed (See Monitor)')
        setActiveRightTab('monitor')
      }
    } catch (e) {
      setStatusText('Compiler Error')
      setActiveRightTab('monitor')
    } finally {
      setIsCompiling(false)
    }
  }

  const handleUpload = async () => {
    if (!selectedBoard || !generatedCode) return
    if (uploadMode === 'usb' && !selectedPort) {
      setStatusText('Select a COM port first!')
      return
    }
    if (uploadMode === 'wifi' && !otaIp.trim()) {
      setStatusText("Enter the board's IP address first!")
      return
    }
    if (uploadMode === 'bluetooth' && !selectedBtPort) {
      setStatusText('Select a paired Bluetooth device first!')
      return
    }
    if (uploadMode === 'bluetooth' && !generatedCode.includes('BluetoothSerial.h')) {
      // Without a Bluetooth block there is no upload agent in the sketch to receive
      // the image — and no way to add one wirelessly.
      setStatusText('Add a Bluetooth block, then upload once over USB.')
      setActiveRightTab('monitor')
      return
    }

    setIsUploading(true)
    setIsSerialConnected(false)

    try {
      if (uploadMode === 'usb') {
        setStatusText(`Uploading to ${selectedPort}...`)
        // Release COM port lock before upload
        await (window as any).api.serial.close()

        // Wait for Windows COM subsystem to fully release the hardware lock
        await new Promise(resolve => setTimeout(resolve, 1000))

        // Re-compile and upload
        const result = await (window as any).api.compiler.upload(generatedCode, selectedBoard.fqbn, selectedPort)
        if (result.success) {
          setStatusText('Upload Successful!')
          // Auto-reconnect serial monitor after upload to view runtime logs
          try {
            // Give ESP32 time to complete its hard reset via DTR/RTS
            await new Promise(resolve => setTimeout(resolve, 1500))

            let openResult = await (window as any).api.serial.open(selectedPort, 115200)
            let retries = 0
            while (!openResult.success && retries < 3) {
              await new Promise(resolve => setTimeout(resolve, 1000))
              openResult = await (window as any).api.serial.open(selectedPort, 115200)
              retries++
            }

            if (openResult.success) {
              setStatusText('Upload OK, Serial Connected')
              setIsSerialConnected(true)
            } else {
              console.error('Failed to auto-reconnect serial:', openResult.error)
              setStatusText('Upload OK, Serial Failed')
            }
          } catch (err) {
            console.warn('Failed to auto-reconnect serial after upload:', err)
          }
        } else {
          setStatusText('Upload Failed (See Monitor)')
        }
      } else if (uploadMode === 'bluetooth') {
        // Bluetooth upload — the sketch already on the board receives the new image
        // itself and writes it to its spare OTA partition, so the board must already
        // be running Bluetooth code from a prior USB upload.
        setStatusText(`Uploading over Bluetooth (${selectedBtPort})...`)
        setActiveRightTab('monitor')

        // The monitor holds the same COM port the upload needs.
        await (window as any).api.serial.close()
        await new Promise(resolve => setTimeout(resolve, 800))

        const result = await (window as any).api.compiler.upload(
          generatedCode,
          selectedBoard.fqbn,
          '',
          undefined,
          { port: selectedBtPort }
        )

        if (result.success) {
          setStatusText('Bluetooth Upload Successful!')
          // The board reboots into the new sketch, which drops and re-advertises the
          // link, so give Windows a moment before re-attaching the monitor.
          try {
            await new Promise(resolve => setTimeout(resolve, 4000))
            let openResult = await (window as any).api.serial.open(selectedBtPort, 115200, { skipReset: true })
            let retries = 0
            while (!openResult.success && retries < 3) {
              await new Promise(resolve => setTimeout(resolve, 2000))
              openResult = await (window as any).api.serial.open(selectedBtPort, 115200, { skipReset: true })
              retries++
            }
            if (openResult.success) {
              setStatusText('Upload OK, Bluetooth Connected')
              setIsSerialConnected(true)
            } else {
              setStatusText('Upload OK — reconnect Bluetooth manually')
            }
          } catch (err) {
            console.warn('Failed to re-attach Bluetooth monitor after upload:', err)
          }
        } else {
          setStatusText('Bluetooth Upload Failed (See Monitor)')
        }
      } else {
        // Wireless (OTA) upload — the board must already be running
        // OTA-enabled code (from a prior USB upload with a WiFi Connect
        // block) and be on the same network as this PC.
        setStatusText(`Uploading wirelessly to ${otaIp.trim()}...`)
        const result = await (window as any).api.compiler.upload(
          generatedCode,
          selectedBoard.fqbn,
          '',
          { ip: otaIp.trim(), password: otaPassword.trim() || undefined }
        )
        setStatusText(result.success ? 'Wireless Upload Successful!' : 'Upload Failed (See Monitor)')
      }
    } catch (e) {
      setStatusText('Upload Error')
    } finally {
      setIsUploading(false)
    }
  }

  const isBusy = isCompiling || isUploading

  return (
    <div className="h-[72px] bg-gradient-to-b from-white to-surface-50 border-b border-panel-border flex items-center justify-between px-5 shrink-0 shadow-soft z-10 relative">
      {/* Travelling stripe along the top edge while the toolchain is working —
          long compiles otherwise look like the app has frozen. */}
      {isBusy && <div className="absolute top-0 left-0 right-0 h-[3px] msl-busy-bar" />}

      <div className="flex items-center gap-3">
        {/* Compiler Button */}
        <button
          onClick={handleCompile}
          disabled={isCompiling || isUploading || !selectedBoard}
          title="Check your blocks compile without uploading"
          className="msl-btn msl-btn-primary"
        >
          {isCompiling
            ? <Loader2 size={18} className="animate-spin" />
            : <Play size={18} fill="currentColor" />}
          {t('verify')}
        </button>

        {/* Upload Button */}
        <button
          onClick={handleUpload}
          disabled={
            isCompiling || isUploading || !selectedBoard || !isCompiledSuccessfully ||
            (uploadMode === 'usb' ? !selectedPort : !otaIp.trim())
          }
          title={
            uploadMode === 'usb'
              ? (!selectedPort ? 'No serial port selected' : !isCompiledSuccessfully ? 'Compilation required before upload' : 'Upload to board')
              : (!otaIp.trim() ? "Enter the board's IP address" : !isCompiledSuccessfully ? 'Compilation required before upload' : 'Upload wirelessly to board')
          }
          className="msl-btn msl-btn-success"
        >
          {isUploading ? <Loader2 size={16} className="animate-spin" /> : <UploadCloud size={16} />}
          {t('upload')}
        </button>

        {/* Upload Mode Toggle: USB vs WiFi (OTA) vs Bluetooth */}
        <div className="msl-segment shrink-0">
          <button
            onClick={() => setUploadMode('usb')}
            title="Upload over a USB cable"
            className={`msl-segment-item ${uploadMode === 'usb' ? 'msl-segment-item-active' : ''}`}
          >
            <Usb size={13} /> {t('usb')}
          </button>
          <button
            onClick={() => setUploadMode('wifi')}
            title="Upload over WiFi (OTA) — board must already be running WiFi-enabled code from a prior USB upload"
            className={`msl-segment-item ${uploadMode === 'wifi' ? 'msl-segment-item-active' : ''}`}
          >
            <Wifi size={13} /> {t('wifi')}
          </button>
          <button
            onClick={() => setUploadMode('bluetooth')}
            title="Connect and upload over Bluetooth — board must already be running a Bluetooth sketch from a prior USB upload"
            className={`msl-segment-item ${uploadMode === 'bluetooth' ? 'msl-segment-item-active' : ''}`}
          >
            <Bluetooth size={13} /> {t('bluetooth')}
          </button>
        </div>

        {uploadMode === 'usb' ? (
          /* COM Port Selector */
          <div className="msl-field">
            <Usb size={16} className="text-primary-500" />
            <select
              value={selectedPort}
              onChange={e => setSelectedPort(e.target.value)}
              disabled={ports.length === 0}
              className="bg-transparent border-none text-sm font-medium text-slate-200 focus:ring-0 outline-none w-48 cursor-pointer disabled:opacity-50"
            >
              {ports.length === 0 ? (
                <option value="" disabled>{t('noDeviceFound')}</option>
              ) : (
                <option value="" disabled>{t('selectPort')}</option>
              )}
              {ports.map(p => (
                <option key={p.path} value={p.path} className="bg-surface-200">
                  {p.friendlyName ? p.friendlyName : p.path}
                </option>
              ))}
            </select>
            <button onClick={() => fetchPorts(true)} className="p-1 rounded-md text-slate-400 hover:text-primary-600 hover:bg-primary-50 transition-colors active:scale-90">
              <RefreshCw size={14} />
            </button>
          </div>
        ) : uploadMode === 'bluetooth' ? (
          /* Paired Bluetooth device picker. Windows names every one of these ports
             "Standard Serial over Bluetooth link", so we show the paired board's own
             name instead and hide the incoming-only ports, which never connect.
             When nothing's paired yet, show what to actually do about it instead of
             just a disabled dropdown — boards now advertise as "MSL_<code>" by
             default (see arduinoGenerator.ts), so naming that convention here is
             the difference between a dead end and an actionable next step. */
          btDevices.filter(d => d.outgoing).length === 0 ? (
            <div className="msl-field !h-auto !items-start flex-col gap-1.5 !py-2 max-w-xs">
              <div className="flex items-center gap-2 w-full">
                <Bluetooth size={16} className="text-primary-500 shrink-0" />
                <span className="text-sm font-medium text-slate-200">{t('noPairedDevice')}</span>
                <button
                  onClick={() => fetchBtDevices(true)}
                  title="Rescan paired Bluetooth devices"
                  className="ml-auto p-1 rounded-md text-slate-400 hover:text-primary-600 hover:bg-primary-50 transition-colors active:scale-90"
                >
                  <RefreshCw size={14} />
                </button>
              </div>
              <p className="text-xs text-slate-400 leading-snug">{t('pairedDeviceHint')}</p>
              {!isMobilePlatform() && (
                <button
                  onClick={() => (window as any).api?.system?.openBluetoothSettings?.()}
                  className="flex items-center gap-1.5 text-xs font-semibold text-primary-500 hover:text-primary-400 transition-colors mt-0.5"
                >
                  <Settings2 size={13} />
                  {t('openBluetoothSettings')}
                </button>
              )}
            </div>
          ) : (
            <div className="msl-field">
              <Bluetooth size={16} className="text-primary-500" />
              <select
                value={selectedBtPort}
                onChange={e => setSelectedBtPort(e.target.value)}
                className="bg-transparent border-none text-sm font-medium text-slate-200 focus:ring-0 outline-none w-48 cursor-pointer"
              >
                <option value="" disabled>{t('selectDevice')}</option>
                {btDevices.filter(d => d.outgoing).map(d => (
                  <option key={d.path} value={d.path} className="bg-surface-200">
                    {d.deviceName} ({d.path})
                  </option>
                ))}
              </select>
              <button
                onClick={() => fetchBtDevices(true)}
                title="Rescan paired Bluetooth devices"
                className="p-1 rounded-md text-slate-400 hover:text-primary-600 hover:bg-primary-50 transition-colors active:scale-90"
              >
                <RefreshCw size={14} />
              </button>
            </div>
          )
        ) : (
          /* OTA IP / Password inputs — IP is printed to Serial by the WiFi
             Connect block's generated code the first time it's flashed over USB. */
          <div className="msl-field">
            <Wifi size={16} className="text-primary-500 shrink-0" />
            <input
              type="text"
              value={otaIp}
              onChange={e => setOtaIp(e.target.value)}
              placeholder="Board IP e.g. 192.168.1.42"
              className="bg-transparent border-none text-sm font-medium text-slate-200 focus:ring-0 outline-none w-40 placeholder:text-slate-500"
            />
            <input
              type="password"
              value={otaPassword}
              onChange={e => setOtaPassword(e.target.value)}
              placeholder="Password (optional)"
              className="bg-transparent border-none border-l border-panel-border pl-2 text-sm font-medium text-slate-200 focus:ring-0 outline-none w-32 placeholder:text-slate-500"
            />
          </div>
        )}

        {/* Connect Monitor Button */}
        <button
          onClick={handleConnectToggle}
          disabled={!activePort || isUploading || isCompiling}
          className={`msl-btn ${
            isSerialConnected
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
              : 'msl-btn-ghost'
          }`}
        >
          {isSerialConnected
            ? <span className="msl-dot msl-dot-live text-emerald-500" />
            : <Terminal size={16} className="text-slate-400" />}
          {isSerialConnected ? t('disconnect') : t('connect')}
        </button>
      </div>

      {/* Status readout — colour tells the story before the words are read. */}
      <div className="flex items-center gap-2">
        {(() => {
          const failed = /fail|error/i.test(statusText)
          const done = /success|ok|connected/i.test(statusText)
          const tone = failed
            ? 'bg-red-50 text-red-700 ring-red-200'
            : done
              ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
              : isBusy
                ? 'bg-primary-50 text-primary-700 ring-primary-200'
                : 'bg-surface-100 text-slate-400 ring-panel-border'
          return (
            <span key={statusText} className={`msl-pill ring-1 font-mono animate-fade-in-up ${tone}`}>
              {isBusy && <Loader2 size={12} className="animate-spin" />}
              {failed && <AlertCircle size={12} />}
              {statusText}
            </span>
          )
        })()}
      </div>
    </div>
  )
}
