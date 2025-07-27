import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import NowPlaying from '../components/NowPlaying';
import Queue from '../components/Queue';
import GestureControl from '../components/GestureControl';
import UserProfile from '../components/UserProfile';
import EnhancedLyricsDisplay from '../components/EnhancedLyricsDisplay';
import TrackGenres from '../components/TrackGenres';
import ExploreRecommendations from '../components/ExploreRecommendations';
import useSpotifyStore from '../stores/useSpotifyStore';
import { getCurrentTrack, getQueue, playPause, nextTrack, previousTrack, setVolume, getAudioAnalysis } from '../lib/spotify';
import { AlertCircle, Loader2, Music2, Keyboard, Sparkles } from 'lucide-react';
import { extractDominantColor } from '../lib/colorExtractor';
import { motion, AnimatePresence } from 'framer-motion';

const Player: React.FC = () => {
  const navigate = useNavigate();
  const {
    error, 
    currentTrack, 
    setCurrentTrack, 
    setQueue, 
    setError, 
    setIsPlaying, 
    isPlaying, 
    volume, 
    setVolume: updateVolume,
    setAudioFeatures,
    setAudioAnalysis,
    isAuthenticated
  } = useSpotifyStore();
  const [isLoading, setIsLoading] = useState(true);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [retryCount, setRetryCount] = useState(0);
  const [backgroundColor, setBackgroundColor] = useState<string>('#121212');
  const [showLyrics, setShowLyrics] = useState(true);
  const [showKeyboardShortcuts, setShowKeyboardShortcuts] = useState(false);
  const [_, setSelectedGenre] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'standard' | 'explore'>('standard');
  const albumArtRef = useRef<HTMLImageElement>(null);
  const MAX_RETRIES = 3;
  const [volumeMode, setVolumeMode] = useState(false);
  const [showVolumeModeIndicator, setShowVolumeModeIndicator] = useState(false);

  // Handle keyboard shortcuts
  const handleKeyPress = useCallback((event: KeyboardEvent) => {
    // Skip shortcuts if user is typing in an input field
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
      return;
    }

    switch (event.code) {
      case 'KeyM': // Toggle volume mode
        setVolumeMode((prev) => {
          const newMode = !prev;
          setShowVolumeModeIndicator(newMode);
          if (newMode) {
            setTimeout(() => setShowVolumeModeIndicator(false), 2000);
          }
          return newMode;
        });
        break;
      case 'Space': // Play/Pause
        event.preventDefault();
        playPause(!isPlaying);
        setIsPlaying(!isPlaying);
        break;
      case 'ArrowRight': // Next track
        nextTrack();
        break;
      case 'ArrowLeft': // Previous track
        previousTrack();
        break;
      case 'ArrowUp': // Volume up (only in volume mode)
        if (volumeMode) {
          event.preventDefault();
          const newVolumeUp = Math.min(volume + 5, 100);
          setVolume(newVolumeUp);
          updateVolume(newVolumeUp);
        }
        break;
      case 'ArrowDown': // Volume down (only in volume mode)
        if (volumeMode) {
          event.preventDefault();
          const newVolumeDown = Math.max(volume - 5, 0);
          setVolume(newVolumeDown);
          updateVolume(newVolumeDown);
        }
        break;
      case 'KeyL': // Toggle lyrics
        setShowLyrics(!showLyrics);
        break;
      case 'KeyK': // Show/hide keyboard shortcuts
        setShowKeyboardShortcuts(!showKeyboardShortcuts);
        break;
    }
  }, [isPlaying, setIsPlaying, volume, updateVolume, showLyrics, showKeyboardShortcuts, volumeMode]);

  // Add keyboard event listeners
  useEffect(() => {
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [handleKeyPress]);

  useEffect(() => {
    // Only fetch data if user is authenticated
    if (!isAuthenticated()) {
      setIsLoading(false);
      setIsInitialLoad(false);
      setError(null); // Clear any previous errors
      return;
    }

    const updatePlayerState = async () => {
      try {
        // Only set loading state during initial load
        if (isInitialLoad) {
          setIsLoading(true);
        }
        
        // We don't need to explicitly check token validity here
        // as our API functions will handle that automatically
        const [trackResponse, queueResponse] = await Promise.all([
          getCurrentTrack(),
          getQueue(),
        ]);

        if (trackResponse?.item) {
          setCurrentTrack(trackResponse.item);
          setIsPlaying(trackResponse.is_playing);
          setError(null);
        } else {
          // No track is playing, but this is not an error
          setCurrentTrack(null);
          setIsPlaying(false);
          setError(null);
        }

        if (queueResponse?.queue) {
          setQueue(queueResponse.queue);
        } else {
          setQueue([]);
        }

        setIsLoading(false);
        setIsInitialLoad(false);
        setRetryCount(0);
      } catch (error) {
        console.error('Error updating player state:', error);
        if (error instanceof Error) {
          // If we get "Token expired" error, our token refresh logic will handle it
          if (error.message === 'Token expired') {
            // Don't show error to user, just wait for redirect
            return;
          }
          setError(error.message);
        } else {
          setError('Failed to update player state');
        }
        
        if (retryCount < MAX_RETRIES) {
          setRetryCount(prev => prev + 1);
          // Exponential backoff for retries
          setTimeout(updatePlayerState, Math.pow(2, retryCount) * 1000);
        } else {
          setIsLoading(false);
          setIsInitialLoad(false);
        }
      }
    };

    updatePlayerState();
    const interval = setInterval(updatePlayerState, 5000);
    return () => clearInterval(interval);
  }, [isAuthenticated, navigate, setCurrentTrack, setQueue, setError, setIsPlaying, retryCount, isInitialLoad]);

  // Extract colors from album art when it changes
  useEffect(() => {
    const extractColors = async () => {
      if (currentTrack?.album?.images?.[0]?.url) {
        try {
          const dominantColor = await extractDominantColor(currentTrack.album.images[0].url);
          
          if (dominantColor) {
            const [r, g, b] = dominantColor;
            setBackgroundColor(`rgb(${r}, ${g}, ${b})`);
          }
        } catch (error) {
          console.error('Error extracting colors:', error);
        }
      }
    };
    
    extractColors();
  }, [currentTrack]);

  // Fetch audio features when current track changes
  useEffect(() => {
    const fetchAudioData = async () => {
      if (!currentTrack?.id || !isAuthenticated()) return;
      
      try {
        // Fetch audio features and analysis in one call
        const audioData = await getAudioAnalysis(currentTrack.id);
        
        // We now always have some data structure even on errors
        if (audioData) {
          // Set audio features
          setAudioFeatures({
            energy: audioData.features?.energy ?? 0.5,
            danceability: audioData.features?.danceability ?? 0.5,
            valence: audioData.features?.valence ?? 0.5,
            acousticness: audioData.features?.acousticness ?? 0.5,
            tempo: audioData.features?.tempo ?? 120,
            liveness: audioData.features?.liveness ?? 0.5,
            speechiness: audioData.features?.speechiness ?? 0.5,
            instrumentalness: audioData.features?.instrumentalness ?? 0.5
          });
          
          // Set audio analysis
          setAudioAnalysis({
            beats: audioData.analysis?.beats ?? [],
            bars: audioData.analysis?.bars ?? [],
            tatums: audioData.analysis?.tatums ?? [],
            sections: audioData.analysis?.sections ?? [],
            segments: audioData.analysis?.segments ?? []
          });
        } else {
          // Set default values instead of null
          setAudioFeatures({
            energy: 0.5,
            danceability: 0.5,
            valence: 0.5,
            acousticness: 0.5,
            tempo: 120,
            liveness: 0.5,
            speechiness: 0.5,
            instrumentalness: 0.5
          });
          
          setAudioAnalysis({
            beats: [],
            bars: [],
            tatums: [],
            sections: [],
            segments: []
          });
        }
      } catch (error) {
        console.error('Error fetching audio data:', error);
        // Set default values instead of null
        setAudioFeatures({
          energy: 0.5,
          danceability: 0.5,
          valence: 0.5,
          acousticness: 0.5,
          tempo: 120,
          liveness: 0.5,
          speechiness: 0.5,
          instrumentalness: 0.5
        });
        
        setAudioAnalysis({
          beats: [],
          bars: [],
          tatums: [],
          sections: [],
          segments: []
        });
      }
    };
    
    fetchAudioData();
  }, [currentTrack, isAuthenticated, setAudioFeatures, setAudioAnalysis]);

  

  if (isLoading) {
    return (
      <div className="min-h-screen bg-light dark:bg-dark flex items-center justify-center">
        <motion.div 
          className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-8 flex flex-col items-center"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <Loader2 className="w-8 h-8 text-green-500 animate-spin mb-4" />
          <div className="text-gray-800 dark:text-white text-lg font-medium">
            {retryCount > 0 ? `Retrying... (${retryCount}/${MAX_RETRIES})` : 'Loading your music...'}
          </div>
        </motion.div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-light dark:bg-dark flex items-center justify-center">
        <motion.div 
          className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-8 flex flex-col items-center"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <AlertCircle className="w-8 h-8 text-red-500 mb-4" />
          <div className="text-gray-800 dark:text-white text-lg font-medium">{error}</div>
          <button 
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
          >
            Retry
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <motion.div 
      className="min-h-screen p-4 md:p-8 transition-colors duration-500 overflow-hidden relative"
      style={{ backgroundColor }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      {/* Background gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-black/50 to-black pointer-events-none" />

      <div className="relative z-10 max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <UserProfile />
          <div className="flex items-center gap-2">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowLyrics(!showLyrics)}
              className={`p-2 rounded-full ${
                showLyrics 
                  ? 'bg-green-500 text-white' 
                  : 'bg-white/10 text-white hover:bg-white/20'
              } transition-colors`}
              title="Toggle lyrics (L)"
            >
              <Music2 className="w-5 h-5" />
            </motion.button>
            
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowKeyboardShortcuts(!showKeyboardShortcuts)}
              className={`p-2 rounded-full ${
                showKeyboardShortcuts 
                  ? 'bg-green-500 text-white' 
                  : 'bg-white/10 text-white hover:bg-white/20'
              } transition-colors`}
              title="Keyboard shortcuts (K)"
            >
              <Keyboard className="w-5 h-5" />
            </motion.button>
            {/* Volume mode indicator badge */}
            {volumeMode && (
              <span className="ml-2 px-3 py-1 rounded-full bg-green-600 text-white text-xs font-semibold shadow-lg animate-pulse" title="Volume mode active">
                Volume Mode
              </span>
            )}
          </div>
        </div>

        {/* Floating volume mode indicator */}
        <AnimatePresence>
          {showVolumeModeIndicator && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="fixed top-8 left-1/2 -translate-x-1/2 z-50 bg-green-600 text-white px-6 py-3 rounded-full shadow-2xl text-lg font-bold animate-pulse"
            >
              Volume Mode Enabled
            </motion.div>
          )}
        </AnimatePresence>

        {/* Keyboard shortcuts dialog */}
        <AnimatePresence>
          {showKeyboardShortcuts && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="absolute top-20 right-4 bg-gray-900/90 backdrop-blur-md p-6 rounded-xl shadow-2xl border border-white/10 z-50 w-80"
            >
              <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                <Keyboard className="w-5 h-5" /> Keyboard Shortcuts
              </h3>
              <ul className="space-y-3">
                <li className="flex justify-between text-sm">
                  <span className="text-white">Toggle volume mode</span>
                  <span className="bg-white/10 px-3 py-1 rounded text-gray-300 font-mono">M</span>
                </li>
                <li className="flex justify-between text-sm">
                  <span className="text-white">{volumeMode ? 'Volume up' : 'Scroll up'}</span>
                  <span className="bg-white/10 px-3 py-1 rounded text-gray-300 font-mono">↑</span>
                </li>
                <li className="flex justify-between text-sm">
                  <span className="text-white">{volumeMode ? 'Volume down' : 'Scroll down'}</span>
                  <span className="bg-white/10 px-3 py-1 rounded text-gray-300 font-mono">↓</span>
                </li>
                <li className="flex justify-between text-sm">
                  <span className="text-white">Play/Pause</span>
                  <span className="bg-white/10 px-3 py-1 rounded text-gray-300 font-mono">Space</span>
                </li>
                <li className="flex justify-between text-sm">
                  <span className="text-white">Previous track</span>
                  <span className="bg-white/10 px-3 py-1 rounded text-gray-300 font-mono">←</span>
                </li>
                <li className="flex justify-between text-sm">
                  <span className="text-white">Next track</span>
                  <span className="bg-white/10 px-3 py-1 rounded text-gray-300 font-mono">→</span>
                </li>
                <li className="flex justify-between text-sm">
                  <span className="text-white">Toggle lyrics</span>
                  <span className="bg-white/10 px-3 py-1 rounded text-gray-300 font-mono">L</span>
                </li>
                <li className="flex justify-between text-sm">
                  <span className="text-white">Show/hide shortcuts</span>
                  <span className="bg-white/10 px-3 py-1 rounded text-gray-300 font-mono">K</span>
                </li>
              </ul>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex flex-col lg:flex-row gap-6">
          <div className="flex-1 flex flex-col h-full">
            <NowPlaying albumArtRef={albumArtRef} />
            <TrackGenres onGenreClick={(genre) => setSelectedGenre(genre)} />
            {/* Recommendations Tabs */}
            <div className="mb-2">
              <div className="flex space-x-2">
                <button
                  onClick={() => setActiveTab('standard')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center ${
                    activeTab === 'standard'
                      ? 'bg-green-500 text-white'
                      : 'bg-white/10 text-white hover:bg-white/20'
                  }`}
                >
                  <Music2 className="w-4 h-4 mr-2" />
                  Quick Recommendations
                </button>
                <button
                  onClick={() => setActiveTab('explore')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center ${
                    activeTab === 'explore'
                      ? 'bg-green-500 text-white'
                      : 'bg-white/10 text-white hover:bg-white/20'
                  }`}
                >
                  <Sparkles className="w-4 h-4 mr-2" />
                  Explore Deep
                </button>
              </div>
            </div>
            {/* Tab Content */}
            <div className="flex-1 min-h-0 flex flex-col">
              <AnimatePresence mode="wait">
                {activeTab === 'standard' ? (
                  <motion.div
                    key="standard"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="flex-1 flex flex-col"
                  >
                    <Queue />
                  </motion.div>
                ) : (
                  <motion.div
                    key="explore"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <ExploreRecommendations />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <div className="mt-6">
              <GestureControl />
            </div>
          </div>

          <AnimatePresence mode="wait">
            {showLyrics && (
              <motion.div 
                className="w-full lg:w-[400px]"
                initial={{ opacity: 0, x: 50 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 50 }}
                transition={{ duration: 0.3 }}
              >
                <EnhancedLyricsDisplay />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
};

export default Player;
