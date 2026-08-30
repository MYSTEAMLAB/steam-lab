import { FilesetResolver, GestureRecognizer } from '@mediapipe/tasks-vision'
import type { NormalizedLandmark } from '@mediapipe/tasks-vision'

// Bundled locally under public/ai-models — same offline-only rule as the
// image classifier's MobileNet weights. The WASM runtime and .task model
// are both fetched from the app's own origin, never a CDN.
const WASM_BASE_PATH = './ai-models/mediapipe-wasm'
const MODEL_PATH = './ai-models/gesture_recognizer/gesture_recognizer.task'

let recognizer: GestureRecognizer | null = null
let loadPromise: Promise<void> | null = null

export function loadGestureRecognizer(): Promise<void> {
  if (recognizer) return Promise.resolve()
  if (!loadPromise) {
    loadPromise = (async () => {
      const vision = await FilesetResolver.forVisionTasks(WASM_BASE_PATH)
      recognizer = await GestureRecognizer.createFromOptions(vision, {
        baseOptions: { modelAssetPath: MODEL_PATH },
        numHands: 1,
        runningMode: 'VIDEO'
      })
    })()
  }
  return loadPromise
}

export interface GestureResult {
  categoryName: string
  confidence: number // 0-100
  landmarks: NormalizedLandmark[]
}

/** The 7 real built-in categories (excludes the "no gesture" sentinel "None"). */
export const BUILTIN_GESTURES = [
  'Closed_Fist',
  'Open_Palm',
  'Pointing_Up',
  'Thumb_Down',
  'Thumb_Up',
  'Victory',
  'ILoveYou'
] as const

export function recognize(videoEl: HTMLVideoElement): GestureResult | null {
  if (!recognizer) return null
  const result = recognizer.recognizeForVideo(videoEl, performance.now())
  const topGesture = result.gestures[0]?.[0]
  if (!topGesture) return null
  return {
    categoryName: topGesture.categoryName,
    confidence: Math.round(topGesture.score * 100),
    landmarks: result.landmarks[0] ?? []
  }
}
