import React, { useEffect, useRef, useState } from 'react'
import { useAppStore } from '@renderer/store/useAppStore'

export const PromptDialog: React.FC = () => {
  const promptConfig = useAppStore(s => s.promptConfig)
  const setPromptConfig = useAppStore(s => s.setPromptConfig)
  
  const [value, setValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (promptConfig?.isOpen) {
      setValue(promptConfig.defaultValue || '')
      // Focus after a short tick to allow transition/render
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [promptConfig])

  if (!promptConfig || !promptConfig.isOpen) return null

  const handleClose = (result: string | null) => {
    if (promptConfig.callback) {
      promptConfig.callback(result)
    }
    setPromptConfig(null)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    handleClose(value)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-surface-100 border border-panel-border rounded-xl shadow-2xl w-[400px] overflow-hidden flex flex-col">
        <div className="px-5 py-4 border-b border-panel-border bg-surface-50/50">
          <h3 className="text-sm font-semibold text-slate-200">{promptConfig.message}</h3>
        </div>
        
        <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-4">
          <input
            ref={inputRef}
            type="text"
            className="w-full bg-surface-200 border border-panel-border rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 transition-all select-text"
            value={value}
            onChange={e => setValue(e.target.value)}
          />
          
          <div className="flex justify-end gap-3 mt-2">
            <button
              type="button"
              onClick={() => handleClose(null)}
              className="px-4 py-2 rounded-lg text-sm font-medium text-slate-400 hover:text-slate-200 hover:bg-surface-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg text-sm font-medium bg-primary-600 text-white hover:bg-primary-500 transition-colors"
            >
              OK
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
