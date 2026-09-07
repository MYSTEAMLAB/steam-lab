import React from 'react'
import { useAppStore, isFixedBoardDevice } from '@renderer/store/useAppStore'
import { Trash2, Settings2, X, Lock } from 'lucide-react'
import { boardRegistry } from '@shared/boards'
import { COMPONENT_REQUIREMENTS, validateDeviceAssignment } from '@shared/boards/wiringEngine'

export const PropertiesPanel: React.FC = () => {
  const selectedItemId = useAppStore(s => s.selectedItemId)
  const setSelectedItemId = useAppStore(s => s.setSelectedItemId)
  const selectedBoard = useAppStore(s => s.selectedBoard)
  const placedDevices = useAppStore(s => s.selectedBoard ? (s.boardLayouts[s.selectedBoard.id]?.devices || []) : [])
  const removeDevice = useAppStore(s => s.removeDevice)
  const updateDevicePin = useAppStore(s => s.updateDevicePin)

  if (!selectedItemId || !selectedBoard) return null

  const item = placedDevices.find(d => d.id === selectedItemId)
  if (!item) return null

  const handleDelete = () => {
    removeDevice(item.id)
    setSelectedItemId(null)
  }

  // Gather valid pins for the dropdown
  const pinMap = boardRegistry.getPinMap(selectedBoard.id)
  const reqs = COMPONENT_REQUIREMENTS[item.type]
  
  const options: { pinName: string, label: string, inUse: boolean }[] = []
  
  if (reqs && Array.isArray(reqs.requiredInterfaces)) {
    const assignedPins = new Set<string>()
    for (const d of placedDevices) {
      if (d.id !== item.id && typeof d.mappedPin === 'string' && d.mappedPin) {
        assignedPins.add(d.mappedPin)
      }
    }

    for (const [pinName, pinDef] of Object.entries(pinMap.pins)) {
      if (reqs.mustNotBeInputOnly && pinDef.inputOnly) continue
      
      let hasAllInterfaces = true
      for (const reqInterface of reqs.requiredInterfaces) {
        if (!pinDef.interfaces.includes(reqInterface)) {
          hasAllInterfaces = false
          break
        }
      }
      
      if (hasAllInterfaces) {
        const inUse = assignedPins.has(pinName)
        options.push({
          pinName,
          label: `${pinName} ${inUse ? '[In Use]' : '[Free]'}`,
          inUse
        })
      }
    }
  }

  const mappedPins: string[] = []
  if (typeof item.mappedPin === 'string' && item.mappedPin) {
    mappedPins.push(item.mappedPin)
  } else if (typeof item.mappedPin === 'object' && item.mappedPin) {
    Object.entries(item.mappedPin).forEach(([key, p]) => { if (typeof p === 'string' && p) mappedPins.push(`${key.toUpperCase()}: ${p}`) })
  }

  const validation = validateDeviceAssignment(item, selectedBoard.id, placedDevices)
  const isMultiPin = reqs && !Array.isArray(reqs.requiredInterfaces)
  const isFixed = isFixedBoardDevice(selectedBoard.id, item.id)

  return (
    <div className="absolute top-4 right-4 w-64 bg-surface-100/95 backdrop-blur-md border border-panel-border rounded-xl shadow-2xl flex flex-col overflow-hidden pointer-events-auto">
      <div className="flex items-center justify-between p-3 border-b border-panel-border bg-surface-50/50">
        <div className="flex items-center gap-2 text-slate-300">
          <Settings2 size={14} />
          <span className="text-xs font-semibold uppercase tracking-wide">
            Component Properties
          </span>
        </div>
        <button onClick={() => setSelectedItemId(null)} className="text-slate-500 hover:text-slate-300">
          <X size={14} />
        </button>
      </div>

      <div className="p-4 flex-1 space-y-4">
        <div>
          <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">ID</label>
          <div className="text-xs text-slate-300 font-mono bg-surface-200 px-2 py-1 rounded border border-panel-border overflow-hidden text-ellipsis whitespace-nowrap">
            {item.id}
          </div>
        </div>

        <div>
          <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Type</label>
          <div className="text-xs text-primary-400 font-medium capitalize">
            {item.type} {reqs ? `(${reqs.type})` : ''}
          </div>
        </div>

        <div>
          <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Status</label>
          <div className="flex items-center gap-2 text-xs">
            <div className={`w-2 h-2 rounded-full ${validation.valid ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]' : validation.error === 'Unassigned' ? 'bg-slate-500' : 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]'}`} />
            <span className={validation.valid ? 'text-emerald-400 font-medium' : validation.error === 'Unassigned' ? 'text-slate-400 font-medium' : 'text-red-400 font-medium'}>
              {validation.valid ? 'Connected' : validation.error}
            </span>
          </div>
        </div>

        <div>
          <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Assigned Pin</label>
          {isFixed ? (
            <div className="w-full bg-surface-200 border border-panel-border rounded-md px-2 py-1.5 text-xs text-slate-200">
              {mappedPins.length > 0 ? mappedPins.join(' | ') : 'Unassigned'}
              <p className="text-[9px] text-slate-500 mt-1">Soldered onboard — fixed pin, can't be changed.</p>
            </div>
          ) : isMultiPin ? (
            <div className="w-full bg-surface-200 border border-panel-border rounded-md px-2 py-1.5 text-xs text-slate-200">
              {mappedPins.length > 0 ? mappedPins.join(' | ') : 'Unassigned'}
              <p className="text-[9px] text-slate-500 mt-1">Auto-wired only.</p>
            </div>
          ) : (
            <select 
              className="w-full bg-surface-200 border border-panel-border rounded-md px-2 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-primary-500"
              value={mappedPins[0] || ''}
              onChange={(e) => updateDevicePin(item.id, e.target.value)}
            >
              <option value="" disabled>Select a pin...</option>
              {options.map(opt => (
                <option key={opt.pinName} value={opt.pinName} className={opt.inUse ? 'text-slate-500' : 'text-slate-200'} disabled={opt.inUse}>
                  {opt.label}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      <div className="p-3 border-t border-panel-border bg-surface-50/50">
        {isFixed ? (
          <div className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-slate-500/10 text-slate-400 text-xs font-medium">
            <Lock size={14} />
            Fixed onboard part
          </div>
        ) : (
          <button
            onClick={handleDelete}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 hover:text-red-300 transition-colors text-xs font-medium"
          >
            <Trash2 size={14} />
            Delete Component
          </button>
        )}
      </div>
    </div>
  )
}
