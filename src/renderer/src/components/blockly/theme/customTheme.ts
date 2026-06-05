import * as Blockly from 'blockly/core'

/**
 * Scratch-inspired custom Blockly theme.
 * Integrates Scratch colors for all toolbox categories and blocks.
 * Sets the layout colors to complement the dark theme of the EduBlocks Studio IDE.
 */
export const customTheme = Blockly.Theme.defineTheme('scratch-dark', {
  name: 'scratch-dark',
  base: Blockly.Themes.Classic,
  blockStyles: {
    logic_blocks: {
      colourPrimary: '#4C97FF', // Logic blue
      colourSecondary: '#3373CC',
      colourTertiary: '#2E66B3'
    },
    loop_blocks: {
      colourPrimary: '#0FBD8C', // Loops green
      colourSecondary: '#0DA57A',
      colourTertiary: '#0B8E69'
    },
    math_blocks: {
      colourPrimary: '#59C059', // Math light green
      colourSecondary: '#46A846',
      colourTertiary: '#3E963E'
    },
    variable_blocks: {
      colourPrimary: '#FF8C1A', // Variables orange
      colourSecondary: '#DB7300',
      colourTertiary: '#BF6500'
    },
    input_blocks: {
      colourPrimary: '#FF6680', // Input pink/red
      colourSecondary: '#E64D66',
      colourTertiary: '#CC4059'
    },
    output_blocks: {
      colourPrimary: '#9966FF', // Output violet/purple
      colourSecondary: '#8552E6',
      colourTertiary: '#7547CC'
    },
    wifi_blocks: {
      colourPrimary: '#FFAB19', // WiFi yellow/amber
      colourSecondary: '#D89115',
      colourTertiary: '#BE7F13'
    },
    system_blocks: {
      colourPrimary: '#FF661A', // System reddish orange
      colourSecondary: '#E65C17',
      colourTertiary: '#CC5214'
    }
  },
  categoryStyles: {
    logic_category: { colour: '#4C97FF' },
    loop_category: { colour: '#0FBD8C' },
    math_category: { colour: '#59C059' },
    variable_category: { colour: '#FF8C1A' },
    input_category: { colour: '#FF6680' },
    output_category: { colour: '#9966FF' },
    wifi_category: { colour: '#FFAB19' },
    system_category: { colour: '#FF661A' }
  },
  componentStyles: {
    // Compliments the dark mode theme tokens in our design system
    workspaceBackgroundColour: '#162035', // Match tailwind bg-surface-200
    toolboxBackgroundColour: '#0f172a',    // Match tailwind bg-surface-DEFAULT
    flyoutBackgroundColour: '#1e293b',     // Match tailwind bg-surface-50
    flyoutForegroundColour: '#cbd5e1',           // text-slate-300
    scrollbarColour: '#2d3f5e',            // Match our panel-border
    insertionMarkerColour: '#a855f7',
    insertionMarkerOpacity: 0.3
  }
})
