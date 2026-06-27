import type { BoardSummary } from '@shared/types/board'
import type { PlacedDevice } from '@shared/types/project'

/**
 * Dynamically generates the modern JSON category toolbox for Blockly.
 * Applies the custom Scratch-inspired category styles.
 * 
 * 100% STATIC STRUCTURE: All blocks and categories are permanently visible
 * regardless of hardware assignment to match My Steam Lab spec.
 */
export function generateToolboxJson(selectedBoard: BoardSummary | null, devices: PlacedDevice[]): Record<string, any> {
  const contents: any[] = [
    // ── 1. Logic ──────────────────────────────────────────────────────────
    {
      kind: 'category',
      name: 'Logic',
      categorystyle: 'logic_category',
      contents: [
        { kind: 'block', type: 'controls_if' },
        { kind: 'block', type: 'logic_compare' },
        { kind: 'block', type: 'logic_operation' },
        { kind: 'block', type: 'logic_double_equals' },
        { kind: 'block', type: 'logic_and_text' },
        { kind: 'block', type: 'logic_negate' },
        { kind: 'block', type: 'logic_boolean' }
      ]
    },

    // ── 2. Loops ──────────────────────────────────────────────────────────
    {
      kind: 'category',
      name: 'Loops',
      categorystyle: 'loop_category',
      contents: [
        { kind: 'block', type: 'controls_repeat_ext' },
        { kind: 'block', type: 'controls_whileUntil' },
        { kind: 'block', type: 'controls_forever' },
        { kind: 'block', type: 'controls_for' }
      ]
    },

    // ── 3. Math ───────────────────────────────────────────────────────────
    {
      kind: 'category',
      name: 'Math',
      categorystyle: 'math_category',
      contents: [
        { kind: 'block', type: 'math_number' },
        { kind: 'block', type: 'math_arithmetic' },
        { kind: 'block', type: 'math_modulo' },
        { kind: 'block', type: 'math_random_int' },
        { kind: 'block', type: 'math_single' },
        { kind: 'block', type: 'math_constrain' },
        { kind: 'block', type: 'math_round' }
      ]
    },

    // ── 4. Pin I/O ────────────────────────────────────────────────────────
    {
      kind: 'category',
      name: 'Pin I/O',
      categorystyle: 'input_category',
      contents: [
        { kind: 'block', type: 'output_digital_write' },
        { kind: 'block', type: 'input_digital_read' },
        { kind: 'block', type: 'pin_mode' },
        { kind: 'block', type: 'input_analog_read' },
        { kind: 'block', type: 'output_analog_write' }
      ]
    },

    // ── 5. Motors ─────────────────────────────────────────────────────────
    {
      kind: 'category',
      name: 'Motors',
      categorystyle: 'output_category',
      contents: [
        { kind: 'block', type: 'output_dcmotor_set' },
        { kind: 'block', type: 'output_dcmotor_speed' },
        { kind: 'block', type: 'output_servo_write' }
      ]
    },

    // ── 6. Sensors ────────────────────────────────────────────────────────
    {
      kind: 'category',
      name: 'Sensors',
      categorystyle: 'input_category',
      contents: [
        { kind: 'block', type: 'input_potentiometer_read' },
        { kind: 'block', type: 'input_button_read' },
        { kind: 'block', type: 'input_button_pressed' },
        { kind: 'block', type: 'input_ldr_read' },
        { kind: 'block', type: 'input_ldr_is_dark' },
        { kind: 'block', type: 'input_ir_read' },
        { kind: 'block', type: 'input_ir_analog_read' },
        { kind: 'block', type: 'input_temp_read' },
        { kind: 'block', type: 'input_temp_is_hot' },
        { kind: 'block', type: 'input_ultrasonic_read' },
        { kind: 'block', type: 'input_touch_read' },
        { kind: 'block', type: 'input_touch_raw' },
        { kind: 'block', type: 'input_color_read' }
      ]
    },

    // ── 7. Joystick ───────────────────────────────────────────────────────
    {
      kind: 'category',
      name: 'Joystick',
      categorystyle: 'input_category',
      contents: [
        { kind: 'block', type: 'input_joystick1_read' },
        { kind: 'block', type: 'input_joystick2_read' }
      ]
    },

    // ── 8. Communication ──────────────────────────────────────────────────
    {
      kind: 'category',
      name: 'Communication',
      categorystyle: 'wifi_category',
      contents: [
        { kind: 'label', text: 'Serial' },
        { kind: 'block', type: 'serial_print' },
        { kind: 'label', text: 'Bluetooth' },
        { kind: 'block', type: 'bluetooth_begin' },
        { kind: 'block', type: 'bluetooth_send' },
        { kind: 'block', type: 'bluetooth_read' },
        { kind: 'block', type: 'bluetooth_available' },
        { kind: 'label', text: 'WiFi' },
        { kind: 'block', type: 'wifi_connect' },
        { kind: 'block', type: 'wifi_status' },
        { kind: 'block', type: 'wifi_get_ip' },
        { kind: 'block', type: 'wifi_http_request' }
      ]
    },

    // ── 9. OLED Display ───────────────────────────────────────────────────
    {
      kind: 'category',
      name: 'OLED Display',
      categorystyle: 'system_category',
      contents: [
        { kind: 'block', type: 'oled_init' },
        { kind: 'block', type: 'oled_print' },
        { kind: 'block', type: 'oled_show_var' },
        { kind: 'block', type: 'oled_show_char' },
        { kind: 'block', type: 'oled_blink' },
        { kind: 'block', type: 'oled_scroll' },
        { kind: 'block', type: 'oled_color' },
        { kind: 'block', type: 'oled_draw_text' },
        { kind: 'block', type: 'oled_set_cursor' },
        { kind: 'block', type: 'oled_clear' }
      ]
    },

    // ── 10. Time ──────────────────────────────────────────────────────────
    {
      kind: 'category',
      name: 'Time',
      categorystyle: 'system_category',
      contents: [
        { kind: 'block', type: 'system_delay' }
      ]
    },

    // ── 11. My Program ────────────────────────────────────────────────────
    {
      kind: 'category',
      name: 'My Program',
      categorystyle: 'system_category',
      contents: [
        { kind: 'block', type: 'system_setup' },
        { kind: 'block', type: 'system_loop' },
        { kind: 'block', type: 'my_program_block' }
      ]
    },

    // ── 12. Text ──────────────────────────────────────────────────────────
    {
      kind: 'category',
      name: 'Text',
      categorystyle: 'text_category',
      contents: [
        { kind: 'block', type: 'text' },
        { kind: 'block', type: 'text_print' },
        { kind: 'block', type: 'text_join' }
      ]
    },

    // ── 13. Variables ─────────────────────────────────────────────────────
    {
      kind: 'category',
      name: 'Variables',
      categorystyle: 'variable_category',
      custom: 'VARIABLE'
    },

    // ── 14. Functions ─────────────────────────────────────────────────────
    {
      kind: 'category',
      name: 'Functions',
      categorystyle: 'procedure_category',
      custom: 'PROCEDURE'
    }
  ]

  return {
    kind: 'categoryToolbox',
    contents
  }
}
