import * as tf from '@tensorflow/tfjs';
import * as handpose from '@tensorflow-models/handpose';

let model: handpose.HandPose | null = null;
let isInitializing = false;
let initializationPromise: Promise<handpose.HandPose> | null = null;
let lastGesture: any | null = null;
let gestureTimeout: NodeJS.Timeout | null = null;
let gestureHistory: string[] = [];
let adaptiveConfidenceThreshold = 0.15;
let adaptiveDistanceThreshold = 0.8;
let lightingConditions: 'bright' | 'normal' | 'dark' = 'normal';
let lastHandPosition: { x: number; y: number; z: number } | null = null;

// Adaptive thresholds based on lighting and distance
const LIGHTING_THRESHOLDS = {
  bright: { confidence: 0.08, distance: 0.7 },
  normal: { confidence: 0.1, distance: 0.8 },
  dark: { confidence: 0.12, distance: 0.9 }
};

const GESTURE_COOLDOWN = 400;
const HISTORY_SIZE = 3;
const MIN_DETECTION_FRAMES = 2;
const MAX_DISTANCE_CHANGE = 0.5;

export const initializeHandDetector = async () => {
  // If already initialized, return the existing model
  if (model) {
    return model;
  }
  
  // If already initializing, return the existing promise
  if (isInitializing && initializationPromise) {
    return initializationPromise;
  }
  
  // Start initialization
  isInitializing = true;
  initializationPromise = (async () => {
    try {
      await tf.ready();
      model = await handpose.load();
      isInitializing = false;
      initializationPromise = null;
      return model;
    } catch (error) {
      isInitializing = false;
      initializationPromise = null;
      throw error;
    }
  })();
  
  return initializationPromise;
};

export const cleanupHandDetector = () => {
  if (model) {
    // Clear the model reference to free memory
    model = null;
  }
  isInitializing = false;
  initializationPromise = null;
  lastGesture = null;
  if (gestureTimeout) {
    clearTimeout(gestureTimeout);
    gestureTimeout = null;
  }
  gestureHistory = [];
  lastHandPosition = null;
};

export const isModelReady = () => {
  return model !== null && !isInitializing;
};

// Image preprocessing for better detection in different lighting
const preprocessImage = (video: HTMLVideoElement): HTMLCanvasElement => {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  
  // Draw the video frame
  ctx.drawImage(video, 0, 0);
  
  // Get image data for processing
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  
  // Analyze lighting conditions
  let totalBrightness = 0;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    totalBrightness += (r + g + b) / 3;
  }
  const avgBrightness = totalBrightness / (data.length / 4);
  
  // Determine lighting condition
  if (avgBrightness > 180) {
    lightingConditions = 'bright';
  } else if (avgBrightness < 80) {
    lightingConditions = 'dark';
  } else {
    lightingConditions = 'normal';
  }
  
  // Apply adaptive contrast enhancement
  const factor = lightingConditions === 'dark' ? 1.3 : 
                 lightingConditions === 'bright' ? 0.8 : 1.0;
  
  for (let i = 0; i < data.length; i += 4) {
    data[i] = Math.min(255, Math.max(0, (data[i] - 128) * factor + 128));
    data[i + 1] = Math.min(255, Math.max(0, (data[i + 1] - 128) * factor + 128));
    data[i + 2] = Math.min(255, Math.max(0, (data[i + 2] - 128) * factor + 128));
  }
  
  ctx.putImageData(imageData, 0, 0);
  return canvas;
};

// Calculate hand distance from camera
const calculateHandDistance = (landmarks: any[]): number => {
  const palmBase = landmarks[0];
  const middleFinger = landmarks[12];
  const indexFinger = landmarks[8];
  
  // Calculate hand size as a proxy for distance
  const handSize = Math.sqrt(
    Math.pow(middleFinger[0] - palmBase[0], 2) +
    Math.pow(middleFinger[1] - palmBase[1], 2)
  );
  
  return handSize;
};

// Adaptive threshold adjustment
const updateAdaptiveThresholds = (landmarks: any[], confidence: number) => {
  const currentThresholds = LIGHTING_THRESHOLDS[lightingConditions];
  
  // Adjust confidence threshold based on lighting
  adaptiveConfidenceThreshold = currentThresholds.confidence;
  
  // Adjust distance threshold based on hand size
  const handDistance = calculateHandDistance(landmarks);
  adaptiveDistanceThreshold = currentThresholds.distance * (1 + (handDistance - 100) / 100);
  
  // Store hand position for movement detection
  const palmBase = landmarks[0];
  lastHandPosition = { x: palmBase[0], y: palmBase[1], z: handDistance };
};

export const detectHand = async (video: HTMLVideoElement) => {
  if (!isModelReady()) return null;
  
  try {
    // Preprocess the image for better detection
    const processedCanvas = preprocessImage(video);
    const predictions = await model!.estimateHands(processedCanvas);
    
    if (!predictions.length) return null;
    
    const hand = predictions[0];
    const landmarks = hand.landmarks;
    const confidence = hand.annotations ? 1.0 : 0.8; // Fallback confidence
    
    // Update adaptive thresholds
    updateAdaptiveThresholds(landmarks, confidence);
    
    if (confidence < adaptiveConfidenceThreshold) return null;
    
    const palmBase = landmarks[0];
    const middleFinger = landmarks[12];
    const gesture = analyzeGesture(landmarks);
    
    // Temporary debugging for gesture detection
    if (gesture) {
      console.log('Gesture detected:', gesture.type, 'with confidence:', confidence);
    }
    
    if (gesture) {
      // Check for sudden hand movement (false positive prevention)
      if (lastHandPosition) {
        const movement = Math.sqrt(
          Math.pow(palmBase[0] - lastHandPosition.x, 2) +
          Math.pow(palmBase[1] - lastHandPosition.y, 2)
        );
        
        if (movement > MAX_DISTANCE_CHANGE * 100) {
          return null; // Ignore sudden movements
        }
      }
      
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
        
        const direction = getHandDirection(palmBase, middleFinger, landmarks);
        
        return {
          ...gesture,
          type: mostFrequent,
          direction: direction,
          confidence,
          lighting: lightingConditions,
          distance: calculateHandDistance(landmarks)
        };
      }
    }
    return null;
  } catch (error) {
    console.error('Hand detection error:', error);
    return null;
  }
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
  
  // Make it less strict - require only 50% consistency
  const requiredCount = Math.ceil(history.length * 0.5);
  
  return maxCount >= requiredCount ? maxGesture : null;
}

function analyzeGesture(landmarks: any[]) {
  const palmY = landmarks[0][1];
  const fingerTips = [landmarks[4], landmarks[8], landmarks[12], landmarks[16], landmarks[20]];
  const fingerBases = [landmarks[2], landmarks[5], landmarks[9], landmarks[13], landmarks[17]];
  const fingerMids = [landmarks[3], landmarks[6], landmarks[10], landmarks[14], landmarks[18]];
  
  // Calculate finger extensions with adaptive thresholds
  const fingerExtensions = fingerTips.map((tip, i) => {
    const base = fingerBases[i];
    const mid = fingerMids[i];
    
    const distance = Math.sqrt(
      Math.pow(tip[0] - base[0], 2) +
      Math.pow(tip[1] - base[1], 2)
    );
    
    const angle = Math.atan2(tip[1] - base[1], tip[0] - base[0]);
    
    // More adaptive extension threshold based on lighting and finger type
    let extensionThreshold = 0.3; // Base threshold
    
    // Adjust threshold based on lighting conditions
    if (lightingConditions === 'dark') {
      extensionThreshold = 0.25; // More lenient in dark conditions
    } else if (lightingConditions === 'bright') {
      extensionThreshold = 0.35; // Slightly stricter in bright conditions
    }
    
    // Special handling for thumb (index 0) - it's naturally shorter
    if (i === 0) {
      extensionThreshold *= 0.8; // More lenient for thumb
    }
    
    const isExtended = distance > adaptiveDistanceThreshold * extensionThreshold;
    
    return {
      distance,
      angle,
      isExtended,
      fingerIndex: i
    };
  });
  
  const avgExtension = fingerExtensions.reduce((sum, ext) => sum + ext.distance, 0) / 5;
  
  // Temporary debugging for finger extensions
  console.log('Finger extensions:', fingerExtensions.map(ext => ({
    finger: ext.fingerIndex,
    distance: ext.distance.toFixed(2),
    isExtended: ext.isExtended,
    angle: ext.angle.toFixed(2)
  })));
  console.log('Average extension:', avgExtension.toFixed(2));
  
  // Enhanced gesture recognition with lighting adaptation
  // Check closed fist first as it's the most common gesture
  if (isPalmClosed(fingerExtensions, avgExtension)) {
    return { type: 'closed', isClosed: true };
  }
  
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
  
  if (isRockSign(fingerExtensions)) {
    return { type: 'rock', isRock: true };
  }
  
  return null;
}

function isPalmOpen(extensions: any[], avgExtension: number) {
  const extendedFingers = extensions.filter(ext => ext.isExtended).length;
  // Make it more lenient - require 3+ extended fingers instead of 4
  const threshold = 3;
  const result = extendedFingers >= threshold;
  return result;
}

function isPalmClosed(extensions: any[], avgExtension: number) {
  const closedFingers = extensions.filter(ext => !ext.isExtended).length;
  const extendedFingers = extensions.filter(ext => ext.isExtended).length;
  
  // More lenient detection for closed fist
  // Consider it closed if most fingers are not extended
  const threshold = 3; // Require at least 3 closed fingers
  const result = closedFingers >= threshold && extendedFingers <= 1;
  
  // Additional check: if average extension is very low, it's likely a closed fist
  const avgExtensionThreshold = adaptiveDistanceThreshold * 0.2; // Very low threshold
  const lowExtension = avgExtension < avgExtensionThreshold;
  
  // Additional check: if all fingers have very low extension, it's definitely closed
  const allFingersLow = extensions.every(ext => ext.distance < adaptiveDistanceThreshold * 0.15);
  
  // Check if fingers are curled (angles indicate closed position)
  const curledFingers = extensions.filter(ext => {
    // For closed fist, fingers should have angles indicating they're curled
    const isThumb = ext.fingerIndex === 0;
    if (isThumb) {
      // Thumb angle for closed fist is typically between -0.5 and 0.5 radians
      return ext.angle > -0.5 && ext.angle < 0.5;
    } else {
      // Other fingers should be curled (angle close to 0 or negative)
      return ext.angle < 0.3;
    }
  }).length;
  
  const mostFingersCurled = curledFingers >= 3;
  
  const finalResult = result || lowExtension || allFingersLow || mostFingersCurled;
  
  // Temporary debugging for closed fist detection
  if (finalResult) {
    console.log('Closed fist detected:', {
      closedFingers,
      extendedFingers,
      avgExtension,
      avgExtensionThreshold,
      allFingersLow,
      curledFingers,
      result,
      lowExtension,
      mostFingersCurled
    });
  }
  
  return finalResult;
}

function isPointingUp(extensions: any[]) {
  const indexFinger = extensions[1];
  const otherFingers = [extensions[0], extensions[2], extensions[3], extensions[4]];
  
  const angleThreshold = lightingConditions === 'dark' ? -Math.PI * 0.5 : -Math.PI * 0.6;
  const distanceThreshold = lightingConditions === 'dark' ? 0.7 : 0.6;
  
  return (
    indexFinger.angle < angleThreshold &&
    indexFinger.isExtended &&
    otherFingers.filter(f => !f.isExtended || f.distance < indexFinger.distance * distanceThreshold).length >= 3
  );
}

function isPointingDown(extensions: any[]) {
  const indexFinger = extensions[1];
  const otherFingers = [extensions[0], extensions[2], extensions[3], extensions[4]];
  
  const angleThreshold = lightingConditions === 'dark' ? Math.PI * 0.5 : Math.PI * 0.6;
  const distanceThreshold = lightingConditions === 'dark' ? 0.7 : 0.6;
  
  return (
    indexFinger.angle > angleThreshold &&
    indexFinger.isExtended &&
    otherFingers.filter(f => !f.isExtended || f.distance < indexFinger.distance * distanceThreshold).length >= 3
  );
}

function isThumbsUp(landmarks: any[], extensions: any[]) {
  const thumb = extensions[0];
  const otherFingers = [extensions[1], extensions[2], extensions[3], extensions[4]];
  
  const angleThreshold = lightingConditions === 'dark' ? -Math.PI * 0.5 : -Math.PI * 0.6;
  const distanceThreshold = lightingConditions === 'dark' ? 0.8 : 0.7;
  
  return (
    thumb.angle < angleThreshold &&
    thumb.isExtended &&
    otherFingers.filter(f => !f.isExtended || f.distance < thumb.distance * distanceThreshold).length >= 3
  );
}

function isThumbsDown(landmarks: any[], extensions: any[]) {
  const thumb = extensions[0];
  const otherFingers = [extensions[1], extensions[2], extensions[3], extensions[4]];
  
  const angleThreshold = lightingConditions === 'dark' ? Math.PI * 0.5 : Math.PI * 0.6;
  const distanceThreshold = lightingConditions === 'dark' ? 0.8 : 0.7;
  
  return (
    thumb.angle > angleThreshold &&
    thumb.isExtended &&
    otherFingers.filter(f => !f.isExtended || f.distance < thumb.distance * distanceThreshold).length >= 3
  );
}

function isPeaceSign(extensions: any[], landmarks: any[]) {
  const indexFinger = extensions[1];
  const middleFinger = extensions[2];
  const otherFingers = [extensions[0], extensions[3], extensions[4]];
  
  const angleThreshold = lightingConditions === 'dark' ? Math.PI * 0.3 : Math.PI * 0.2;
  const distanceThreshold = lightingConditions === 'dark' ? 0.7 : 0.6;
  
  return (
    indexFinger.isExtended &&
    middleFinger.isExtended &&
    Math.abs(indexFinger.angle - middleFinger.angle) < angleThreshold &&
    otherFingers.filter(f => !f.isExtended || f.distance < indexFinger.distance * distanceThreshold).length >= 2
  );
}

function isRockSign(extensions: any[]) {
  const indexFinger = extensions[1];
  const pinkyFinger = extensions[4];
  const otherFingers = [extensions[0], extensions[2], extensions[3]];
  
  const distanceThreshold = lightingConditions === 'dark' ? 0.7 : 0.6;
  
  return (
    indexFinger.isExtended &&
    pinkyFinger.isExtended &&
    otherFingers.filter(f => !f.isExtended || f.distance < indexFinger.distance * distanceThreshold).length >= 2
  );
}

function getHandDirection(palmBase: any[], middleFinger: any[], landmarks: any[]) {
  const xDiff = middleFinger[0] - palmBase[0];
  const yDiff = middleFinger[1] - palmBase[1];
  
  // Adaptive threshold based on lighting and distance
  const baseThreshold = 80;
  const adaptiveThreshold = lightingConditions === 'dark' ? baseThreshold * 0.8 :
                           lightingConditions === 'bright' ? baseThreshold * 1.2 :
                           baseThreshold;
  
  if (Math.abs(xDiff) > adaptiveThreshold && Math.abs(xDiff) > Math.abs(yDiff)) {
    return xDiff > 0 ? 'right' : 'left';
  }
  
  if (Math.abs(yDiff) > adaptiveThreshold && Math.abs(yDiff) > Math.abs(xDiff)) {
    return yDiff > 0 ? 'down' : 'up';
  }
  
  return null;
}

// Export lighting condition for debugging
export const getLightingCondition = () => lightingConditions;
export const getAdaptiveThresholds = () => ({
  confidence: adaptiveConfidenceThreshold,
  distance: adaptiveDistanceThreshold,
  lighting: lightingConditions
});
