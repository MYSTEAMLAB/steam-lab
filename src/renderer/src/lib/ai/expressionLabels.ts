// Split out from expressionDetector.ts so anything that only needs the label
// list (e.g. the Blockly block dropdown in customBlocks.ts) doesn't drag in
// face-api.js — which bundles its own private tfjs-core@1.7.0, colliding
// with the app's tfjs-core@4.22.0 the moment it's *loaded*, regardless of
// whether detection actually runs. That collision was firing three
// TF.js console warnings on every single app launch, since customBlocks.ts
// (registerCustomBlocks(), called eagerly at startup) imported
// EXPRESSION_LABELS from the face-api-wrapping module.
export const EXPRESSION_LABELS = ['Neutral', 'Happy', 'Sad', 'Angry', 'Fearful', 'Disgusted', 'Surprised'] as const
