// OpenCV.js — bundled locally under public/ai-models/opencv/opencv.js, same offline-only rule
// as the other AI assets. Unlike MobileNet/MediaPipe this is a legacy global-script library (not
// an ES module), so it's loaded via an injected <script> tag and exposes a global `cv`.
declare global {
  interface Window {
    cv: any
  }
}

const SCRIPT_PATH = './ai-models/opencv/opencv.js'
const MIN_CONTOUR_AREA = 800 // px^2 — filters camera noise from the actual drawn shape

let ready = false
let loadPromise: Promise<void> | null = null
let workCanvas: HTMLCanvasElement | null = null

export function loadShapeDetector(): Promise<void> {
  if (ready) return Promise.resolve()
  if (!loadPromise) {
    loadPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script')
      script.src = SCRIPT_PATH
      script.async = true
      script.onload = () => {
        // WASM compilation is async even after the script itself has executed — the callback
        // must be attached before onRuntimeInitialized fires, per OpenCV.js's documented pattern.
        window.cv['onRuntimeInitialized'] = () => {
          ready = true
          resolve()
        }
      }
      script.onerror = () => reject(new Error('[shapeDetector] Failed to load opencv.js'))
      document.body.appendChild(script)
    })
  }
  return loadPromise
}

export interface DetectedShape {
  shapeName: string // 'Triangle' | 'Square' | 'Rectangle' | 'Pentagon' | 'Star' | 'Circle'
  confidence: number // 0-100
  contour: { x: number; y: number }[] // simplified polygon points, for overlay drawing
  boundingBox: { x: number; y: number; width: number; height: number }
}

export const SHAPE_LABELS = ['Triangle', 'Square', 'Rectangle', 'Pentagon', 'Star', 'Circle'] as const

/**
 * Contour detection + polygon classification, sorted most-confident first.
 * Assumes a dark shape/marker on a lighter background (paper, whiteboard).
 */
export function detectShapes(videoEl: HTMLVideoElement): DetectedShape[] {
  if (!ready || !videoEl.videoWidth) return []
  const cv = window.cv

  if (!workCanvas) workCanvas = document.createElement('canvas')
  if (workCanvas.width !== videoEl.videoWidth || workCanvas.height !== videoEl.videoHeight) {
    workCanvas.width = videoEl.videoWidth
    workCanvas.height = videoEl.videoHeight
  }
  const ctx = workCanvas.getContext('2d')
  if (!ctx) return []
  ctx.drawImage(videoEl, 0, 0, workCanvas.width, workCanvas.height)

  const src = cv.imread(workCanvas)
  const gray = new cv.Mat()
  const blurred = new cv.Mat()
  const thresh = new cv.Mat()
  const contours = new cv.MatVector()
  const hierarchy = new cv.Mat()
  const results: DetectedShape[] = []

  try {
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY)
    cv.GaussianBlur(gray, blurred, new cv.Size(5, 5), 0)
    cv.adaptiveThreshold(
      blurred, thresh, 255,
      cv.ADAPTIVE_THRESH_GAUSSIAN_C, cv.THRESH_BINARY_INV, 11, 3
    )
    cv.findContours(thresh, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE)

    for (let i = 0; i < contours.size(); i++) {
      const contour = contours.get(i)
      const area = cv.contourArea(contour)
      if (area < MIN_CONTOUR_AREA) {
        contour.delete()
        continue
      }

      const perimeter = cv.arcLength(contour, true)
      const approx = new cv.Mat()
      cv.approxPolyDP(contour, approx, 0.03 * perimeter, true)

      const vertexCount = approx.rows
      const rect = cv.boundingRect(contour)
      const circularity = perimeter > 0 ? (4 * Math.PI * area) / (perimeter * perimeter) : 0
      const isConvex = cv.isContourConvex(approx)

      let shapeName = ''
      let confidence = 0

      if (circularity > 0.82) {
        shapeName = 'Circle'
        confidence = Math.round(Math.min(1, circularity) * 100)
      } else if (vertexCount === 3) {
        shapeName = 'Triangle'
        confidence = 90
      } else if (vertexCount === 4) {
        const aspect = rect.width / rect.height
        shapeName = aspect > 0.85 && aspect < 1.15 ? 'Square' : 'Rectangle'
        confidence = 88
      } else if (vertexCount === 5) {
        shapeName = 'Pentagon'
        confidence = 85
      } else if (!isConvex && vertexCount >= 8 && vertexCount <= 12) {
        shapeName = 'Star'
        confidence = 80
      }

      if (shapeName) {
        const points: { x: number; y: number }[] = []
        for (let r = 0; r < approx.rows; r++) {
          points.push({ x: approx.data32S[r * 2], y: approx.data32S[r * 2 + 1] })
        }
        results.push({
          shapeName,
          confidence,
          contour: points,
          boundingBox: { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
        })
      }

      approx.delete()
      contour.delete()
    }
  } finally {
    src.delete()
    gray.delete()
    blurred.delete()
    thresh.delete()
    contours.delete()
    hierarchy.delete()
  }

  return results.sort((a, b) => b.confidence - a.confidence)
}
