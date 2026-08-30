import React from 'react'
import Editor, { loader } from '@monaco-editor/react'
import * as monaco from 'monaco-editor'
import { useAppStore } from '@renderer/store/useAppStore'
import { AlertTriangle, Code2, Pencil, RotateCcw } from 'lucide-react'

// @ts-ignore
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker'

// Configure @monaco-editor/react to use local monaco-editor package instead of CDN
// This prevents CSP violations in Electron and allows offline usage
loader.config({ monaco })

self.MonacoEnvironment = {
  getWorker() {
    return new editorWorker()
  }
}

export const MonacoEditorPanel: React.FC = () => {
  const generatedCode = useAppStore(s => s.generatedCode)
  const warnings = useAppStore(s => s.warnings)
  const isCodeManuallyEdited = useAppStore(s => s.isCodeManuallyEdited)
  const setManualCode = useAppStore(s => s.setManualCode)
  const resyncCodeFromBlocks = useAppStore(s => s.resyncCodeFromBlocks)

  const handleResync = () => {
    if (window.confirm('Discard your hand-written code and regenerate it from the Blocks workspace? This cannot be undone.')) {
      resyncCodeFromBlocks()
    }
  }

  return (
    <div className="flex flex-col h-full bg-surface-DEFAULT">

      {/* Editor Header */}
      <div className="flex items-center gap-1.5 px-3 h-8 shrink-0 border-b border-panel-border bg-surface-100">
        <span className="text-slate-400"><Code2 size={13} /></span>
        <span className="text-xs font-semibold text-slate-300 tracking-wide uppercase">
          {isCodeManuallyEdited ? 'Code (Manual Edit)' : 'Generated Code'}
        </span>
        <div className="flex-1" />
        {isCodeManuallyEdited ? (
          <button
            onClick={handleResync}
            title="Discard manual edits and regenerate from Blocks"
            className="flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-300 hover:text-amber-200 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 rounded transition-colors"
          >
            <RotateCcw size={11} /> Resync from Blocks
          </button>
        ) : (
          <button
            onClick={() => setManualCode(generatedCode)}
            title="Edit this code by hand instead of using Blocks — further block changes will be ignored until you resync"
            className="flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400 hover:text-slate-200 bg-surface-200 hover:bg-surface-300 border border-panel-border rounded transition-colors"
          >
            <Pencil size={11} /> Edit Code
          </button>
        )}
      </div>

      {/* Warnings Banner */}
      {warnings.length > 0 && (
        <div className="shrink-0 bg-yellow-500/10 border-b border-yellow-500/20 p-2 max-h-24 overflow-y-auto">
          {warnings.map((warn, i) => (
            <div key={i} className="flex items-start gap-1.5 text-yellow-400 text-[11px] mb-1 last:mb-0">
              <AlertTriangle size={12} className="shrink-0 mt-0.5" />
              <span className="leading-tight">{warn}</span>
            </div>
          ))}
        </div>
      )}

      {/* Editor Container */}
      <div className="flex-1 min-h-0 relative">
        <Editor
          height="100%"
          defaultLanguage="cpp"
          theme="light"
          value={generatedCode}
          onChange={(value) => {
            if (isCodeManuallyEdited) setManualCode(value ?? '')
          }}
          options={{
            readOnly: !isCodeManuallyEdited,
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            fontSize: 12,
            fontFamily: "'JetBrains Mono', 'Fira Code', Consolas, monospace",
            wordWrap: 'on',
            lineNumbersMinChars: 3,
            padding: { top: 16, bottom: 16 },
            smoothScrolling: true,
            cursorBlinking: 'smooth',
          }}
        />
      </div>
      
    </div>
  )
}
