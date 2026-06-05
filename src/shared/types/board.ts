/**
 * Board capability flags.
 * Used to filter Blockly toolbox categories and code generator templates.
 */
export type BoardCapability =
  | 'DIGITAL_IO'
  | 'ANALOG_IN'
  | 'ANALOG_OUT'   // DAC
  | 'PWM'
  | 'I2C'
  | 'SPI'
  | 'UART'
  | 'WIFI'
  | 'BLUETOOTH'
  | 'TOUCH'

/**
 * A single pin entry in pinmap.json.
 */
export interface PinDefinition {
  /** Canonical pin name (e.g. "GPIO34", "A0", "D13") */
  name: string
  /** True if this pin is hardware-limited to input only (e.g. ESP32 GPIO34/35) */
  inputOnly: boolean
  /** Interfaces this pin supports */
  interfaces: PinInterface[]
  /** Human-readable label shown in the hardware canvas */
  label?: string
}

export type PinInterface =
  | 'DIGITAL_IN'
  | 'DIGITAL_OUT'
  | 'ANALOG_IN'
  | 'ANALOG_OUT'
  | 'PWM'
  | 'I2C_SDA'
  | 'I2C_SCL'
  | 'SPI_MOSI'
  | 'SPI_MISO'
  | 'SPI_SCK'
  | 'TOUCH'
  | 'UART_TX'
  | 'UART_RX'

/**
 * Peripheral slot in pinmap.json.
 * Defines how a peripheral maps to physical pins on a given board.
 */
export interface PeripheralMapping {
  /** Input, output, i2c bus, motor driver, etc. */
  type: 'input' | 'output' | 'i2c' | 'motor' | 'spi'
  /**
   * Preferred pin(s).
   * - Single string for one-pin peripherals (LDR → "GPIO35")
   * - Array for multi-pin peripherals (Motor Driver → ["GPIO16","GPIO17","GPIO18","GPIO19"])
   * - Object for named-bus peripherals (OLED → { sda: "GPIO21", scl: "GPIO22" })
   */
  preferredPin: string | string[] | Record<string, string>
  /** Compatible PinInterface types */
  compat: PinInterface[]
}

/**
 * Full pinmap.json schema.
 */
export interface PinMap {
  pins: Record<string, PinDefinition>
  peripherals: Record<string, PeripheralMapping>
}

/**
 * Board visual pin coordinate for the hardware canvas.
 * (x, y) in SVG/canvas pixels relative to the board image top-left corner.
 */
export interface PinCoordinate {
  x: number
  y: number
}

/**
 * Full board-config.json schema.
 * This is the primary BAL configuration file.
 */
export interface BoardConfig {
  /** Unique machine identifier — must match the folder name */
  id: string
  /** Human-readable board name */
  name: string
  /** Short description shown in the board selector */
  description: string
  /** arduino-cli Fully Qualified Board Name */
  fqbn: string
  /** arduino-cli core to install (e.g. "esp32:esp32", "arduino:avr") */
  coreRequired: string
  /** Path to the board SVG image (relative to src/renderer/src/assets/boards/) */
  boardImage: string
  /** Canvas dimensions matching the SVG viewport */
  dimensions: { width: number; height: number }
  /** Pixel coordinates of each pin label on the board SVG */
  pinCoordinates: Record<string, PinCoordinate>
  /** Feature flags — drives toolbox filtering and code gen template selection */
  capabilities: BoardCapability[]
}

/**
 * Lightweight board summary sent from main → renderer via IPC.
 * Only contains data needed for the BoardSelector UI and store initialization.
 */
export interface BoardSummary {
  id: string
  name: string
  description: string
  fqbn: string
  capabilities: BoardCapability[]
}

/**
 * Full registered board object used inside the main process and shared board registry.
 */
export type RegisteredBoard = BoardConfig
