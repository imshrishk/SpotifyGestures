import * as tf from '@tensorflow/tfjs';
import * as handpose from '@tensorflow-models/handpose';

let model: handpose.HandPose | null = null;
let lastGesture: any | null = null;
let gestureTimeout: NodeJS.Timeout | null = null;
let gestureHistory: string[] = [];
const CONFIDENCE_THRESHOLD = 0.15;
const GESTURE_COOLDOWN = 800;
const HISTORY_SIZE = 5;

export const initializeHandDetector = async () => {
  await tf.ready();
  model = await handpose.load();
  return model;
};

export const detectHand = async (video: HTMLVideoElement) => {
  if (!model) return null;
  const predictions = await model.estimateHands(video);
  if (!predictions.length) return null;
  const hand = predictions[0];
  const landmarks = hand.landmarks;
  const confidence = 1.0;
  if (confidence < CONFIDENCE_THRESHOLD) return null;
  const palmBase = landmarks[0];
  const middleFinger = landmarks[12];
  const gesture = analyzeGesture(landmarks);
  
  if (gesture) {
    gestureHistory.unshift(gesture.type);
    if (gestureHistory.length > HISTORY_SIZE) {
      gestureHistory.pop();
    }
    
    const mostFrequent = findMostFrequentGesture(gestureHistory);
    if (mostFrequent && mostFrequent !== lastGesture) {
      if (gestureTimeout) {
        clearTimeout(gestureTimeout);
      }
      lastGesture = mostFrequent;
      gestureTimeout = setTimeout(() => {
        lastGesture = null;
      }, GESTURE_COOLDOWN);
      
      return {
        ...gesture,
        type: mostFrequent,
        direction: getHandDirection(palmBase, middleFinger, landmarks),
        confidence,
      };
    }
  }
  return null;
};

function findMostFrequentGesture(history: string[]): string | null {
  if (history.length === 0) return null;
  
  const counts = history.reduce((acc, gesture) => {
    acc[gesture] = (acc[gesture] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  let maxCount = 0;
  let maxGesture = null;
  
  for (const [gesture, count] of Object.entries(counts)) {
    if (count > maxCount) {
      maxCount = count;
      maxGesture = gesture;
    }
  }
  
  return maxCount >= Math.ceil(history.length / 2) ? maxGesture : null;
}

function analyzeGesture(landmarks: any[]) {
  const palmY = landmarks[0][1];
  const fingerTips = [landmarks[4], landmarks[8], landmarks[12], landmarks[16], landmarks[20]];
  const fingerBases = [landmarks[2], landmarks[5], landmarks[9], landmarks[13], landmarks[17]];
  const fingerMids = [landmarks[3], landmarks[6], landmarks[10], landmarks[14], landmarks[18]];
  
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
  
  const avgExtension = fingerExtensions.reduce((sum, ext) => sum + ext.distance, 0) / 5;
  
  if (isThumbsUp(landmarks, fingerExtensions)) {
    return { type: 'thumbsUp', isThumbsUp: true };
  }
  
  if (isThumbsDown(landmarks, fingerExtensions)) {
    return { type: 'thumbsDown', isThumbsDown: true };
  }
  
  if (isPeaceSign(fingerExtensions, landmarks)) {
    return { type: 'peace', isPeace: true };
  }
  
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
  
  if (isRockSign(fingerExtensions)) {
    return { type: 'rock', isRock: true };
  }
  
  return null;
}

function isPalmOpen(extensions: any[], avgExtension: number) {
  return extensions.filter(ext => ext.distance > avgExtension * 0.8).length >= 4;
}

function isPalmClosed(extensions: any[], avgExtension: number) {
  return extensions.filter(ext => ext.distance < avgExtension * 0.5).length >= 4;
}

function isPointingUp(extensions: any[]) {
  const indexFinger = extensions[1];
  const otherFingers = [extensions[0], extensions[2], extensions[3], extensions[4]];
  return (
    indexFinger.angle < -Math.PI * 0.6 &&
    indexFinger.distance > 0 &&
    otherFingers.filter(f => f.distance < indexFinger.distance * 0.6).length >= 3
  );
}

function isPointingDown(extensions: any[]) {
  const indexFinger = extensions[1];
  const otherFingers = [extensions[0], extensions[2], extensions[3], extensions[4]];
  return (
    indexFinger.angle > Math.PI * 0.6 &&
    indexFinger.distance > 0 &&
    otherFingers.filter(f => f.distance < indexFinger.distance * 0.6).length >= 3
  );
}

function isThumbsUp(landmarks: any[], extensions: any[]) {
  const thumb = extensions[0];
  const otherFingers = [extensions[1], extensions[2], extensions[3], extensions[4]];
  
  return (
    thumb.angle < -Math.PI * 0.6 &&
    thumb.distance > 0 &&
    otherFingers.filter(f => f.distance < thumb.distance * 0.7).length >= 3
  );
}

function isThumbsDown(landmarks: any[], extensions: any[]) {
  const thumb = extensions[0];
  const otherFingers = [extensions[1], extensions[2], extensions[3], extensions[4]];
  
  return (
    thumb.angle > Math.PI * 0.6 &&
    thumb.distance > 0 &&
    otherFingers.filter(f => f.distance < thumb.distance * 0.7).length >= 3
  );
}

function isPeaceSign(extensions: any[], landmarks: any[]) {
  const indexFinger = extensions[1];
  const middleFinger = extensions[2];
  const otherFingers = [extensions[0], extensions[3], extensions[4]];
  
  return (
    indexFinger.distance > 0 &&
    middleFinger.distance > 0 &&
    Math.abs(indexFinger.angle - middleFinger.angle) < Math.PI * 0.2 &&
    otherFingers.filter(f => f.distance < indexFinger.distance * 0.6).length >= 2
  );
}

function isRockSign(extensions: any[]) {
  const indexFinger = extensions[1];
  const pinkyFinger = extensions[4];
  const otherFingers = [extensions[0], extensions[2], extensions[3]];
  
  return (
    indexFinger.distance > 0 &&
    pinkyFinger.distance > 0 &&
    otherFingers.filter(f => f.distance < indexFinger.distance * 0.6).length >= 2
  );
}

function getHandDirection(palmBase: any[], middleFinger: any[], landmarks: any[]) {
  const xDiff = middleFinger[0] - palmBase[0];
  const yDiff = middleFinger[1] - palmBase[1];
  const threshold = 80;
  
  if (Math.abs(xDiff) > threshold && Math.abs(xDiff) > Math.abs(yDiff)) {
    return xDiff > 0 ? 'right' : 'left';
  }
  
  if (Math.abs(yDiff) > threshold && Math.abs(yDiff) > Math.abs(xDiff)) {
    return yDiff > 0 ? 'down' : 'up';
  }
  
  return null;
}
