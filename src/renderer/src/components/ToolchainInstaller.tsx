import React, { useEffect, useState } from 'react'
import { Loader2, DownloadCloud, CheckCircle } from 'lucide-react'

export const ToolchainInstaller: React.FC = () => {
  const [needsInstall, setNeedsInstall] = useState(false)
  const [isInstalling, setIsInstalling] = useState(false)
  const [logs, setLogs] = useState<string[]>([])
  const [done, setDone] = useState(false)

  useEffect(() => {
    const check = async () => {
      if (!(window as any).api) return
      const isInstalled = await (window as any).api.compiler.check()
      if (!isInstalled) {
        setNeedsInstall(true)
      }
    }
    check()
  }, [])

  useEffect(() => {
    if (!(window as any).api) return
    const cleanup = (window as any).api.compiler.onLog((log: string) => {
      setLogs(prev => [...prev, log])
    })
    return () => { if (cleanup) cleanup() }
  }, [])

  const handleInstall = async () => {
    setIsInstalling(true)
    try {
      await (window as any).api.compiler.install()
      setDone(true)
      setTimeout(() => setNeedsInstall(false), 2000)
    } catch (e: any) {
      setLogs(prev => [...prev, `[Error] Installation failed: ${e.message || e}`])
      setIsInstalling(false)
    }
  }

  if (!needsInstall) return null

  return (
    <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-surface-100 border border-panel-border rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col">
        <div className="p-6 pb-4 border-b border-panel-border">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-full bg-primary-500/20 flex items-center justify-center">
              <DownloadCloud className="text-primary-400" size={24} />
            </div>
            <h2 className="text-xl font-bold text-slate-100">Hardware Deployment Engine</h2>
          </div>
          <p className="text-sm text-slate-400">
            To compile and upload code directly to your ESP32, EduBlocks needs to download the local Arduino CLI toolchain (~150MB).
          </p>
        </div>
        
        {isInstalling ? (
          <div className="flex flex-col">
            <div className="h-48 bg-[#0a0a0a] p-4 overflow-y-auto font-mono text-xs text-slate-300 whitespace-pre-wrap">
              {logs.map((l, i) => (
                <div key={i} className={l.includes('Error') ? 'text-red-400' : 'text-slate-300'}>{l}</div>
              ))}
            </div>
            <div className="p-4 bg-surface-50 border-t border-panel-border flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-medium text-primary-400">
                {done ? <CheckCircle size={16} className="text-emerald-400" /> : <Loader2 size={16} className="animate-spin" />}
                {done ? 'Installation Complete!' : 'Installing toolchain...'}
              </div>
            </div>
          </div>
        ) : (
          <div className="p-4 bg-surface-50 flex justify-end gap-3">
            <button
              onClick={() => setNeedsInstall(false)}
              className="px-4 py-2 rounded text-sm font-medium text-slate-300 hover:bg-surface-200 transition-colors"
            >
              Skip for now
            </button>
            <button
              onClick={handleInstall}
              className="px-4 py-2 rounded text-sm font-medium bg-primary-600 hover:bg-primary-500 text-white shadow-lg shadow-primary-900/50 transition-colors"
            >
              Download & Install
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
