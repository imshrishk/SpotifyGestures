import React, { useEffect, useRef, useState } from 'react';
import Webcam from 'react-webcam';
import { Camera, Eye, Hand, RefreshCw } from 'lucide-react';
import { initializeHandDetector, detectHand } from '../lib/handGestureDetector';
import { playPause, nextTrack, previousTrack, setVolume, likeTrack, dislikeTrack, toggleShuffle, getRecommendations } from '../lib/spotify';
import useSpotifyStore from '../stores/useSpotifyStore';
import { motion, AnimatePresence } from 'framer-motion';

const GestureControl: React.FC = () => {
  const webcamRef = useRef<Webcam>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [useGestures, setUseGestures] = useState(true);
  const [showWebcam, setShowWebcam] = useState(false);
  const [lastDetectedGesture, setLastDetectedGesture] = useState<string>('');
  const [successfulAction, setSuccessfulAction] = useState<string | null>(null);
  const [sensitivity, setSensitivity] = useState<number>(5); // 1-10 scale
  const { isPlaying, volume, setVolume: updateStoreVolume, setIsPlaying, currentTrack } = useSpotifyStore();

  const videoConstraints = {
    width: 1280,
    height: 720,
    facingMode: "user"
  };

  // Show success feedback when a gesture is successfully processed
  const showSuccessFeedback = (action: string) => {
    setSuccessfulAction(action);
    setTimeout(() => setSuccessfulAction(null), 2000);
  };

  useEffect(() => {
    let detectionInterval: NodeJS.Timeout;
    let gestureCooldown = false;
    let consecutiveFailures = 0;
    const MAX_FAILURES = 5;

    const runHandDetection = async () => {
      if (!webcamRef.current?.video || !useGestures || gestureCooldown) return;

      try {
        const gesture = await detectHand(webcamRef.current.video);
        consecutiveFailures = 0; // Reset failures on successful detection attempt
        
        if (gesture) {
          gestureCooldown = true;
          setTimeout(() => gestureCooldown = false, 500);

          setLastDetectedGesture(gesture.type);
          setTimeout(() => setLastDetectedGesture(''), 2000);

          // Enhanced gesture handling with new gestures
          switch(gesture.type) {
            case 'open':
              if (!isPlaying) {
                await playPause(true);
                setIsPlaying(true);
                showSuccessFeedback('Playing music');
              }
              break;
            case 'closed':
              if (isPlaying) {
                await playPause(false);
                setIsPlaying(false);
                showSuccessFeedback('Paused music');
              }
              break;
            case 'thumbsUp':
              if (currentTrack) {
                await likeTrack(currentTrack.id);
                showSuccessFeedback('Liked track');
              }
              break;
            case 'thumbsDown':
              if (currentTrack) {
                await dislikeTrack(currentTrack.id);
                showSuccessFeedback('Disliked track');
                // Skip to next track after dislike
                await nextTrack();
              }
              break;
            case 'peace':
              // Peace sign for toggling shuffle
              await toggleShuffle();
              showSuccessFeedback('Toggled shuffle');
              break;
            case 'rock':
              // Rock sign for getting recommendations
              await getRecommendations();
              showSuccessFeedback('Loaded recommendations');
              break;
            default:
              // No specific gesture, check for directions
              break;
          }

          // Handle directional gestures
          if (gesture.direction) {
            switch(gesture.direction) {
              case 'right':
                await nextTrack();
                showSuccessFeedback('Next track');
                break;
              case 'left':
                await previousTrack();
                showSuccessFeedback('Previous track');
                break;
              case 'up':
                const newVolumeUp = Math.min(volume + sensitivity * 2, 100);
                await setVolume(newVolumeUp);
                updateStoreVolume(newVolumeUp);
                showSuccessFeedback(`Volume: ${newVolumeUp}%`);
                break;
              case 'down':
                const newVolumeDown = Math.max(volume - sensitivity * 2, 0);
                await setVolume(newVolumeDown);
                updateStoreVolume(newVolumeDown);
                showSuccessFeedback(`Volume: ${newVolumeDown}%`);
                break;
            }
          }
          
          // Handle pointing gestures
          if (gesture.isPointingUp) {
            const newVolume = Math.min(volume + sensitivity * 2, 100);
            await setVolume(newVolume);
            updateStoreVolume(newVolume);
            showSuccessFeedback(`Volume: ${newVolume}%`);
          } else if (gesture.isPointingDown) {
            const newVolume = Math.max(volume - sensitivity * 2, 0);
            await setVolume(newVolume);
            updateStoreVolume(newVolume);
            showSuccessFeedback(`Volume: ${newVolume}%`);
          }
        }
      } catch (err) {
        console.error('Detection error:', err);
        consecutiveFailures++;
        if (consecutiveFailures > MAX_FAILURES) {
          setError('Gesture detection is experiencing issues. Try refreshing.');
          setUseGestures(false);
        }
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
  }, [isPlaying, volume, updateStoreVolume, setIsPlaying, useGestures, currentTrack, sensitivity]);

  // Restart gesture detection
  const restartDetection = async () => {
    setUseGestures(false);
    setTimeout(() => setUseGestures(true), 100);
  };

  return (
    <div className="space-y-4 bg-gray-800/50 backdrop-blur-lg rounded-2xl p-6 border border-white/10">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-xl text-white flex items-center gap-2">
          <Hand className="w-6 h-6" /> Gesture Control
        </h3>
        <div className="flex items-center gap-2">
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
                  videoConstraints={videoConstraints}
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

      <div className="grid grid-cols-2 gap-4 mt-6">
        {[
          { icon: '🖐️', text: 'Open Hand - Play', color: 'bg-green-500' },
          { icon: '✊', text: 'Closed Fist - Pause', color: 'bg-red-500' },
          { icon: '👉', text: 'Swipe Right - Next', color: 'bg-blue-500' },
          { icon: '👈', text: 'Swipe Left - Previous', color: 'bg-blue-500' },
          { icon: '👍', text: 'Thumbs Up - Like', color: 'bg-purple-500' },
          { icon: '👎', text: 'Thumbs Down - Dislike', color: 'bg-purple-500' },
          { icon: '☝️', text: 'Point Up - Vol+', color: 'bg-yellow-500' },
          { icon: '👇', text: 'Point Down - Vol-', color: 'bg-yellow-500' },
          { icon: '✌️', text: 'Peace Sign - Shuffle', color: 'bg-indigo-500' },
          { icon: '🤘', text: 'Rock Sign - Recommendations', color: 'bg-pink-500' },
        ].map(({ icon, text, color }, index) => (
          <div key={index} className="flex items-center gap-3 p-3 bg-gray-900/50 rounded-xl">
            <span className={`${color} w-8 h-8 rounded-full flex items-center justify-center`}>
              {icon}
            </span>
            <span className="text-gray-300">{text}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default GestureControl;
