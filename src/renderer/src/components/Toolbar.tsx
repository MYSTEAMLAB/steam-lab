import React, { useEffect, useState } from 'react'
import { Play, UploadCloud, Usb, Loader2, AlertCircle, RefreshCw } from 'lucide-react'
import { useAppStore } from '../store/useAppStore'

export const Toolbar: React.FC = () => {
  const { generatedCode, selectedBoard } = useAppStore()
  const [ports, setPorts] = useState<any[]>([])
  const [selectedPort, setSelectedPort] = useState<string>('')
  const [isCompiling, setIsCompiling] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [statusText, setStatusText] = useState('Ready')

  const fetchPorts = async () => {
    try {
      if ((window as any).api?.serial) {
        const p = await (window as any).api.serial.getPorts()
        setPorts(p)
        if (p.length > 0 && !selectedPort) {
          setSelectedPort(p[0].path)
        }
      }
    } catch (e) {
      console.error('Failed to fetch ports', e)
    }
  }

  useEffect(() => {
    fetchPorts()
  }, [])

  const handleCompile = async () => {
    if (!selectedBoard || !generatedCode) return
    setIsCompiling(true)
    setStatusText('Compiling...')
    try {
      const result = await (window as any).api.compiler.compile(generatedCode, selectedBoard.fqbn)
      if (result.success) {
        setStatusText('Compilation Successful!')
      } else {
        setStatusText('Compilation Failed (See Monitor)')
      }
    } catch (e) {
      setStatusText('Compiler Error')
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
    try {
      // Re-compile and upload
      const result = await (window as any).api.compiler.upload(generatedCode, selectedBoard.fqbn, selectedPort)
      if (result.success) {
        setStatusText('Upload Successful!')
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
          disabled={isCompiling || isUploading || !selectedBoard || !selectedPort}
          className="flex items-center gap-2 px-3 py-1.5 bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/30 disabled:opacity-50 text-emerald-100 rounded transition-colors text-sm font-medium shadow-sm"
        >
          {isUploading ? <Loader2 size={16} className="animate-spin text-emerald-400" /> : <UploadCloud size={16} className="text-emerald-400" />}
          Upload
        </button>

        {/* COM Port Selector */}
        <div className="flex items-center gap-1 bg-surface-300 border border-panel-border rounded px-2 h-[34px]">
          <Usb size={16} className="text-slate-400" />
          <select
            value={selectedPort}
            onChange={e => setSelectedPort(e.target.value)}
            className="bg-transparent border-none text-sm text-slate-200 focus:ring-0 outline-none w-32 cursor-pointer"
          >
            <option value="" disabled>Select Port...</option>
            {ports.map(p => (
              <option key={p.path} value={p.path} className="bg-surface-200">{p.path}</option>
            ))}
          </select>
          <button onClick={fetchPorts} className="p-1 hover:bg-surface-400 rounded text-slate-400 hover:text-slate-200 transition-colors">
            <RefreshCw size={14} />
          </button>
        </div>
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
