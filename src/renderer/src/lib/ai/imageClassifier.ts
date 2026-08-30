import * as tf from '@tensorflow/tfjs'
import * as mobilenet from '@tensorflow-models/mobilenet'
import * as knnClassifier from '@tensorflow-models/knn-classifier'

// Bundled locally under public/ai-models — see plan for why this must stay local
// (offline-only, no CDN fetch at runtime).
const MODEL_URL = './ai-models/mobilenet/model.json'

let net: mobilenet.MobileNet | null = null
let loadPromise: Promise<void> | null = null
const classifier = knnClassifier.create()

export function loadMobileNet(): Promise<void> {
  if (net) return Promise.resolve()
  if (!loadPromise) {
    loadPromise = mobilenet.load({
      version: 2,
      alpha: 1.0,
      modelUrl: MODEL_URL,
      // This specific bundled MobileNetV2 variant expects pixels normalized to
      // [0, 1] — omitting this makes the wrapper default to [-1, 1], which
      // silently degrades embedding quality rather than erroring.
      inputRange: [0, 1]
    }).then((loaded) => {
      net = loaded
    })
  }
  return loadPromise
}

function embed(videoEl: HTMLVideoElement): tf.Tensor {
  if (!net) throw new Error('[imageClassifier] MobileNet not loaded yet — call loadMobileNet() first')
  return tf.tidy(() => net!.infer(videoEl, true))
}

export function addExample(videoEl: HTMLVideoElement, className: string): void {
  const activation = embed(videoEl)
  classifier.addExample(activation, className)
  activation.dispose()
}

export interface Prediction {
  className: string
  confidence: number // 0-100
}

export async function predict(videoEl: HTMLVideoElement): Promise<Prediction | null> {
  if (classifier.getNumClasses() === 0) return null
  const activation = embed(videoEl)
  const result = await classifier.predictClass(activation)
  activation.dispose()
  const confidence = result.confidences[result.label] ?? 0
  return { className: result.label, confidence: Math.round(confidence * 100) }
}

export function getClassCounts(): Record<string, number> {
  return classifier.getClassExampleCount()
}

/** Dropdown options for Blockly's "AI: Predicted Class = ..." block. */
export function getTrainedClassNames(): [string, string][] {
  const names = Object.keys(getClassCounts())
  if (names.length === 0) return [['No classes trained', '']]
  return names.map(n => [n, n])
}

export function hasClasses(): boolean {
  return classifier.getNumClasses() > 0
}

export function clearClass(className: string): void {
  classifier.clearClass(className)
}

export function clearAllClasses(): void {
  classifier.clearAllClasses()
}
