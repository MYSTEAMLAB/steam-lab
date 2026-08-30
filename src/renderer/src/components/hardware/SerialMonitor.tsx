import React, { useEffect, useState, useRef } from 'react'
import { Terminal, Trash2, Send, Copy, Download } from 'lucide-react'
import { useT } from '@renderer/lib/i18n/useT'

export const SerialMonitor: React.FC = () => {
  const t = useT()
  const [logs, setLogs] = useState<string[]>([])
  const [input, setInput] = useState('')
  const logsEndRef = useRef<HTMLDivElement>(null)

  const getTimestamp = () => {
    const now = new Date()
    return `[${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}]`
  }

  useEffect(() => {
    if (!(window as any).api) return

    // Subscribe to Compiler Logs
    const cleanupCompiler = (window as any).api.compiler.onLog((log: string) => {
      setLogs(prev => [...prev, `${getTimestamp()} ${log}`])
    })

    // Subscribe to Serial Data
    const cleanupSerial = (window as any).api.serial.onData((data: string) => {
      setLogs(prev => [...prev, `${getTimestamp()} ${data.trim()}`])
    })
    
    // Subscribe to Serial Errors
    const cleanupSerialError = (window as any).api.serial.onError((err: string) => {
      setLogs(prev => [...prev, `${getTimestamp()} [Serial Error] ${err}`])
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
    setLogs(prev => [...prev, `${getTimestamp()} > ${input}`])
    setInput('')
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSend()
    }
  }

  const handleCopy = async () => {
    const textToCopy = logs.join('\n');
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(textToCopy);
      } else {
        throw new Error("Clipboard API not available");
      }
    } catch (err) {
      console.warn('Clipboard writeText failed, using fallback', err);
      const textArea = document.createElement("textarea");
      textArea.value = textToCopy;
      textArea.style.top = "0";
      textArea.style.left = "0";
      textArea.style.position = "fixed";
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      try {
        document.execCommand('copy');
      } catch (fallbackErr) {
        console.error('Fallback copy failed', fallbackErr);
      }
      document.body.removeChild(textArea);
    }
  }

  const handleExport = () => {
    const blob = new Blob([logs.join('\n')], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `edublocks_logs_${Date.now()}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="flex flex-col h-full bg-surface-DEFAULT font-mono text-[11px] border border-panel-border rounded overflow-hidden">
      {/* Header */}
      <div className="msl-panel-header justify-between">
        <div className="flex items-center gap-1.5">
          <Terminal size={13} className="text-violet-500" />
          <span>{t('monitorOutputMonitor')}</span>
        </div>
        <div className="flex items-center gap-1">
          <button 
            onClick={handleCopy}
            disabled={logs.length === 0}
            className="p-1 rounded-md text-slate-400 hover:text-primary-600 hover:bg-primary-50 transition-colors active:scale-90 disabled:opacity-40"
            title="Copy Logs"
          >
            <Copy size={14} />
          </button>
          <button 
            onClick={handleExport}
            disabled={logs.length === 0}
            className="p-1 rounded-md text-slate-400 hover:text-primary-600 hover:bg-primary-50 transition-colors active:scale-90 disabled:opacity-40"
            title="Export Logs"
          >
            <Download size={14} />
          </button>
          <div className="w-px h-3 bg-panel-border mx-1" />
          <button 
            onClick={() => setLogs([])}
            className="p-1 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors active:scale-90"
            title="Clear Output"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* Logs Area */}
      <div className="flex-1 overflow-y-auto p-2 text-slate-200 leading-relaxed whitespace-pre-wrap font-mono">
        {logs.length === 0 ? (
          <div className="text-slate-400 italic">{t('monitorNoOutput')}</div>
        ) : (
          logs.map((log, i) => {
            const isError = log.includes('[Error]') || log.includes('Error') || log.includes('Failed') || log.includes('FAILED')
            const isSystem = log.includes('[Compiler]') || log.includes('[Installer]') || log.includes('====')
            const isSent = log.includes('] > ')
            const isOk = log.includes('SUCCESS') || log.includes('Successful')
            return (
              <div
                key={i}
                className={`px-1.5 py-px rounded animate-fade-in ${
                  isError ? 'text-red-700 bg-red-50'
                    : isOk ? 'text-emerald-700 bg-emerald-50 font-semibold'
                    : isSystem ? 'text-primary-700 font-semibold'
                    : isSent ? 'text-violet-700 bg-violet-50'
                    : 'text-slate-200'
                }`}
              >
                {log}
              </div>
            )
          })
        )}
        <div ref={logsEndRef} />
      </div>

      {/* Input Area */}
      <div className="flex items-center gap-2 p-2 bg-gradient-to-b from-surface-50 to-surface-100 border-t border-panel-border shrink-0 focus-within:from-primary-50 focus-within:to-primary-50/60 transition-colors">
        <span className="text-primary-500 font-bold ml-1">{'>'}</span>
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={t('monitorSendCommand')}
          className="flex-1 bg-transparent border-none text-slate-100 focus:ring-0 outline-none px-1"
        />
        <button
          onClick={handleSend}
          disabled={!input.trim()}
          className="p-1.5 rounded-lg text-white bg-primary-500 hover:bg-primary-600 disabled:opacity-30 disabled:bg-slate-500 transition-all active:scale-90 shadow-sm"
        >
          <Send size={14} />
        </button>
      </div>
    </div>
  )
}
