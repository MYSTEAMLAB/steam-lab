import React, { useState } from 'react'
import { FilePlus, Save, FolderOpen, BookOpen, FileCode, Wifi } from 'lucide-react'
import { getExampleMenuTree } from '@shared/examples'
import { dispatchMobileAction, getPairedServer, setPairedServer } from '@renderer/lib/mobile/mobileBridge'
import { useAppStore } from '@renderer/store/useAppStore'

// Replaces the desktop app's native OS menu bar (File/Examples/etc.) — Android
// has no equivalent, so this dispatches the exact same action strings
// useProjectManager.ts already listens for via window.api.onMenuAction.
export const MobileToolbar: React.FC = () => {
  const [showExamples, setShowExamples] = useState(false)
  const [showPairing, setShowPairing] = useState(false)
  const [showOpen, setShowOpen] = useState(false)
  const [openFiles, setOpenFiles] = useState<string[]>([])
  const [pairHost, setPairHost] = useState('')
  const [pairPort, setPairPort] = useState('47285')
  const [pairPin, setPairPin] = useState('')
  const [pairStatus, setPairStatus] = useState<string | null>(null)
  const projectName = useAppStore((s) => s.projectName)

  const openExamplesMenu = async () => setShowExamples(true)

  const openOpenMenu = async () => {
    const files = await window.api.project.getRecents()
    setOpenFiles(files)
    setShowOpen(true)
  }

  const openPairingMenu = async () => {
    const existing = await getPairedServer()
    if (existing) {
      setPairHost(existing.host)
      setPairPort(String(existing.port))
      setPairPin(existing.pin)
    }
    setPairStatus(null)
    setShowPairing(true)
  }

  const testAndSavePairing = async () => {
    setPairStatus('Checking...')
    try {
      const res = await fetch(`http://${pairHost}:${pairPort}/ping`)
      if (!res.ok) throw new Error('Server did not respond')
      await setPairedServer({ host: pairHost, port: Number(pairPort) || 47285, pin: pairPin })
      setPairStatus('Paired! You can compile now.')
    } catch (e: any) {
      setPairStatus(`Could not reach ${pairHost}:${pairPort} — check the IP/port and that both devices are on the same WiFi.`)
    }
  }

  return (
    <>
      <div className="flex items-center gap-1 px-2 py-1.5 bg-surface-100 border-b border-panel-border overflow-x-auto shrink-0">
        <button onClick={() => dispatchMobileAction('new-project')} className="mobile-toolbar-btn" title="New Project">
          <FilePlus size={16} />
        </button>
        <button onClick={openOpenMenu} className="mobile-toolbar-btn" title="Open Project">
          <FolderOpen size={16} />
        </button>
        <button onClick={() => dispatchMobileAction('save-project')} className="mobile-toolbar-btn" title="Save Project">
          <Save size={16} />
        </button>
        <button onClick={openExamplesMenu} className="mobile-toolbar-btn" title="Examples">
          <BookOpen size={16} />
        </button>
        <button onClick={() => dispatchMobileAction('export-ino')} className="mobile-toolbar-btn" title="Export .ino">
          <FileCode size={16} />
        </button>
        <span className="ml-auto text-xs font-semibold text-slate-400 truncate max-w-[100px]">{projectName}</span>
        <button onClick={openPairingMenu} className="mobile-toolbar-btn" title="Pair with Desktop Compile Server">
          <Wifi size={16} />
        </button>
      </div>

      {showExamples && (
        <MobileModal title="Examples" onClose={() => setShowExamples(false)}>
          {getExampleMenuTree().map((group) => (
            <div key={group.category} className="mb-3">
              <div className="text-xs font-bold uppercase text-slate-400 mb-1">{group.category}</div>
              {group.items.map((item) => (
                <button
                  key={item.id}
                  onClick={() => { dispatchMobileAction(`open-example|${item.id}`); setShowExamples(false) }}
                  className="block w-full text-left px-3 py-2 rounded hover:bg-surface-200 text-sm text-slate-200"
                >
                  {item.name}
                </button>
              ))}
            </div>
          ))}
        </MobileModal>
      )}

      {showOpen && (
        <MobileModal title="Open Project" onClose={() => setShowOpen(false)}>
          {openFiles.length === 0 && <p className="text-sm text-slate-400">No saved projects yet.</p>}
          {openFiles.map((name) => (
            <button
              key={name}
              onClick={() => { dispatchMobileAction(`open-recent|${name}`); setShowOpen(false) }}
              className="block w-full text-left px-3 py-2 rounded hover:bg-surface-200 text-sm text-slate-200"
            >
              {name}
            </button>
          ))}
        </MobileModal>
      )}

      {showPairing && (
        <MobileModal title="Pair with Desktop" onClose={() => setShowPairing(false)}>
          <p className="text-xs text-slate-400 mb-3">
            On your computer: MY STEAM LAB → Tools → Mobile Compile Server... → Start Server. Enter what it shows below.
          </p>
          <label className="block text-xs font-semibold text-slate-400 mb-1">Computer's IP address</label>
          <input value={pairHost} onChange={(e) => setPairHost(e.target.value)} placeholder="192.168.1.6" className="mobile-input mb-2" />
          <label className="block text-xs font-semibold text-slate-400 mb-1">Port</label>
          <input value={pairPort} onChange={(e) => setPairPort(e.target.value)} className="mobile-input mb-2" />
          <label className="block text-xs font-semibold text-slate-400 mb-1">Pairing PIN</label>
          <input value={pairPin} onChange={(e) => setPairPin(e.target.value)} className="mobile-input mb-3" />
          <button onClick={testAndSavePairing} className="w-full py-2 rounded bg-primary-600 text-white text-sm font-semibold">
            Test & Save
          </button>
          {pairStatus && <p className="text-xs text-slate-300 mt-2">{pairStatus}</p>}
        </MobileModal>
      )}
    </>
  )
}

const MobileModal: React.FC<{ title: string; onClose: () => void; children: React.ReactNode }> = ({ title, onClose, children }) => (
  <div className="fixed inset-0 z-[200] bg-black/70 flex items-end sm:items-center justify-center p-4" onClick={onClose}>
    <div
      className="bg-surface-100 border border-panel-border rounded-xl w-full max-w-md max-h-[70vh] overflow-y-auto p-4"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-slate-100">{title}</h3>
        <button onClick={onClose} className="text-slate-400 text-sm">Close</button>
      </div>
      {children}
    </div>
  </div>
)
