import React from 'react'
import { BookOpen, Code2, Cpu, Layers, Minus, Square, X } from 'lucide-react'
import { BoardSelector } from '@renderer/components/BoardSelector'
import { BoardPreviewWidget } from '@renderer/components/BoardPreviewWidget'
import { BlocklyWorkspace } from '@renderer/components/blockly/BlocklyWorkspace'
import { GeneratorObserver } from '@renderer/components/blockly/generator/GeneratorObserver'
import { MonacoEditorPanel } from '@renderer/components/editor/MonacoEditorPanel'
import { PromptDialog } from '@renderer/components/dialogs/PromptDialog'
// Interactive visual hardware canvas
import { HardwareCanvas } from '../components/hardware/HardwareCanvas'
import { ComponentPalette } from '../components/hardware/ComponentPalette'
import { ActiveConnectionsPanel } from '../components/hardware/ActiveConnectionsPanel'
import { useAppStore, selectSelectedBoard, selectIsDirty } from '@renderer/store/useAppStore'
import { Toolbar } from '@renderer/components/Toolbar'
import { ToolchainInstaller } from '@renderer/components/ToolchainInstaller'
import { SerialMonitor } from '@renderer/components/hardware/SerialMonitor'

export const AppLayout: React.FC = () => {
  const selectedBoard = useAppStore(selectSelectedBoard)
  const isDirty = useAppStore(selectIsDirty)
  const projectName = useAppStore(s => s.projectName)
  const activeTab = useAppStore(s => s.activeTab)
  const setActiveTab = useAppStore(s => s.setActiveTab)

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
          px-4 h-12 shrink-0
          bg-surface-50 border-b border-panel-border
          app-drag-region
        "
      >
        {/* Left: Logo + project name */}
        <div className="flex items-center gap-3 app-no-drag">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center">
              <Cpu size={13} className="text-white" />
            </div>
            <span className="text-sm font-bold text-slate-100 tracking-tight">
              EduBlocks Studio
            </span>
          </div>

          <span className="text-slate-600">|</span>

          <span className="text-sm text-slate-400 font-medium">
            {projectName}
            {isDirty && <span className="ml-1 text-primary-400">•</span>}
          </span>
        </div>

        {/* Center: Board Selector */}
        <div className="absolute left-1/2 -translate-x-1/2 app-no-drag">
          <BoardSelector />
        </div>

        {/* Right: Version pill */}
        <div className="flex items-center gap-2 app-no-drag">
          <span className="text-xs text-slate-600 px-2 py-0.5 rounded-full border border-panel-border">
            v1.0.0
          </span>
        </div>
      </header>

      <Toolbar />

      {/* ── Main Body ───────────────────────────────────────────────────── */}
      <main className="flex flex-1 overflow-hidden">

        {/* ── Left Panel: Virtual Hardware ──────────────────────────────── */}
        <aside
          id="panel-left"
          className="
            flex flex-col w-72 shrink-0
            bg-surface-50 border-r border-panel-border
            overflow-hidden
          "
        >
          {activeTab === 'blocks' ? (
            <>
              <PanelHeader icon={<Layers size={13} />} title="Hardware Preview" />
              <div className="flex-1 flex flex-col overflow-hidden">
                <BoardPreviewWidget board={selectedBoard} />
              </div>
            </>
          ) : (
            <>
              <PanelHeader icon={<Layers size={13} />} title="Components" />
              <div className="flex-1 flex flex-col overflow-hidden">
                <ComponentPalette />
              </div>
            </>
          )}
        </aside>

        {/* ── Center Panel: Main Workspace ──────────────────────────────── */}
        <section
          id="panel-center"
          className="flex flex-col flex-1 overflow-hidden"
        >
          {/* Tabs Header */}
          <div className="flex items-center h-8 shrink-0 border-b border-panel-border bg-surface-100/50">
            <button
              onClick={() => setActiveTab('blocks')}
              className={`
                flex items-center gap-1.5 px-4 h-full border-r border-panel-border
                text-xs font-semibold tracking-wide uppercase transition-colors
                ${activeTab === 'blocks'
                  ? 'bg-surface-DEFAULT text-primary-400 border-b-2 border-b-primary-500'
                  : 'text-slate-500 hover:text-slate-300 hover:bg-surface-100'
                }
              `}
            >
              <BookOpen size={13} /> Blocks
            </button>
            <button
              onClick={() => setActiveTab('hardware')}
              className={`
                flex items-center gap-1.5 px-4 h-full border-r border-panel-border
                text-xs font-semibold tracking-wide uppercase transition-colors
                ${activeTab === 'hardware'
                  ? 'bg-surface-DEFAULT text-emerald-400 border-b-2 border-b-emerald-500'
                  : 'text-slate-500 hover:text-slate-300 hover:bg-surface-100'
                }
              `}
            >
              <Cpu size={13} /> Hardware Canvas
            </button>
          </div>

          <div className="flex-1 min-h-0 relative overflow-hidden bg-[#162035]">
            {/* We render both but hide the inactive one to preserve Blockly state when switching tabs */}
            <div className={`absolute inset-0 ${activeTab === 'blocks' ? 'block' : 'hidden'}`}>
              <BlocklyWorkspace key={selectedBoard?.id} />
            </div>
            <div className={`absolute inset-0 ${activeTab === 'hardware' ? 'block' : 'hidden'}`}>
              <HardwareCanvas />
            </div>
          </div>
        </section>

        {/* ── Right Panel: Code Preview + Terminal ──────────────────────── */}
        <aside
          id="panel-code"
          className="
            flex flex-col w-80 shrink-0
            bg-surface-50 border-l border-panel-border
            overflow-hidden
          "
        >
          <div className="flex-col flex-1 min-h-0">
            <MonacoEditorPanel />
          </div>

          <div className="border-t border-panel-border" />

          {/* Active Connections Panel */}
          <div className="h-44 flex flex-col shrink-0">
            <ActiveConnectionsPanel />
          </div>

          <div className="border-t border-panel-border" />

          <div className="h-44 flex flex-col shrink-0">
            <SerialMonitor />
          </div>
        </aside>
      </main>

      {/* ── Status Bar ──────────────────────────────────────────────────── */}
      <footer
        id="status-bar"
        className="
          flex items-center justify-between
          px-4 h-6 shrink-0
          bg-surface-200 border-t border-panel-border
          text-xs text-slate-600
        "
      >
        <span>
          Board: <span className="text-primary-400">{selectedBoard?.name ?? '—'}</span>
        </span>
        <span className="text-slate-700">EduBlocks Studio</span>
        <span>Ready</span>
      </footer>
    </div>
  )
}

interface PanelHeaderProps {
  icon: React.ReactNode
  title: string
}

const PanelHeader: React.FC<PanelHeaderProps> = ({ icon, title }) => (
  <div className="flex items-center gap-1.5 px-3 h-8 shrink-0 border-b border-panel-border bg-surface-100/50">
    <span className="text-slate-500">{icon}</span>
    <span className="text-xs font-semibold text-slate-400 tracking-wide uppercase">{title}</span>
  </div>
)
