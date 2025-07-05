import React, { useEffect, useRef, useState, useCallback } from 'react';
import Webcam from 'react-webcam';
import { Camera, Eye, Hand, RefreshCw, HelpCircle } from 'lucide-react';
import { initializeHandDetector, detectHand } from '../lib/handGestureDetector';
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
  'rock': 'Get Recommendations',
  'right': 'Next Track',
  'left': 'Previous Track',
  'up': 'Volume Up',
  'down': 'Volume Down',
};

const GestureControl: React.FC = () => {
  const webcamRef = useRef<Webcam>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [useGestures, setUseGestures] = useState(true);
  const [showWebcam, setShowWebcam] = useState(false);
  const [lastDetectedGesture, setLastDetectedGesture] = useState<string>('');
  const [successfulAction, setSuccessfulAction] = useState<string | null>(null);
  const [sensitivity, setSensitivity] = useState<number>(5);
  const [showTutorial, setShowTutorial] = useState(false);
  const [gestureMap, setGestureMap] = useState(DEFAULT_GESTURE_MAPPING);
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

  useEffect(() => {
    let detectionInterval: NodeJS.Timeout;
    let gestureCooldown = false;

    const runHandDetection = async () => {
      if (!webcamRef.current?.video || !useGestures || gestureCooldown) return;

      try {
        const gesture = await detectHand(webcamRef.current.video);
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

    const setupCamera = async () => {
      try {
        setIsLoading(true);
        setError(null);
        await initializeHandDetector();
        setIsLoading(false);
        detectionInterval = setInterval(runHandDetection, 100);
      } catch (err) {
        console.error('Camera setup error:', err);
        setError('Camera access required for gesture control');
        setIsLoading(false);
      }
    };

    if (useGestures) setupCamera();
    return () => {
      clearInterval(detectionInterval);
    };
  }, [useGestures, gestureMap, handleGestureAction]);

  const restartDetection = () => {
    setUseGestures(false);
    setTimeout(() => setUseGestures(true), 100);
  };

  return (
    <>
      {showTutorial && <GestureTutorialModal onClose={() => setShowTutorial(false)} />}
      <div className="space-y-4 bg-gray-800/50 backdrop-blur-lg rounded-2xl p-6 border border-white/10">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-xl text-white flex items-center gap-2">
            <Hand className="w-6 h-6" /> Gesture Control
          </h3>
          <div className="flex items-center gap-2">
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
            {useGestures && (
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

        <AnimatePresence>
          {useGestures && showWebcam && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="relative w-full aspect-video bg-black rounded-xl overflow-hidden"
            >
              {isLoading ? (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-900/50">
                  <div className="animate-pulse text-white">Initializing AI model...</div>
                </div>
              ) : error ? (
                <div className="absolute inset-0 flex items-center justify-center bg-red-900/20 p-4">
                  <div className="text-red-400 text-center">{error}</div>
                </div>
              ) : (
                <>
                  <Webcam
                    ref={webcamRef}
                    className="w-full h-full object-cover"
                    videoConstraints={{ width: 1280, height: 720, facingMode: 'user' }}
                    mirrored
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