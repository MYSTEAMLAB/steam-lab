import * as Blockly from 'blockly/core'

/**
 * Serializes the given Blockly workspace into a plain JSON object.
 * Returns null if the workspace has no blocks or is empty.
 */
export function serializeWorkspace(workspace: Blockly.WorkspaceSvg): Record<string, any> | null {
  try {
    const state = Blockly.serialization.workspaces.save(workspace)
    // If the state has no blocks, treat as null or empty
    if (!state || !state.blocks || !state.blocks.blocks || state.blocks.blocks.length === 0) {
      return null
    }
    return state
  } catch (err) {
    console.error('[Blockly Serialization] Failed to save workspace:', err)
    return null
  }
}

/**
 * Restores a Blockly workspace state from a plain JSON object.
 */
export function deserializeWorkspace(state: Record<string, any> | null, workspace: Blockly.WorkspaceSvg): boolean {
  if (!state) {
    workspace.clear()
    return true
  }
  try {
    Blockly.serialization.workspaces.load(state, workspace)
    return true
  } catch (err) {
    console.error('[Blockly Deserialization] Failed to load workspace:', err)
    return false
  }
}
