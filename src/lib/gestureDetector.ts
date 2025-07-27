let adaptiveConfidenceThreshold = 0.7;
let lightingConditions: 'bright' | 'normal' | 'dark' = 'normal';

// Adaptive thresholds for gesture detection
const GESTURE_LIGHTING_THRESHOLDS = {
  bright: { confidence: 0.6 },
  normal: { confidence: 0.7 },
  dark: { confidence: 0.8 }
};

// Image preprocessing for better detection
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

export const initializeGestureRecognizer = async () => {
  // This function is kept for compatibility but uses TensorFlow.js hand detection
  // The actual initialization is handled in handGestureDetector.ts
  console.log('Gesture recognizer initialization handled by TensorFlow.js hand detection');
};

export const detectGestures = async (video: HTMLVideoElement) => {
  try {
    // Preprocess the image for better detection
    const processedCanvas = preprocessImage(video);
    
    // Update adaptive confidence threshold
    const currentThresholds = GESTURE_LIGHTING_THRESHOLDS[lightingConditions];
    adaptiveConfidenceThreshold = currentThresholds.confidence;
    
    // Return the processed canvas for use with hand detection
    return {
      processedCanvas,
      lighting: lightingConditions,
      confidence: adaptiveConfidenceThreshold,
      adaptiveThreshold: adaptiveConfidenceThreshold
    };
  } catch (error) {
    console.error('Gesture detection error:', error);
    return null;
  }
};

// Export lighting condition for debugging
export const getGestureLightingCondition = () => lightingConditions;
export const getGestureAdaptiveThresholds = () => ({
  confidence: adaptiveConfidenceThreshold,
  lighting: lightingConditions
});
