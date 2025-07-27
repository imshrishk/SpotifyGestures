import React, { useEffect, useRef, useState, useCallback } from 'react';
import Webcam from 'react-webcam';
import { Camera, Eye, Hand, RefreshCw, HelpCircle, Settings, Zap } from 'lucide-react';
import { initializeHandDetector, detectHand, getLightingCondition, getAdaptiveThresholds, cleanupHandDetector, isModelReady } from '../lib/handGestureDetector';
import { playPause, nextTrack, previousTrack, setVolume, likeTrack, dislikeTrack, toggleShuffle, getRecommendations } from '../lib/spotify';
import useSpotifyStore from '../stores/useSpotifyStore';
import { motion, AnimatePresence } from 'framer-motion';
import GestureTutorialModal from './GestureTutorialModal';

const DEFAULT_GESTURE_MAPPING: { [key: string]: string } = {
  'open': 'Play',
  'closed': 'Pause',
  'thumbsUp': 'Like',
  'thumbsDown': 'Dislike',
  'peace': 'Toggle Shuffle',
  'right': 'Next Track',
  'left': 'Previous Track',
  'up': 'Volume Up',
  'down': 'Volume Down',
};

const GestureControl: React.FC = () => {
  const webcamRef = useRef<Webcam>(null);
  const detectionIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [useGestures, setUseGestures] = useState(true);
  const [showWebcam, setShowWebcam] = useState(false);
  const [lastDetectedGesture, setLastDetectedGesture] = useState<string>('');
  const [successfulAction, setSuccessfulAction] = useState<string | null>(null);
  const [sensitivity, setSensitivity] = useState<number>(5);
  const [showTutorial, setShowTutorial] = useState(false);
  const [gestureMap, setGestureMap] = useState(DEFAULT_GESTURE_MAPPING);
  const [showDebugInfo, setShowDebugInfo] = useState(false);
  const [lightingCondition, setLightingCondition] = useState<string>('normal');
  const [adaptiveThresholds, setAdaptiveThresholds] = useState<any>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const { isPlaying, volume, setVolume: updateStoreVolume, setIsPlaying, currentTrack } = useSpotifyStore();

  useEffect(() => {
    const savedSettings = localStorage.getItem('gesture_settings');
    if (savedSettings) {
      const userSettings = JSON.parse(savedSettings);
      // Create a reverse map for lookup
      const reversedMap: { [key: string]: string } = {};
      Object.keys(userSettings).forEach(action => {
        const gesture = userSettings[action];
        if (gesture) reversedMap[gesture] = action;
      });
      setGestureMap(current => ({ ...current, ...reversedMap }));
    }
  }, []);

  const showSuccessFeedback = (action: string) => {
    setSuccessfulAction(action);
    setTimeout(() => setSuccessfulAction(null), 2000);
  };

  const handleGestureAction = useCallback(async (action: string) => {
    switch (action) {
      case 'Play':
        if (!isPlaying) {
          await playPause(true);
          setIsPlaying(true);
          showSuccessFeedback('Playing music');
        }
        break;
      case 'Pause':
        if (isPlaying) {
          await playPause(false);
          setIsPlaying(false);
          showSuccessFeedback('Paused music');
        }
        break;
      case 'Like':
        if (currentTrack) {
          await likeTrack(currentTrack.id);
          showSuccessFeedback('Liked track');
        }
        break;
      case 'Dislike':
        if (currentTrack) {
          await dislikeTrack(currentTrack.id);
          showSuccessFeedback('Disliked track');
          await nextTrack();
        }
        break;
      case 'Toggle Shuffle':
        await toggleShuffle();
        showSuccessFeedback('Toggled shuffle');
        break;
      case 'Get Recommendations':
        await getRecommendations();
        showSuccessFeedback('Loaded recommendations');
        break;
      case 'Next Track':
        await nextTrack();
        showSuccessFeedback('Next track');
        break;
      case 'Previous Track':
        await previousTrack();
        showSuccessFeedback('Previous track');
        break;
      case 'Volume Up':
        const newVolumeUp = Math.min(volume + sensitivity * 2, 100);
        await setVolume(newVolumeUp);
        updateStoreVolume(newVolumeUp);
        showSuccessFeedback(`Volume: ${newVolumeUp}%`);
        break;
      case 'Volume Down':
        const newVolumeDown = Math.max(volume - sensitivity * 2, 0);
        await setVolume(newVolumeDown);
        updateStoreVolume(newVolumeDown);
        showSuccessFeedback(`Volume: ${newVolumeDown}%`);
        break;
    }
  }, [isPlaying, volume, sensitivity, currentTrack, setIsPlaying, updateStoreVolume]);

  // Initialize AI model once
  useEffect(() => {
    let isMounted = true;
    
    const initializeModel = async () => {
      if (isInitialized) return;
      
      try {
        setIsLoading(true);
        setError(null);
        await initializeHandDetector();
        if (isMounted) {
          setIsInitialized(true);
          setIsLoading(false);
        }
      } catch (err) {
        console.error('Model initialization error:', err);
        if (isMounted) {
          setError('Failed to initialize AI model. Please refresh the page.');
          setIsLoading(false);
        }
      }
    };

    // Only initialize if not already initialized
    if (!isInitialized) {
      initializeModel();
    }

    return () => {
      isMounted = false;
    };
  }, []); // Remove isInitialized from dependencies to prevent re-initialization

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanupHandDetector();
    };
  }, []);

  // Handle gesture detection
  useEffect(() => {
    if (!isInitialized || !useGestures || !isModelReady()) {
      // Clear any existing interval
      if (detectionIntervalRef.current) {
        clearInterval(detectionIntervalRef.current);
        detectionIntervalRef.current = null;
      }
      return;
    }

    let gestureCooldown = false;

    const runHandDetection = async () => {
      if (!webcamRef.current?.video || gestureCooldown) return;

      try {
        const gesture = await detectHand(webcamRef.current.video);
        
        // Update debug information
        setLightingCondition(getLightingCondition());
        setAdaptiveThresholds(getAdaptiveThresholds());
        
        if (gesture) {
          gestureCooldown = true;
          setTimeout(() => gestureCooldown = false, 500);

          const gestureName = gesture.direction || gesture.type;
          setLastDetectedGesture(gestureName);
          setTimeout(() => setLastDetectedGesture(''), 2000);

          const action = gestureMap[gestureName];
          if (action) {
            handleGestureAction(action);
          }
        }
      } catch (err) {
        console.error('Detection error:', err);
      }
    };

    // Start detection interval
    detectionIntervalRef.current = setInterval(runHandDetection, 100);

    // Cleanup function
    return () => {
      if (detectionIntervalRef.current) {
        clearInterval(detectionIntervalRef.current);
        detectionIntervalRef.current = null;
      }
    };
  }, [isInitialized, useGestures, gestureMap, handleGestureAction]);

  // Handle camera activation when webcam is shown
  useEffect(() => {
    if (showWebcam && isInitialized) {
      setCameraActive(true);
    } else {
      setCameraActive(false);
    }
  }, [showWebcam, isInitialized]);

  // Prevent webcam from being re-initialized unnecessarily
  const webcamConstraints = {
    width: 640,
    height: 480,
    facingMode: 'user' as const,
    frameRate: { ideal: 30, max: 30 }
  };

  const restartDetection = () => {
    setUseGestures(false);
    setTimeout(() => setUseGestures(true), 100);
  };

  const retryInitialization = () => {
    setError(null);
    setIsInitialized(false);
    setIsLoading(true);
  };

  const getLightingColor = (condition: string) => {
    switch (condition) {
      case 'bright': return 'text-yellow-400';
      case 'dark': return 'text-blue-400';
      default: return 'text-green-400';
    }
  };

  return (
    <>
      {showTutorial && <GestureTutorialModal onClose={() => setShowTutorial(false)} />}
      <div className="space-y-4 bg-gray-800/50 backdrop-blur-lg rounded-2xl p-6 border border-white/10">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-xl text-white flex items-center gap-2">
            <Hand className="w-6 h-6" /> Gesture Control
            <div className="flex items-center gap-1 ml-2">
              <Zap className="w-4 h-4 text-green-400" />
              <span className="text-xs text-green-400">Adaptive AI</span>
            </div>
          </h3>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowDebugInfo(!showDebugInfo)}
              className="p-2.5 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-full transition-colors"
              title="Show Debug Info"
            >
              <Settings className="w-5 h-5" />
            </button>
            <button
              onClick={() => setShowTutorial(true)}
              className="p-2.5 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-full transition-colors"
              title="Show Gesture Tutorial"
            >
              <HelpCircle className="w-5 h-5" />
            </button>
            <button
              onClick={() => setUseGestures(!useGestures)}
              className={`px-4 py-2 rounded-full transition-all ${
                useGestures
                  ? 'bg-green-500 hover:bg-green-600 text-white'
                  : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
              }`}
            >
              {useGestures ? 'Active' : 'Disabled'}
            </button>
            <button
              onClick={() => setShowWebcam(!showWebcam)}
              className="p-2.5 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-full transition-colors"
            >
              {showWebcam ? <Eye className="w-5 h-5" /> : <Camera className="w-5 h-5" />}
            </button>
            {useGestures && isModelReady() && (
              <button
                onClick={restartDetection}
                className="p-2.5 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-full transition-colors"
                title="Restart detection"
              >
                <RefreshCw className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>

        {/* Adaptive Detection Status */}
        {useGestures && (
          <div className="bg-gray-700/50 rounded-lg p-3 mb-4">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <span className="text-gray-300">Status:</span>
                {isLoading ? (
                  <span className="text-yellow-400 font-medium">Initializing...</span>
                ) : error ? (
                  <span className="text-red-400 font-medium">Error</span>
                ) : (
                  <span className="text-green-400 font-medium">Ready</span>
                )}
              </div>
              {!isLoading && !error && (
                <div className="flex items-center gap-4 text-xs text-gray-400">
                  <span>Lighting: {lightingCondition}</span>
                  {adaptiveThresholds && (
                    <>
                      <span>Confidence: {(adaptiveThresholds.confidence * 100).toFixed(0)}%</span>
                      <span>Distance: {(adaptiveThresholds.distance * 100).toFixed(0)}%</span>
                    </>
                  )}
                </div>
              )}
            </div>
            <div className="text-xs text-gray-400 mt-1">
              {isLoading ? 'Loading AI model...' : 
               error ? 'Camera access required for gesture control' :
               'AI automatically adjusts detection sensitivity based on lighting and distance'}
            </div>
          </div>
        )}

        {/* Sensitivity slider */}
        <div className="mb-2">
          <div className="flex items-center justify-between mb-1">
            <label className="text-sm text-gray-300">Gesture Sensitivity</label>
            <span className="text-xs text-gray-400">{sensitivity}</span>
          </div>
          <input
            type="range"
            min="1"
            max="10"
            value={sensitivity}
            onChange={(e) => setSensitivity(parseInt(e.target.value))}
            className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-green-500"
          />
        </div>

        {/* Debug Information */}
        {showDebugInfo && adaptiveThresholds && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-gray-700/30 rounded-lg p-3 text-xs"
          >
            <div className="grid grid-cols-2 gap-2 text-gray-300">
              <div>
                <span className="text-gray-400">Lighting Condition:</span>
                <span className={`ml-1 ${getLightingColor(lightingCondition)}`}>
                  {lightingCondition}
                </span>
              </div>
              <div>
                <span className="text-gray-400">Confidence Threshold:</span>
                <span className="ml-1">{(adaptiveThresholds.confidence * 100).toFixed(1)}%</span>
              </div>
              <div>
                <span className="text-gray-400">Distance Threshold:</span>
                <span className="ml-1">{(adaptiveThresholds.distance * 100).toFixed(1)}%</span>
              </div>
              <div>
                <span className="text-gray-400">Detection Mode:</span>
                <span className="ml-1 text-green-400">Adaptive</span>
              </div>
              <div>
                <span className="text-gray-400">Model Ready:</span>
                <span className={`ml-1 ${isModelReady() ? 'text-green-400' : 'text-red-400'}`}>
                  {isModelReady() ? 'Yes' : 'No'}
                </span>
              </div>
              <div>
                <span className="text-gray-400">Camera Active:</span>
                <span className={`ml-1 ${cameraActive ? 'text-green-400' : 'text-red-400'}`}>
                  {cameraActive ? 'Yes' : 'No'}
                </span>
              </div>
            </div>
          </motion.div>
        )}

        <AnimatePresence>
          {useGestures && showWebcam && cameraActive && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="relative w-full aspect-video bg-black rounded-xl overflow-hidden"
            >
              {isLoading ? (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-900/50">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-400 mx-auto mb-2"></div>
                    <div className="text-white text-sm">Loading AI model...</div>
                  </div>
                </div>
              ) : error ? (
                <div className="absolute inset-0 flex items-center justify-center bg-red-900/20 p-4">
                  <div className="text-center">
                    <div className="text-red-400 text-sm mb-2">{error}</div>
                    <button
                      onClick={retryInitialization}
                      className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm transition-colors"
                    >
                      Retry
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <Webcam
                    ref={webcamRef}
                    className="w-full h-full object-cover"
                    videoConstraints={webcamConstraints}
                    mirrored
                    screenshotFormat="image/jpeg"
                    screenshotQuality={0.8}
                  />
                  {lastDetectedGesture && (
                    <motion.div
                      initial={{ y: 20, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      className="absolute bottom-4 left-4 bg-black/50 px-4 py-2 rounded-full text-sm flex items-center gap-2"
                    >
                      <span className="text-green-400">Detected:</span>
                      <span className="text-white">{lastDetectedGesture}</span>
                    </motion.div>
                  )}
                  {successfulAction && (
                    <motion.div
                      initial={{ y: -20, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      exit={{ y: -20, opacity: 0 }}
                      className="absolute top-4 right-4 bg-green-500/80 px-4 py-2 rounded-full text-sm flex items-center gap-2"
                    >
                      <span className="text-white">{successfulAction}</span>
                    </motion.div>
                  )}
                  {/* Lighting indicator */}
                  <div className="absolute top-4 left-4 bg-black/50 px-3 py-1 rounded-full text-xs flex items-center gap-1">
                    <div className={`w-2 h-2 rounded-full ${
                      lightingCondition === 'bright' ? 'bg-yellow-400' :
                      lightingCondition === 'dark' ? 'bg-blue-400' : 'bg-green-400'
                    }`} />
                    <span className="text-white">{lightingCondition}</span>
                  </div>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
};

export default GestureControl;
