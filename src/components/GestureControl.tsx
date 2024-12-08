import React, { useEffect, useRef, useState } from 'react';
import Webcam from 'react-webcam';
import { Camera, Settings2, Eye } from 'lucide-react';
import { initializeHandDetector, detectHand } from '../lib/handGestureDetector';
import { playPause, nextTrack, previousTrack, setVolume } from '../lib/spotify';
import useSpotifyStore from '../stores/useSpotifyStore';

const GestureControl: React.FC = () => {
  const webcamRef = useRef<Webcam>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [useGestures, setUseGestures] = useState(true);
  const [showWebcam, setShowWebcam] = useState(false);
  const { isPlaying, volume, setVolume, setIsPlaying } = useSpotifyStore();

  const videoConstraints = {
    width: 640,
    height: 480,
    facingMode: "user"
  };

  useEffect(() => {
    let detectionInterval: NodeJS.Timeout;
    
    const runHandDetection = async () => {
      if (!webcamRef.current?.video || !useGestures) return;

      try {
        const gesture = await detectHand(webcamRef.current.video);
        
        if (gesture) {
          if (gesture.isOpen && !isPlaying) {
            await playPause(true);
            setIsPlaying(true);
          } else if (gesture.isClosed && isPlaying) {
            await playPause(false);
            setIsPlaying(false);
          } else if (gesture.direction === 'right') {
            await nextTrack();
          } else if (gesture.direction === 'left') {
            await previousTrack();
          } else if (gesture.isPointingUp) {
            const newVolume = Math.min(volume + 10, 100);
            await setVolume(newVolume);
          } else if (gesture.isPointingDown) {
            const newVolume = Math.max(volume - 10, 0);
            await setVolume(newVolume);
          }
        }
      } catch (err) {
        console.error('Hand detection error:', err);
      }
    };

    const setupCamera = async () => {
      try {
        setIsLoading(true);
        await initializeHandDetector();
        setIsLoading(false);
        
        if (useGestures) {
          // Run detection every 500ms, even when page is in background
          detectionInterval = setInterval(runHandDetection, 500);
        }
      } catch (err) {
        setError('Failed to initialize camera. Please ensure camera permissions are granted.');
        setIsLoading(false);
      }
    };

    if (useGestures) {
      setupCamera();
    }

    return () => {
      if (detectionInterval) {
        clearInterval(detectionInterval);
      }
    };
  }, [isPlaying, volume, setVolume, setIsPlaying, useGestures]);

  return (
    <div className="space-y-4 bg-gray-800 rounded-2xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-medium text-white">Gesture Control</h3>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setUseGestures(!useGestures)}
            className={`px-4 py-2 rounded-full transition-colors ${
              useGestures 
                ? 'bg-green-500 text-white' 
                : 'bg-gray-700 text-gray-300'
            }`}
          >
            {useGestures ? 'Gestures On' : 'Gestures Off'}
          </button>
          {useGestures && (
            <button
              onClick={() => setShowWebcam(!showWebcam)}
              className="p-2 bg-gray-700 text-gray-300 rounded-full hover:bg-gray-600"
            >
              {showWebcam ? <Eye className="w-5 h-5" /> : <Camera className="w-5 h-5" />}
            </button>
          )}
        </div>
      </div>

      {useGestures && showWebcam && (
        <div className="relative w-full h-[360px] bg-black rounded-lg overflow-hidden">
          {isLoading ? (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
              <div className="text-white">Initializing camera...</div>
            </div>
          ) : error ? (
            <div className="absolute inset-0 flex items-center justify-center bg-red-900/20 p-4">
              <div className="text-red-500 text-center">{error}</div>
            </div>
          ) : (
            <Webcam
              ref={webcamRef}
              className="w-full h-full object-cover"
              videoConstraints={videoConstraints}
              mirrored
            />
          )}
        </div>
      )}

      <div className="bg-gray-900 p-4 rounded-lg">
        <h3 className="font-medium mb-2 flex items-center gap-2 text-white">
          <Settings2 className="w-4 h-4" />
          Gesture Guide
        </h3>
        <ul className="space-y-2 text-sm text-gray-400">
          {[
            { icon: '🖐️', text: 'Open Palm - Play' },
            { icon: '✊', text: 'Closed Palm - Pause' },
            { icon: '👉', text: 'Hand Right - Next Track' },
            { icon: '👈', text: 'Hand Left - Previous Track' },
            { icon: '☝️', text: 'Point Up - Volume Up' },
            { icon: '👇', text: 'Point Down - Volume Down' }
          ].map(({ icon, text }, index) => (
            <li key={index} className="flex items-center gap-2">
              <span className="w-6">{icon}</span>
              <span>{text}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default GestureControl;