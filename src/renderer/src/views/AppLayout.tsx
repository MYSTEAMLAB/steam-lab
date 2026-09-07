import React from 'react'
import { BookOpen, Code2, Cpu, Minus, Square, X, Terminal, Cable, Camera, PlayCircle, Route } from 'lucide-react'
import { BoardSelector } from '@renderer/components/BoardSelector'
import { PcbTypeSelector } from '@renderer/components/PcbTypeSelector'
import { BlocklyWorkspace } from '@renderer/components/blockly/BlocklyWorkspace'
import { GeneratorObserver } from '@renderer/components/blockly/generator/GeneratorObserver'
import { MonacoEditorPanel } from '@renderer/components/editor/MonacoEditorPanel'
import { PromptDialog } from '@renderer/components/dialogs/PromptDialog'
// Interactive visual hardware canvas
import { HardwareCanvas } from '../components/hardware/HardwareCanvas'
import { ActiveConnectionsPanel } from '../components/hardware/ActiveConnectionsPanel'
import { AIVisionPanel } from '../components/ai/AIVisionPanel'
import { SimulatorPanel } from '../components/simulator/SimulatorPanel'
import { TracerRunPanel } from '../components/tracer/TracerRunPanel'
import { useAppStore, selectSelectedBoard, selectIsDirty } from '@renderer/store/useAppStore'
import { Toolbar } from '@renderer/components/Toolbar'
import { ToolchainInstaller } from '@renderer/components/ToolchainInstaller'
import { SerialMonitor } from '@renderer/components/hardware/SerialMonitor'
import { useProjectManager } from '@renderer/hooks/useProjectManager'
import { LanguageSelector } from '@renderer/components/LanguageSelector'
import { useT } from '@renderer/lib/i18n/useT'

// @ts-ignore
import logoUrl from '../assets/logo.jpeg'

export const AppLayout: React.FC = () => {
  const selectedBoard = useAppStore(selectSelectedBoard)
  const isDirty = useAppStore(selectIsDirty)
  const projectName = useAppStore(s => s.projectName)
  const activeTab = useAppStore(s => s.activeTab)
  const setActiveTab = useAppStore(s => s.setActiveTab)
  const activeRightTab = useAppStore(s => s.activeRightTab)
  const setActiveRightTab = useAppStore(s => s.setActiveRightTab)
  const saveStatus = useAppStore(s => s.saveStatus)
  const t = useT()

  // Initialize Project Manager
  useProjectManager()

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-surface-DEFAULT text-slate-200 select-none">
      {/* Headless code generator orchestrator */}
      <GeneratorObserver />
      
      {/* Global Dialogs */}
      <PromptDialog />
      <ToolchainInstaller />
      
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <header
        id="app-header"
        className="
          relative z-40
          flex items-center justify-between
          px-4 h-14 shrink-0
          bg-gradient-to-b from-white to-surface-50
          border-b border-panel-border shadow-soft
          app-drag-region
        "
      >
        {/* Left: Logo + project name */}
        <div className="flex items-center gap-3 app-no-drag">
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center bg-white rounded-xl p-1 ring-1 ring-panel-border shadow-soft">
              <img src={logoUrl} alt="Logo" className="w-8 h-8 object-contain rounded-lg" />
            </div>
            <span className="text-[15px] font-extrabold tracking-tight uppercase bg-gradient-to-r from-primary-600 to-violet-600 bg-clip-text text-transparent">
              {t('appName')}
            </span>
          </div>

          <span className="w-px h-5 bg-panel-border" />

          <span className="text-sm text-slate-300 font-semibold">
            {projectName}
            {isDirty && (
              <span
                className="ml-1.5 inline-block w-2 h-2 rounded-full bg-amber-500 align-middle animate-pulse-soft"
                title={t('unsavedChanges')}
              />
            )}
          </span>
          {saveStatus && (
            <span className="msl-pill bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 animate-fade-in-up">
              {saveStatus}
            </span>
          )}
        </div>

        {/* Center: PCB Type + Board Selector */}
        <div className="absolute left-1/2 -translate-x-1/2 app-no-drag flex items-center gap-2">
          <PcbTypeSelector />
          <BoardSelector />
        </div>

        {/* Right: Language + version pill */}
        <div className="flex items-center gap-2 app-no-drag">
          <LanguageSelector />
          <span className="msl-pill bg-surface-100 text-slate-400 ring-1 ring-panel-border">
            v1.0.0
          </span>
        </div>
      </header>

      <Toolbar />

      {/* ── Main Body ───────────────────────────────────────────────────── */}
      <main className="flex flex-1 overflow-hidden">

        {/* Components used to live in a left sidebar here, alongside a Hardware
            Preview widget. Both are gone now: Components moved into a
            horizontal strip along the top of the canvas itself (see
            HardwareCanvas.tsx) so the canvas gets the full width, and Hardware
            Preview was dropped as redundant — the actual board is already
            rendered live on the canvas. */}

        {/* ── Center Panel: Main Workspace ──────────────────────────────── */}
        <section
          id="panel-center"
          className="flex flex-col flex-1 overflow-hidden"
        >
          {/* Tabs Header */}
          <div className="flex items-center h-10 shrink-0 border-b border-panel-border bg-gradient-to-b from-surface-100 to-surface-50">
            <button
              onClick={() => setActiveTab('blocks')}
              className={`msl-tab ${activeTab === 'blocks' ? 'msl-tab-active text-primary-600' : ''}`}
            >
              <BookOpen size={14} /> {t('tabBlocks')}
            </button>
            <button
              onClick={() => setActiveTab('hardware')}
              className={`msl-tab ${activeTab === 'hardware' ? 'msl-tab-active text-emerald-600' : ''}`}
            >
              <Cpu size={14} /> {t('tabHardwareCanvas')}
            </button>
            <button
              onClick={() => setActiveTab('ai')}
              className={`msl-tab ${activeTab === 'ai' ? 'msl-tab-active text-violet-600' : ''}`}
            >
              <Camera size={14} /> {t('tabAiVision')}
            </button>
            <button
              onClick={() => setActiveTab('simulator')}
              className={`msl-tab ${activeTab === 'simulator' ? 'msl-tab-active text-amber-600' : ''}`}
            >
              <PlayCircle size={14} /> {t('tabSimulator')}
            </button>
            <button
              onClick={() => setActiveTab('tracer')}
              className={`msl-tab ${activeTab === 'tracer' ? 'msl-tab-active text-rose-600' : ''}`}
            >
              <Route size={14} /> Tracer Run
            </button>
          </div>

          <div className="flex-1 min-h-0 relative overflow-hidden bg-surface-50">
            {/* We render all three but hide inactive ones to preserve Blockly/camera state when switching tabs */}
            <div className={`absolute inset-0 ${activeTab === 'blocks' ? 'block' : 'hidden'}`}>
              <BlocklyWorkspace key={selectedBoard?.id} />
            </div>
            <div className={`absolute inset-0 ${activeTab === 'hardware' ? 'block' : 'hidden'}`}>
              <HardwareCanvas />
            </div>
            <div className={`absolute inset-0 ${activeTab === 'ai' ? 'block' : 'hidden'}`}>
              <AIVisionPanel />
            </div>
            <div className={`absolute inset-0 ${activeTab === 'simulator' ? 'block' : 'hidden'}`}>
              <SimulatorPanel />
            </div>
            <div className={`absolute inset-0 ${activeTab === 'tracer' ? 'block' : 'hidden'}`}>
              {activeTab === 'tracer' && <TracerRunPanel />}
            </div>
          </div>
        </section>

        {/* ── Right Panel: Tabbed Interfaces ──────────────────────── */}
        <aside
          id="panel-code"
          className="
            flex flex-col w-[360px] shrink-0
            bg-surface-50 border-l border-panel-border
            overflow-hidden
          "
        >
          {/* Tabs Header */}
          <div className="flex items-center h-10 shrink-0 border-b border-panel-border bg-gradient-to-b from-surface-100 to-surface-50">
            <button
              onClick={() => setActiveRightTab('code')}
              className={`msl-tab flex-1 ${activeRightTab === 'code' ? 'msl-tab-active text-primary-600' : ''}`}
            >
              <Code2 size={14} /> {t('tabCode')}
            </button>
            <button
              onClick={() => setActiveRightTab('connections')}
              className={`msl-tab flex-1 ${activeRightTab === 'connections' ? 'msl-tab-active text-emerald-600' : ''}`}
            >
              <Cable size={14} /> {t('tabWires')}
            </button>
            <button
              onClick={() => setActiveRightTab('monitor')}
              className={`msl-tab flex-1 ${activeRightTab === 'monitor' ? 'msl-tab-active text-violet-600' : ''}`}
            >
              <Terminal size={14} /> {t('tabMonitor')}
            </button>
          </div>

          <div className="flex-1 min-h-0 bg-surface-50 relative">
            <div className={`absolute inset-0 flex flex-col ${activeRightTab === 'code' ? 'block' : 'hidden'}`}>
              <MonacoEditorPanel />
            </div>
            <div className={`absolute inset-0 flex flex-col ${activeRightTab === 'connections' ? 'block' : 'hidden'}`}>
              <ActiveConnectionsPanel />
            </div>
            <div className={`absolute inset-0 flex flex-col ${activeRightTab === 'monitor' ? 'block' : 'hidden'}`}>
              <SerialMonitor />
            </div>
          </div>
        </aside>
      </main>

      {/* ── Status Bar ──────────────────────────────────────────────────── */}
      {/* Text here used to be slate-600/700 — #cbd5e1 and #e2e8f0 on an #e4e4e7
          bar, i.e. invisible. Darkened to readable values. */}
      <footer
        id="status-bar"
        className="
          flex items-center justify-between
          px-4 h-7 shrink-0
          bg-gradient-to-b from-surface-50 to-surface-100
          border-t border-panel-border
          text-[11px] font-medium text-slate-400
        "
      >
        <span className="flex items-center gap-1.5">
          <Cpu size={12} className="text-slate-500" />
          {t('statusBoard')}:{' '}
          <span className="font-semibold text-primary-600">{selectedBoard?.name ?? '—'}</span>
        </span>
        <span className="font-bold uppercase tracking-[0.14em] text-slate-500">{t('appName')}</span>
        <span className="flex items-center gap-1.5 text-emerald-600">
          <span className="msl-dot msl-dot-live" />
          {t('statusReady')}
        </span>
      </footer>
    </div>
  )
}
