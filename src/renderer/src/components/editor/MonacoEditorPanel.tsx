import React from 'react'
import Editor, { loader } from '@monaco-editor/react'
import * as monaco from 'monaco-editor'
import { useAppStore } from '@renderer/store/useAppStore'
import { AlertTriangle, Code2 } from 'lucide-react'

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

  return (
    <div className="flex flex-col h-full bg-[#1e1e1e]">
      
      {/* Editor Header */}
      <div className="flex items-center gap-1.5 px-3 h-8 shrink-0 border-b border-[#2d2d2d] bg-[#252526]">
        <span className="text-slate-400"><Code2 size={13} /></span>
        <span className="text-xs font-semibold text-slate-300 tracking-wide uppercase">Generated Code</span>
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
          theme="vs-dark"
          value={generatedCode}
          options={{
            readOnly: true,
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
