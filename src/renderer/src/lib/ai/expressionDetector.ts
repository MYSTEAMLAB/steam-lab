import * as faceapi from 'face-api.js'
export { EXPRESSION_LABELS } from './expressionLabels'

// Bundled locally under public/ai-models/face-api — same offline-only rule as the other AI
// assets. Two small nets: TinyFaceDetector (locates the face) + FaceExpressionNet (classifies
// it into 7 trained expression categories) — unlike Shape Detection's heuristics, this is a
// real classifier trained specifically on facial expressions.
const MODEL_PATH = './ai-models/face-api'

let ready = false
let loadPromise: Promise<void> | null = null

export function loadExpressionDetector(): Promise<void> {
  if (ready) return Promise.resolve()
  if (!loadPromise) {
    loadPromise = Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_PATH),
      faceapi.nets.faceExpressionNet.loadFromUri(MODEL_PATH)
    ]).then(() => {
      ready = true
    })
  }
  return loadPromise
}

export interface DetectedExpression {
  expression: string // 'Neutral' | 'Happy' | 'Sad' | 'Angry' | 'Fearful' | 'Disgusted' | 'Surprised'
  confidence: number // 0-100
  boundingBox: { x: number; y: number; width: number; height: number }
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

/**
 * Detection + classification is async here (unlike gestureRecognizer/objectDetector/shapeDetector),
 * so callers must guard against overlapping calls on a slow frame rather than firing another
 * detectExpression() before the previous one resolves.
 */
export async function detectExpression(videoEl: HTMLVideoElement): Promise<DetectedExpression | null> {
  if (!ready || !videoEl.videoWidth) return null
  const result = await faceapi
    .detectSingleFace(videoEl, new faceapi.TinyFaceDetectorOptions())
    .withFaceExpressions()
  if (!result) return null

  const top = result.expressions.asSortedArray()[0]
  const box = result.detection.box
  return {
    expression: capitalize(top.expression),
    confidence: Math.round(top.probability * 100),
    boundingBox: { x: box.x, y: box.y, width: box.width, height: box.height }
  }
}
