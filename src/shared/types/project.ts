/**
 * .edublock project file schema.
 * This is the top-level type for everything stored inside a saved project.
 * Fields are intentionally flat to make hand-editing simple and diffs clean.
 */
export interface EduBlockProject {
  /** Schema version — used to migrate old projects on open */
  version: string
  /** User-visible project name */
  projectName: string
  /** ISO 8601 timestamp of the last save */
  lastSaved: string
  /** Board identifier matching a BoardConfig.id */
  boardId: string

  /** Hardware canvas state */
  hardware: {
    /** Placed peripheral devices */
    devices: PlacedDevice[]
    /** Wires connecting pins */
    wires: WireConnection[]
  }

  /** Blockly workspace state — stored as Blockly JSON object */
  workspace: {
    blocks: Record<string, unknown>
  }
}

/**
 * A peripheral device that has been placed onto the hardware canvas.
 */
export interface PlacedDevice {
  /** Runtime-generated UUID — stable within one project session */
  id: string
  /** Peripheral type key matching a key in pinmap.json peripherals */
  type: string
  /** Resolved pin(s) assigned by the mapping engine */
  mappedPin: string | string[] | Record<string, string>
  /** Canvas X position (pixels) */
  canvasX: number
  /** Canvas Y position (pixels) */
  canvasY: number
}

/**
 * A wire connecting two pins on the hardware canvas.
 */
export interface WireConnection {
  id: string
  /** The board pin or component pin where the wire starts */
  sourceNodeId: string
  sourcePin: string
  /** The board pin or component pin where the wire ends */
  targetNodeId: string
  targetPin: string
  /** Optional hex color for the wire */
  color?: string
}

/**
 * Current schema version.
 * Bump this when making breaking changes to EduBlockProject.
 */
export const PROJECT_SCHEMA_VERSION = '1.0.0'
