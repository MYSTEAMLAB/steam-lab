import { FilesetResolver, ObjectDetector } from '@mediapipe/tasks-vision'

// Reuses the SAME bundled WASM runtime as the gesture recognizer (both are
// generic @mediapipe/tasks-vision tasks) — only the model file below is new.
const WASM_BASE_PATH = './ai-models/mediapipe-wasm'
const MODEL_PATH = './ai-models/object_detector/efficientdet_lite0.tflite'

let detector: ObjectDetector | null = null
let loadPromise: Promise<void> | null = null

export function loadObjectDetector(): Promise<void> {
  if (detector) return Promise.resolve()
  if (!loadPromise) {
    loadPromise = (async () => {
      const vision = await FilesetResolver.forVisionTasks(WASM_BASE_PATH)
      detector = await ObjectDetector.createFromOptions(vision, {
        baseOptions: { modelAssetPath: MODEL_PATH },
        scoreThreshold: 0.5,
        maxResults: 5,
        runningMode: 'VIDEO'
      })
    })()
  }
  return loadPromise
}

export interface DetectedObject {
  categoryName: string
  confidence: number // 0-100
  boundingBox: { x: number; y: number; width: number; height: number } // pixel coords in video space
}

/** All detections this frame, most confident first. Empty array if nothing crosses scoreThreshold. */
export function detectObjects(videoEl: HTMLVideoElement): DetectedObject[] {
  if (!detector) return []
  const result = detector.detectForVideo(videoEl, performance.now())
  return result.detections
    .map(d => {
      const top = d.categories[0]
      if (!top) return null
      const box = d.boundingBox
      return {
        categoryName: top.categoryName,
        confidence: Math.round(top.score * 100),
        boundingBox: box
          ? { x: box.originX, y: box.originY, width: box.width, height: box.height }
          : { x: 0, y: 0, width: 0, height: 0 }
      }
    })
    .filter((d): d is DetectedObject => d !== null)
    .sort((a, b) => b.confidence - a.confidence)
}

/** The 80 COCO categories EfficientDet-Lite0 was trained on — fixed, for the static Blockly dropdown. */
export const COCO_LABELS = [
  'person', 'bicycle', 'car', 'motorcycle', 'airplane', 'bus', 'train', 'truck', 'boat',
  'traffic light', 'fire hydrant', 'stop sign', 'parking meter', 'bench', 'bird', 'cat', 'dog',
  'horse', 'sheep', 'cow', 'elephant', 'bear', 'zebra', 'giraffe', 'backpack', 'umbrella',
  'handbag', 'tie', 'suitcase', 'frisbee', 'skis', 'snowboard', 'sports ball', 'kite',
  'baseball bat', 'baseball glove', 'skateboard', 'surfboard', 'tennis racket', 'bottle',
  'wine glass', 'cup', 'fork', 'knife', 'spoon', 'bowl', 'banana', 'apple', 'sandwich', 'orange',
  'broccoli', 'carrot', 'hot dog', 'pizza', 'donut', 'cake', 'chair', 'couch', 'potted plant',
  'bed', 'dining table', 'toilet', 'tv', 'laptop', 'mouse', 'remote', 'keyboard', 'cell phone',
  'microwave', 'oven', 'toaster', 'sink', 'refrigerator', 'book', 'clock', 'vase', 'scissors',
  'teddy bear', 'hair drier', 'toothbrush'
] as const
