import * as tf from '@tensorflow/tfjs';
import * as handpose from '@tensorflow-models/handpose';

let model: handpose.HandPose | null = null;
let lastGesture: string | null = null;
let gestureTimeout: NodeJS.Timeout | null = null;

// Minimum confidence threshold for gesture detection
const CONFIDENCE_THRESHOLD = 0.6;
// Minimum time between gesture triggers (in milliseconds)
const GESTURE_COOLDOWN = 1000;

export const initializeHandDetector = async () => {
  await tf.ready();
  model = await handpose.load({
    maxHands: 1, // Only detect one hand to avoid confusion
  });
  return model;
};

export const detectHand = async (video: HTMLVideoElement) => {
  if (!model) return null;
  
  const predictions = await model.estimateHands(video);
  if (!predictions.length) return null;

  const hand = predictions[0];
  const landmarks = hand.landmarks;
  const confidence = hand.score;

  if (confidence < CONFIDENCE_THRESHOLD) return null;
  
  const palmBase = landmarks[0];
  const middleFinger = landmarks[12];
  
  const gesture = analyzeGesture(landmarks);
  
  // Implement gesture debouncing
  if (gesture && gesture !== lastGesture) {
    if (gestureTimeout) {
      clearTimeout(gestureTimeout);
    }
    
    lastGesture = gesture;
    gestureTimeout = setTimeout(() => {
      lastGesture = null;
    }, GESTURE_COOLDOWN);

    return {
      ...gesture,
      direction: getHandDirection(palmBase, middleFinger),
      confidence
    };
  }

  return null;
};

function analyzeGesture(landmarks: number[][]) {
  const palmY = landmarks[0][1];
  const fingerTips = [landmarks[4], landmarks[8], landmarks[12], landmarks[16], landmarks[20]];
  const fingerBases = [landmarks[2], landmarks[5], landmarks[9], landmarks[13], landmarks[17]];
  
  // Calculate finger extensions
  const fingerExtensions = fingerTips.map((tip, i) => {
    const base = fingerBases[i];
    return {
      distance: Math.sqrt(
        Math.pow(tip[0] - base[0], 2) + 
        Math.pow(tip[1] - base[1], 2)
      ),
      angle: Math.atan2(tip[1] - base[1], tip[0] - base[0])
    };
  });

  // Improved gesture detection logic
  const avgExtension = fingerExtensions.reduce((sum, ext) => sum + ext.distance, 0) / 5;
  
  if (isPointingUp(fingerExtensions)) {
    return { type: 'pointUp', isPointingUp: true };
  }
  
  if (isPointingDown(fingerExtensions)) {
    return { type: 'pointDown', isPointingDown: true };
  }
  
  if (isPalmOpen(fingerExtensions, avgExtension)) {
    return { type: 'open', isOpen: true };
  }
  
  if (isPalmClosed(fingerExtensions, avgExtension)) {
    return { type: 'closed', isClosed: true };
  }

  return null;
}

function isPalmOpen(extensions: any[], avgExtension: number) {
  return extensions.every(ext => ext.distance > avgExtension * 0.8);
}

function isPalmClosed(extensions: any[], avgExtension: number) {
  return extensions.every(ext => ext.distance < avgExtension * 0.5);
}

function isPointingUp(extensions: any[]) {
  const indexFinger = extensions[1];
  const otherFingers = [extensions[0], extensions[2], extensions[3], extensions[4]];
  
  return (
    indexFinger.angle < -Math.PI * 0.7 && 
    otherFingers.every(f => f.distance < indexFinger.distance * 0.6)
  );
}

function isPointingDown(extensions: any[]) {
  const indexFinger = extensions[1];
  const otherFingers = [extensions[0], extensions[2], extensions[3], extensions[4]];
  
  return (
    indexFinger.angle > Math.PI * 0.7 && 
    otherFingers.every(f => f.distance < indexFinger.distance * 0.6)
  );
}

function getHandDirection(palmBase: number[], middleFinger: number[]) {
  const xDiff = middleFinger[0] - palmBase[0];
  const threshold = 100;
  
  if (Math.abs(xDiff) < threshold) return null;
  return xDiff > 0 ? 'right' : 'left';
}