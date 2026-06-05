import React, { useEffect, useState, useRef } from 'react'
import { Terminal, Trash2, Send } from 'lucide-react'

export const SerialMonitor: React.FC = () => {
  const [logs, setLogs] = useState<string[]>([])
  const [input, setInput] = useState('')
  const logsEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!(window as any).api) return

    // Subscribe to Compiler Logs
    const cleanupCompiler = (window as any).api.compiler.onLog((log: string) => {
      setLogs(prev => [...prev, log])
    })

    // Subscribe to Serial Data
    const cleanupSerial = (window as any).api.serial.onData((data: string) => {
      setLogs(prev => [...prev, data.trim()])
    })
    
    // Subscribe to Serial Errors
    const cleanupSerialError = (window as any).api.serial.onError((err: string) => {
      setLogs(prev => [...prev, `[Serial Error] ${err}`])
    })

    return () => {
      if (cleanupCompiler) cleanupCompiler()
      if (cleanupSerial) cleanupSerial()
      if (cleanupSerialError) cleanupSerialError()
    }
  }, [])

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs])

  const handleSend = () => {
    if (!input.trim() || !(window as any).api) return
    ;(window as any).api.serial.write(input + '\n')
    setLogs(prev => [...prev, `> ${input}`])
    setInput('')
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSend()
    }
  }

  return (
    <div className="flex flex-col h-full bg-[#0a0a0a] font-mono text-[11px] border border-panel-border rounded overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-surface-100 border-b border-panel-border shrink-0">
        <div className="flex items-center gap-2 text-slate-400">
          <Terminal size={14} />
          <span className="uppercase font-semibold tracking-wider text-[10px]">Output Monitor</span>
        </div>
        <button 
          onClick={() => setLogs([])}
          className="p-1 hover:bg-surface-300 rounded text-slate-500 hover:text-red-400 transition-colors"
          title="Clear Output"
        >
          <Trash2 size={14} />
        </button>
      </div>

      {/* Logs Area */}
      <div className="flex-1 overflow-y-auto p-2 text-slate-300 leading-relaxed whitespace-pre-wrap font-mono">
        {logs.length === 0 ? (
          <div className="text-slate-600 italic">No output...</div>
        ) : (
          logs.map((log, i) => (
            <div key={i} className={log.startsWith('[Error]') || log.includes('Error') || log.includes('Failed') ? 'text-red-400' : log.startsWith('[Compiler]') || log.startsWith('[Installer]') ? 'text-blue-400' : ''}>
              {log}
            </div>
          ))
        )}
        <div ref={logsEndRef} />
      </div>

      {/* Input Area */}
      <div className="flex items-center gap-2 p-2 bg-surface-100 border-t border-panel-border shrink-0">
        <span className="text-primary-500 font-bold ml-1">{'>'}</span>
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Send serial command..."
          className="flex-1 bg-transparent border-none text-slate-200 focus:ring-0 outline-none px-1"
        />
        <button
          onClick={handleSend}
          disabled={!input.trim()}
          className="p-1 text-primary-500 hover:bg-primary-500/10 rounded disabled:opacity-50 transition-colors"
        >
          <Send size={14} />
        </button>
      </div>
    </div>
  )
}
