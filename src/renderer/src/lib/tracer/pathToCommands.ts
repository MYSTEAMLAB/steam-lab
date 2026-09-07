// Turns a hand-drawn path into the timing-based drive commands the
// tracer_listen firmware block understands (see arduinoGenerator.ts's
// ensureTracerRuntime for the receiving side): "F:<ms>" drive straight,
// "T:<ms>" pivot-turn (positive right, negative left), "X" stop.
//
// There's no wheel-encoder feedback on this hardware, so distance and angle
// can only be approximated by how LONG a motor runs, not by measuring
// actual movement — this is open-loop dead reckoning. Real-world accuracy
// depends on the specific robot's weight, wheel grip, and battery level, so
// the two calibration numbers (ms per pixel, ms per degree) are exposed to
// the user rather than hardcoded — a robot that's driving is deep sound
// engineering, but the CONSTANTS turning "drew 40px" into "drive for how
// many ms" are physical properties of one specific chassis, not something
// the app can know in advance.

export interface Point {
  x: number
  y: number
}

export interface TracerCommand {
  kind: 'forward' | 'turn'
  /** Milliseconds to run the motors for. */
  ms: number
  /** For display only. */
  label: string
}

/** Ramer–Douglas–Peucker simplification — collapses a noisy freehand mouse
 * path down to its essential corners before converting to turn/forward
 * segments, so tiny hand tremor doesn't become dozens of spurious tiny
 * turns. */
export function simplifyPath(points: Point[], epsilon: number): Point[] {
  if (points.length < 3) return points

  const sqDistToSegment = (p: Point, a: Point, b: Point): number => {
    const dx = b.x - a.x
    const dy = b.y - a.y
    if (dx === 0 && dy === 0) {
      const ddx = p.x - a.x
      const ddy = p.y - a.y
      return ddx * ddx + ddy * ddy
    }
    const t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy)
    const clampedT = Math.max(0, Math.min(1, t))
    const projX = a.x + clampedT * dx
    const projY = a.y + clampedT * dy
    const ddx = p.x - projX
    const ddy = p.y - projY
    return ddx * ddx + ddy * ddy
  }

  let maxDist = 0
  let maxIndex = 0
  const first = points[0]
  const last = points[points.length - 1]
  for (let i = 1; i < points.length - 1; i++) {
    const dist = sqDistToSegment(points[i], first, last)
    if (dist > maxDist) {
      maxDist = dist
      maxIndex = i
    }
  }

  if (Math.sqrt(maxDist) > epsilon) {
    const left = simplifyPath(points.slice(0, maxIndex + 1), epsilon)
    const right = simplifyPath(points.slice(maxIndex), epsilon)
    return [...left.slice(0, -1), ...right]
  }
  return [first, last]
}

function normalizeAngleDeg(deg: number): number {
  let a = deg % 360
  if (a > 180) a -= 360
  if (a < -180) a += 360
  return a
}

export interface TracerCalibration {
  /** Milliseconds of forward drive per pixel of drawn distance. */
  msPerPixel: number
  /** Milliseconds of pivot-turn per degree of heading change. */
  msPerDegree: number
  /** Segments shorter than this many pixels are dropped as noise. */
  minSegmentPixels: number
}

export const DEFAULT_CALIBRATION: TracerCalibration = {
  msPerPixel: 8,
  msPerDegree: 6,
  minSegmentPixels: 6
}

export function pathToCommands(rawPoints: Point[], calibration: TracerCalibration): TracerCommand[] {
  const simplified = simplifyPath(rawPoints, 4)
  const commands: TracerCommand[] = []
  let prevHeading: number | null = null

  for (let i = 1; i < simplified.length; i++) {
    const a = simplified[i - 1]
    const b = simplified[i]
    const dx = b.x - a.x
    const dy = b.y - a.y
    const distance = Math.sqrt(dx * dx + dy * dy)
    if (distance < calibration.minSegmentPixels) continue

    const heading = (Math.atan2(dy, dx) * 180) / Math.PI

    if (prevHeading !== null) {
      const delta = normalizeAngleDeg(heading - prevHeading)
      const turnMs = Math.round(Math.abs(delta) * calibration.msPerDegree)
      if (turnMs > 30) {
        commands.push({
          kind: 'turn',
          ms: delta >= 0 ? turnMs : -turnMs,
          label: `Turn ${delta >= 0 ? 'right' : 'left'} (${Math.round(Math.abs(delta))}°)`
        })
      }
    }
    prevHeading = heading

    const forwardMs = Math.round(distance * calibration.msPerPixel)
    commands.push({ kind: 'forward', ms: forwardMs, label: `Forward ${Math.round(distance)}px` })
  }

  return commands
}

/** Wire-format line for one command, matching tracer_listen's parser. */
export function commandToWireLine(cmd: TracerCommand): string {
  const prefix = cmd.kind === 'forward' ? 'F' : 'T'
  return `${prefix}:${cmd.ms}`
}
