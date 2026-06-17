import React, { useEffect, useState } from 'react'
import { Play, UploadCloud, Usb, Loader2, AlertCircle, RefreshCw, Terminal } from 'lucide-react'
import { useAppStore } from '../store/useAppStore'

export const Toolbar: React.FC = () => {
  const { generatedCode, selectedBoard } = useAppStore()
  const setActiveRightTab = useAppStore(s => s.setActiveRightTab)
  const [ports, setPorts] = useState<any[]>([])
  const [selectedPort, setSelectedPort] = useState<string>('')
  const [isCompiling, setIsCompiling] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [isCompiledSuccessfully, setIsCompiledSuccessfully] = useState(false)
  const [statusText, setStatusText] = useState('Ready')
  const [isSerialConnected, setIsSerialConnected] = useState(false)

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

  useEffect(() => {
    fetchPorts()
  }, [])

  const handleConnectToggle = async () => {
    if (!selectedPort) return
    try {
      if (isSerialConnected) {
        await (window as any).api.serial.close()
        setIsSerialConnected(false)
        setStatusText('Serial Disconnected')
      } else {
        const result = await (window as any).api.serial.open(selectedPort, 115200)
        if (result.success) {
          setIsSerialConnected(true)
          setStatusText('Serial Connected')
          setActiveRightTab('monitor')
        } else {
          setStatusText('Serial Connect Failed')
        }
      }
    } catch (e) {
      console.error(e)
    }
  }

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
    if (!selectedBoard || !generatedCode || !selectedPort) {
      setStatusText('Select a COM port first!')
      return
    }
    setIsUploading(true)
    setStatusText(`Uploading to ${selectedPort}...`)
    setIsSerialConnected(false)
    try {
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
    } catch (e) {
      setStatusText('Upload Error')
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <div className="h-12 bg-surface-100 border-b border-panel-border flex items-center justify-between px-4 shrink-0 shadow-sm z-10 relative">
      <div className="flex items-center gap-3">
        {/* Compiler Button */}
        <button
          onClick={handleCompile}
          disabled={isCompiling || isUploading || !selectedBoard}
          className="flex items-center gap-2 px-3 py-1.5 bg-surface-200 hover:bg-surface-300 disabled:opacity-50 text-slate-200 rounded border border-panel-border transition-colors text-sm font-medium"
        >
          {isCompiling ? <Loader2 size={16} className="animate-spin text-primary-400" /> : <Play size={16} className="text-primary-400" />}
          Verify
        </button>

        {/* Upload Button */}
        <button
          onClick={handleUpload}
          disabled={isCompiling || isUploading || !selectedBoard || !selectedPort || !isCompiledSuccessfully}
          title={!selectedPort ? 'No serial port selected' : !isCompiledSuccessfully ? 'Compilation required before upload' : 'Upload to board'}
          className="flex items-center gap-2 px-3 py-1.5 bg-emerald-100 hover:bg-emerald-200 border border-emerald-300 disabled:opacity-50 disabled:cursor-not-allowed text-emerald-800 rounded transition-colors text-sm font-medium shadow-sm"
        >
          {isUploading ? <Loader2 size={16} className="animate-spin text-emerald-600" /> : <UploadCloud size={16} className="text-emerald-600" />}
          Upload
        </button>

        {/* COM Port Selector */}
        <div className="flex items-center gap-1 bg-surface-300 border border-panel-border rounded px-2 h-[34px]">
          <Usb size={16} className="text-slate-400" />
          <select
            value={selectedPort}
            onChange={e => setSelectedPort(e.target.value)}
            disabled={ports.length === 0}
            className="bg-transparent border-none text-sm text-slate-200 focus:ring-0 outline-none w-48 cursor-pointer disabled:opacity-50"
          >
            {ports.length === 0 ? (
              <option value="" disabled>No device found</option>
            ) : (
              <option value="" disabled>Select Port...</option>
            )}
            {ports.map(p => (
              <option key={p.path} value={p.path} className="bg-surface-200">
                {p.friendlyName ? p.friendlyName : p.path}
              </option>
            ))}
          </select>
          <button onClick={() => fetchPorts(true)} className="p-1 hover:bg-surface-400 rounded text-slate-400 hover:text-slate-200 transition-colors">
            <RefreshCw size={14} />
          </button>
        </div>

        {/* Connect Monitor Button */}
        <button
          onClick={handleConnectToggle}
          disabled={!selectedPort || isUploading || isCompiling}
          className={`flex items-center gap-2 px-3 py-1.5 border disabled:opacity-50 disabled:cursor-not-allowed rounded transition-colors text-sm font-medium shadow-sm ${
            isSerialConnected 
              ? 'bg-blue-600/20 hover:bg-blue-600/30 border-blue-500/30 text-blue-100' 
              : 'bg-surface-200 hover:bg-surface-300 border-panel-border text-slate-200'
          }`}
        >
          <Terminal size={16} className={isSerialConnected ? "text-blue-400" : "text-slate-400"} />
          {isSerialConnected ? 'Disconnect' : 'Connect'}
        </button>
      </div>

      <div className="flex items-center gap-2 text-xs font-mono">
        <span className="text-slate-400">Status:</span>
        <span className={statusText.includes('Fail') || statusText.includes('Error') ? 'text-red-400' : 'text-primary-400'}>
          {statusText}
        </span>
      </div>
    </div>
  )
}
