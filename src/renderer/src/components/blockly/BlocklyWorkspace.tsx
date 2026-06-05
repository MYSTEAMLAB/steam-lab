import React, { useEffect, useRef } from 'react'
import * as Blockly from 'blockly/core'
import 'blockly/blocks' // Import standard Blockly blocks
import * as En from 'blockly/msg/en' // Import English message bundle

import { customTheme } from './theme/customTheme'
import { registerCustomBlocks } from './blocks/customBlocks'
import { generateToolboxJson } from './toolbox/toolboxGenerator'
import { serializeWorkspace, deserializeWorkspace } from './utils/workspaceUtils'
import { useAppStore } from '../../store/useAppStore'

Blockly.setLocale(En as any)
registerCustomBlocks()

export const BlocklyWorkspace: React.FC = () => {
  const blocklyDivRef = useRef<HTMLDivElement>(null)
  const workspaceRef = useRef<Blockly.WorkspaceSvg | null>(null)

  const selectedBoard = useAppStore(s => s.selectedBoard)
  const boardLayouts = useAppStore(s => s.boardLayouts)
  const blocklyWorkspaceJson = useAppStore(s => s.blocklyWorkspaceJson)
  const setBlocklyWorkspaceJson = useAppStore(s => s.setBlocklyWorkspaceJson)
  const setPromptConfig = useAppStore(s => s.setPromptConfig)

  const placedDevices = selectedBoard ? (boardLayouts[selectedBoard.id]?.devices || []) : []

  // Initialize custom prompt to bypass Electron's restriction on window.prompt
  // This must be set before any workspace injection to avoid the "prompt() is not supported" error
  useEffect(() => {
    Blockly.dialog.setPrompt(function(message, defaultValue, callback) {
      setPromptConfig({
        isOpen: true,
        message,
        defaultValue,
        callback
      })
    })
  }, [setPromptConfig])

  useEffect(() => {
    if (!blocklyDivRef.current) return
    // FIX 1: Aggressive cleanup. React 18 StrictMode unmounts/remounts components instantly.
    // If we don't manually clear the div, Blockly injects a SECOND overlapping SVG.
    // The first one becomes an orphaned, unmanaged layer with stuck scrollbars.
    blocklyDivRef.current.innerHTML = ''

    const toolbox = generateToolboxJson(selectedBoard, placedDevices)

    const workspace = Blockly.inject(blocklyDivRef.current, {
      toolbox: toolbox as any,
      theme: customTheme,
      renderer: 'geras',
      media: 'media/',
      grid: {
        spacing: 24,
        length: 3,
        colour: '#334155',
        snap: true
      },
      zoom: {
        controls: true,
        wheel: true,
        startScale: 1.0,
        maxScale: 2.0,
        minScale: 0.5,
        scaleSpeed: 1.2
      },
      trashcan: true,
      move: {
        scrollbars: {
          horizontal: true,
          vertical: true
        },
        drag: true,
        wheel: false
      }
    })

    workspaceRef.current = workspace

    workspace.registerButtonCallback('createVariableCallback', (button) => {
      Blockly.Variables.createVariableButtonHandler(button.getTargetWorkspace() as Blockly.WorkspaceSvg)
    })

    workspace.registerToolboxCategoryCallback('MY_VARIABLES', (ws) => {
      const variableModelList = ws.getAllVariables()
      const blockList: any[] = []

      blockList.push({
        kind: 'button',
        text: 'Create variable...',
        callbackKey: 'createVariableCallback'
      })

      blockList.push({ kind: 'block', type: 'declare_variable' })
      blockList.push({ kind: 'block', type: 'variables_set' })
      blockList.push({ kind: 'block', type: 'variables_get' })
      blockList.push({ kind: 'block', type: 'math_change' })

      if (variableModelList.length > 0) {
        blockList.push({
          kind: 'label',
          text: 'Created Variables:',
          'web-class': 'blocklyFlyoutLabel'
        })
        
        variableModelList.forEach((variable) => {
          const v = variable as any
          blockList.push({
            kind: 'block',
            type: 'variables_get',
            fields: {
              VAR: {
                id: v.getId(),
                name: v.name,
                type: v.type
              }
            }
          })
        })
      }

      return blockList
    })

    if (blocklyWorkspaceJson && Object.keys(blocklyWorkspaceJson).length > 0) {
      deserializeWorkspace(blocklyWorkspaceJson, workspace)
    } else {
      // Pre-populate empty workspace with Setup and Loop blocks
      const setupBlock = workspace.newBlock('system_setup')
      setupBlock.moveBy(50, 50)
      setupBlock.initSvg()
      setupBlock.render()

      const loopBlock = workspace.newBlock('system_loop')
      loopBlock.moveBy(50, 250)
      loopBlock.initSvg()
      loopBlock.render()
    }

    let saveTimeoutId: NodeJS.Timeout | null = null

    const handleWorkspaceChange = (event: Blockly.Events.Abstract): void => {
      if (event.isUiEvent) return

      // --- Orphaned Block Validation ---
      // Warn users if they place blocks outside Setup/Loop
      if (event.type === Blockly.Events.BLOCK_MOVE || event.type === Blockly.Events.BLOCK_CREATE || event.type === Blockly.Events.BLOCK_CHANGE) {
        const allBlocks = workspace.getAllBlocks(false)
        allBlocks.forEach((block: any) => {
          const rootBlock = block.getRootBlock()
          const allowedRootBlocks = ['system_setup', 'system_loop', 'procedures_defnoreturn', 'procedures_defreturn']
          
          if (!allowedRootBlocks.includes(rootBlock.type)) {
            if (!block.__orphanWarningActive) {
              block.setWarningText('WARNING: This block is orphaned! It must be placed inside a Setup or Loop block to generate code.')
              block.__orphanWarningActive = true
            }
          } else {
            // Block is validly connected to a setup/loop block. Clear the warning.
            if (block.__orphanWarningActive) {
              block.setWarningText(null)
              block.__orphanWarningActive = false
            }
          }
        })
      }

      if (saveTimeoutId) clearTimeout(saveTimeoutId)

      saveTimeoutId = setTimeout(() => {
        const state = serializeWorkspace(workspace)
        setBlocklyWorkspaceJson(state)
      }, 500)
    }

    workspace.addChangeListener(handleWorkspaceChange)

    // FIX 2: Blockly calculates scrollbar positions on resize.
    // If the flexbox parent hasn't finished painting, it positions the scrollbar in the middle of the screen.
    const resizeObserver = new ResizeObserver(() => {
      if (workspace) {
        window.requestAnimationFrame(() => {
          Blockly.svgResize(workspace)
        })
      }
    })

    if (blocklyDivRef.current.parentElement) {
      resizeObserver.observe(blocklyDivRef.current.parentElement)
    }

    // Force an immediate resize after a short delay to guarantee initial layout is caught
    setTimeout(() => {
      if (workspace) Blockly.svgResize(workspace)
    }, 100)

    // Expose for E2E tests
    if (typeof window !== 'undefined') {
      ;(window as any).blocklyWorkspace = workspace
      ;(window as any).Blockly = Blockly
    }

    return () => {
      if (saveTimeoutId) clearTimeout(saveTimeoutId)
      workspace.removeChangeListener(handleWorkspaceChange)
      resizeObserver.disconnect()
      workspace.dispose()
      workspaceRef.current = null
      
      // Complete cleanup
      if (blocklyDivRef.current) {
        blocklyDivRef.current.innerHTML = ''
      }
    }
  }, [selectedBoard]) // Only remount when the board completely changes

  // ── Dynamic Toolbox Synchronization ───────────────────────────────────────
  useEffect(() => {
    if (workspaceRef.current) {
      // Regenerate toolbox based on the active canvas devices
      const toolbox = generateToolboxJson(selectedBoard, placedDevices)
      workspaceRef.current.updateToolbox(toolbox as any)
    }
  }, [placedDevices, selectedBoard])

  return (
    <div
      ref={blocklyDivRef}
      className="absolute inset-0 w-full h-full overflow-hidden"
      id="blockly-editor-canvas"
    />
  )
}
