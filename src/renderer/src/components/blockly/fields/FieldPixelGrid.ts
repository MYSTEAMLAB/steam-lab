import * as Blockly from 'blockly/core'

// A clickable NxN pixel-art editor drawn directly on the block face, used by
// the LED Matrix "show LEDs" block — each cell toggles independently on
// click rather than opening a popup editor, matching the classic
// micro:bit/MakeCode "show leds" block this was modeled on. Value is stored
// as a flat '0'/'1' string, row-major, e.g. 36 chars for a 6x6 grid.
export class FieldPixelGrid extends Blockly.Field<string> {
  static readonly GRID_SIZE = 6
  static readonly CELL = 15
  static readonly GAP = 3
  static readonly PAD = 4

  private cellRects: SVGRectElement[] = []

  constructor(value?: string) {
    super(value ?? FieldPixelGrid.emptyValue())
    this.SERIALIZABLE = true
  }

  static emptyValue(): string {
    return '0'.repeat(FieldPixelGrid.GRID_SIZE * FieldPixelGrid.GRID_SIZE)
  }

  static fromJson(options: { pixels?: string }): FieldPixelGrid {
    return new FieldPixelGrid(options.pixels)
  }

  protected override doClassValidation_(newValue?: unknown): string {
    const n = FieldPixelGrid.GRID_SIZE * FieldPixelGrid.GRID_SIZE
    if (typeof newValue !== 'string' || newValue.length !== n || !/^[01]+$/.test(newValue)) {
      return FieldPixelGrid.emptyValue()
    }
    return newValue
  }

  override isClickable(): boolean {
    // Cell clicks are bound individually in initView() — the field itself
    // has no single-click "open editor" affordance.
    return false
  }

  protected override initView(): void {
    const { GRID_SIZE: n, CELL: cell, GAP: gap, PAD: pad } = FieldPixelGrid
    this.cellRects = []
    for (let row = 0; row < n; row++) {
      for (let col = 0; col < n; col++) {
        const idx = row * n + col
        const rect = Blockly.utils.dom.createSvgElement(
          'rect',
          {
            x: String(pad + col * (cell + gap)),
            y: String(pad + row * (cell + gap)),
            width: String(cell),
            height: String(cell),
            rx: '3',
            fill: this.fillFor(idx),
            stroke: 'rgba(0,0,0,0.25)',
            'stroke-width': '1'
          },
          this.fieldGroup_
        ) as SVGRectElement
        rect.style.cursor = 'pointer'
        Blockly.browserEvents.bind(rect, 'pointerdown', this, ((e: PointerEvent) => {
          e.stopPropagation()
          this.toggleCell(idx)
        }) as EventListener)
        this.cellRects.push(rect)
      }
    }
  }

  private fillFor(idx: number): string {
    const v = this.getValue() ?? FieldPixelGrid.emptyValue()
    return v[idx] === '1' ? '#facc15' : '#334155'
  }

  private toggleCell(idx: number): void {
    const current = (this.getValue() ?? FieldPixelGrid.emptyValue()).split('')
    current[idx] = current[idx] === '1' ? '0' : '1'
    this.setValue(current.join(''))
  }

  protected override doValueUpdate_(newValue: string): void {
    super.doValueUpdate_(newValue)
    // The base Field constructor calls setValue() (hence this) synchronously
    // during super(), before this subclass's own `cellRects = []` field
    // initializer has run — so cellRects can genuinely be undefined here on
    // the very first call, at construction time, before initView() exists.
    if (!this.cellRects) return
    for (let i = 0; i < this.cellRects.length; i++) {
      this.cellRects[i].setAttribute('fill', this.fillFor(i))
    }
  }

  protected override updateSize_(): void {
    const { GRID_SIZE: n, CELL: cell, GAP: gap, PAD: pad } = FieldPixelGrid
    const total = n * cell + (n - 1) * gap + pad * 2
    this.size_ = new Blockly.utils.Size(total, total)
  }
}

Blockly.fieldRegistry.register('field_pixelgrid', FieldPixelGrid)
