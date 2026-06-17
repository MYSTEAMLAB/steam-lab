import { useEffect } from 'react'
import { useAppStore } from '../store/useAppStore'

export function useProjectManager() {
  const store = useAppStore()

  useEffect(() => {
    // 1. Startup Recovery Check
    window.api.project.checkRecovery().then((recoveredData: any) => {
      if (recoveredData) {
        if (window.confirm('An unsaved project was found from your last session. Do you want to recover it?')) {
          useAppStore.getState().loadProject(recoveredData)
        } else {
          window.api.project.clearRecovery()
        }
      }
    })

    // 2. Auto-save loop (every 60s)
    const interval = setInterval(() => {
      const state = useAppStore.getState()
      if (state.isDirty) {
        const data = {
          projectName: state.projectName,
          savedFilePath: state.savedFilePath,
          selectedBoard: state.selectedBoard,
          boardLayouts: state.boardLayouts,
          blocklyWorkspaceJson: state.blocklyWorkspaceJson
        }
        window.api.project.autoSave(data)
      }
    }, 60000)

    // 3. Listen to Menu Actions
    const cleanup = window.api.onMenuAction(async (action: string) => {
      const state = useAppStore.getState()
      
      const getProjectData = () => ({
        projectName: state.projectName,
        savedFilePath: state.savedFilePath,
        selectedBoard: state.selectedBoard,
        boardLayouts: state.boardLayouts,
        blocklyWorkspaceJson: state.blocklyWorkspaceJson
      })

      if (action === 'new-project') {
        if (state.isDirty) {
          if (!window.confirm('You have unsaved changes. Are you sure you want to start a new project?')) {
            return
          }
        }
        state.resetProject()
        window.api.project.clearRecovery()
        state.setSaveStatus('New project started')
        setTimeout(() => state.setSaveStatus(null), 3000)
      } 
      
      else if (action === 'open-project') {
        if (state.isDirty) {
          if (!window.confirm('You have unsaved changes. Are you sure you want to open a different project?')) {
            return
          }
        }
        const result = await window.api.project.open()
        if (result && result.data) {
          state.loadProject({ ...result.data, savedFilePath: result.path })
          state.setSaveStatus(`Opened ${result.path}`)
          setTimeout(() => state.setSaveStatus(null), 3000)
          window.api.project.clearRecovery()
        }
      }
      
      else if (action.startsWith('open-recent|')) {
        if (state.isDirty) {
          if (!window.confirm('You have unsaved changes. Are you sure you want to open a different project?')) {
            return
          }
        }
        const path = action.split('|')[1]
        const result = await window.api.project.open(path)
        if (result && result.data) {
          state.loadProject({ ...result.data, savedFilePath: result.path })
          state.setSaveStatus(`Opened ${result.path}`)
          setTimeout(() => state.setSaveStatus(null), 3000)
          window.api.project.clearRecovery()
        }
      }
      
      else if (action === 'save-project') {
        const data = getProjectData()
        if (state.savedFilePath) {
          const result = await window.api.project.save(state.savedFilePath, data)
          if (result.success) {
            state.markClean()
            state.setSaveStatus(`Saved successfully`)
            setTimeout(() => state.setSaveStatus(null), 3000)
            window.api.project.clearRecovery()
          } else {
            alert(`Failed to save: ${result.error}`)
          }
        } else {
          // Fallback to Save As
          const result = await window.api.project.saveAs(data)
          if (result && result.success) {
            state.setSavedFilePath(result.path)
            const newName = result.path.split(/[\\/]/).pop()?.replace('.msl', '') || state.projectName
            state.setProjectName(newName)
            state.markClean()
            state.setSaveStatus(`Saved to ${result.path}`)
            setTimeout(() => state.setSaveStatus(null), 3000)
            window.api.project.clearRecovery()
          }
        }
      }
      
      else if (action === 'save-project-as') {
        const data = getProjectData()
        const result = await window.api.project.saveAs(data)
        if (result && result.success) {
          state.setSavedFilePath(result.path)
          const newName = result.path.split(/[\\/]/).pop()?.replace('.msl', '') || state.projectName
          state.setProjectName(newName)
          state.markClean()
          state.setSaveStatus(`Saved to ${result.path}`)
          setTimeout(() => state.setSaveStatus(null), 3000)
          window.api.project.clearRecovery()
        }
      }
      
      else if (action === 'export-ino') {
        if (!state.generatedCode) {
          alert('No Arduino code generated yet. Please add some blocks.')
          return
        }
        const result = await window.api.project.exportIno(state.generatedCode, state.projectName + '.ino')
        if (result && result.success) {
          state.setSaveStatus(`Exported to ${result.path}`)
          setTimeout(() => state.setSaveStatus(null), 3000)
        }
      }
    })

    return () => {
      clearInterval(interval)
      cleanup()
    }
  }, [])
}
