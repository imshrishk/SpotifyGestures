import { GestureRecognizer, FilesetResolver } from '@mediapipe/tasks-vision';

let gestureRecognizer: GestureRecognizer;

export const initializeGestureRecognizer = async () => {
  const vision = await FilesetResolver.forVisionTasks(
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
  );

  gestureRecognizer = await GestureRecognizer.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: "https://storage.googleapis.com/mediapipe-tasks/gesture_recognizer/gesture_recognizer.task"
    },
    runningMode: "VIDEO"
  });
};

export const detectGestures = async (image: HTMLVideoElement | HTMLImageElement) => {
  if (!gestureRecognizer) return null;
  
  const result = gestureRecognizer.recognize(image);
  return result.gestures[0]?.[0];
};