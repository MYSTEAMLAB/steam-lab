import React, { useEffect, useRef } from 'react'
import * as Blockly from 'blockly/core'
import { useAppStore } from '@renderer/store/useAppStore'
import { generateFullArduinoCode } from './arduinoGenerator'

/**
 * A headless component that watches the global store and instantly 
 * regenerates Arduino code anytime blocks, boards, or hardware change.
 */
export const GeneratorObserver: React.FC = () => {
  const selectedBoard = useAppStore(s => s.selectedBoard)
  const blocklyWorkspaceJson = useAppStore(s => s.blocklyWorkspaceJson)
  const boardLayouts = useAppStore(s => s.boardLayouts)
  
  const setGeneratedCode = useAppStore(s => s.setGeneratedCode)
  const setWarnings = useAppStore(s => s.setWarnings)
  
  const previousCodeRef = useRef<string>('')

  useEffect(() => {
    if (!selectedBoard) {
      setGeneratedCode('// Select a board to generate code.')
      return
    }
    
    const boardId = selectedBoard.id
    const layout = boardLayouts[boardId]
    const devices = layout?.devices || []
    
    // Spin up a fast, invisible headless workspace
    const headlessWorkspace = new Blockly.Workspace()
    
    try {
      if (blocklyWorkspaceJson) {
        Blockly.serialization.workspaces.load(blocklyWorkspaceJson, headlessWorkspace)
      }
      
      const { code, warnings } = generateFullArduinoCode(headlessWorkspace, devices, boardId)
      
      // Only update store if code changed (prevents infinite re-renders if something binds to generatedCode)
      if (code !== previousCodeRef.current) {
        setGeneratedCode(code)
        previousCodeRef.current = code
      }
      
      setWarnings(warnings)
      
    } catch (err) {
      console.error('[GeneratorObserver] Code generation failed:', err)
      setWarnings(['Compiler Error: Code generation failed. Check console.'])
    } finally {
      // ALWAYS dispose to prevent memory leaks!
      headlessWorkspace.dispose()
    }
    
  }, [selectedBoard, blocklyWorkspaceJson, boardLayouts, setGeneratedCode, setWarnings])

  return null
}
