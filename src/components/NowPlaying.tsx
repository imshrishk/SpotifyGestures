
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, Repeat, Shuffle, Heart, ListMusic, Share2, BarChart, Waves, CircleDot, Sparkles, Music, Plus, AlertCircle, Check as CheckIcon } from 'lucide-react';
import { motion, useAnimation, AnimatePresence } from 'framer-motion';
import { useColorThief } from '../hooks/useColorThief';
import useSpotifyStore from '../stores/useSpotifyStore';
import { playPause, nextTrack, previousTrack, setVolume, shufflePlaylist, toggleRepeat, likeTrack, getCurrentTrack, seekToPosition } from '../lib/spotify';
import { SpotifyApi } from '../lib/spotifyApi';
import AudioVisualizer from './AudioVisualizer';
import PlaylistManager from './PlaylistManager';

interface NowPlayingProps {
  albumArtRef?: React.RefObject<HTMLImageElement>;
}

// Define interface for a track
interface TrackInfo {
  id: string;
  name: string;
  artists: { 
    name: string;
    id?: string;
  }[];
  uri: string;
  duration_ms?: number;
  albumName: string;
  albumImage: string;
  audioFeatures?: {
    energy?: number;
    danceability?: number;
    valence?: number;
    acousticness?: number;
    tempo?: number;
    key?: number;
    mode?: number;
  };
}

const NowPlaying: React.FC<NowPlayingProps> = ({ albumArtRef: externalAlbumArtRef }) => {
  const { currentTrack, isPlaying, volume, setVolume, setIsPlaying, setProgressMs, token } = useSpotifyStore();
  const [repeatMode, setRepeatMode] = useState<'off' | 'track' | 'context'>('off');
  const [isShuffled, setIsShuffled] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isLiked, setIsLiked] = useState(false);
  const [isHoveringArtwork, setIsHoveringArtwork] = useState(false);
  const [showPlaylists, setShowPlaylists] = useState(false);
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [playbackState, setPlaybackState] = useState<any>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragProgress, setDragProgress] = useState(0);
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);
  const progressBarRef = useRef<HTMLDivElement>(null);
  const internalAlbumArtRef = useRef<HTMLImageElement>(null);
  const controls = useAnimation();
  const [visualizerStyle, setVisualizerStyle] = useState<'bars' | 'wave' | 'circles' | 'particles'>('bars');
  const [visualizerColor, setVisualizerColor] = useState<string>('green');
  const availableColors = ['green', 'blue', 'purple', 'pink', 'red', 'orange', 'yellow'];
  const [error, setError] = useState<string | null>(null);
  const [selectedTrackId, setSelectedTrackId] = useState<string | null>(null);
  const [showFeatures, setShowFeatures] = useState<string | null>(null);
  const [currentContext, setCurrentContext] = useState<string | null>(null);
  const [playlistName, setPlaylistName] = useState<string | null>(null);
  
  // Use the external ref if provided, otherwise use the internal one
  const albumArtRef = externalAlbumArtRef || internalAlbumArtRef;
  
  // Color thief hook for extracting colors from album art
  const { getColor, initializeColorThief } = useColorThief(albumArtRef);

  // Function to get playlist name
  const getPlaylistName = async (playlistId: string) => {
    if (!token) return;
    try {
      const response = await fetch(`https://api.spotify.com/v1/playlists/${playlistId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        return data.name;
      }
    } catch (error) {
      console.error('Error fetching playlist name:', error);
    }
    return null;
  };

  // Initialize color thief when album art loads
  useEffect(() => {
    if (albumArtRef.current && currentTrack?.album?.images?.[0]?.url) {
      initializeColorThief();
    }
  }, [currentTrack?.album?.images?.[0]?.url, initializeColorThief]);

  // Extract and apply colors when available
  useEffect(() => {
    if (albumArtRef.current) {
      const color = getColor();
      if (color) {
        const [r, g, b] = color;
        const colorHex = `rgb(${r}, ${g}, ${b})`;
        document.documentElement.style.setProperty('--primary-color', colorHex);
      }
    }
  }, [currentTrack?.album?.images?.[0]?.url, getColor]);

  const formatTime = (ms: number) => {
    if (!ms) return '0:00';
    const date = new Date(ms);
    const minutes = date.getUTCMinutes();
    const seconds = date.getUTCSeconds().toString().padStart(2, '0');
    return `${minutes}:${seconds}`;
  };

  const updatePlaybackState = useCallback(async () => {
    try {
      const state = await getCurrentTrack();
      if (state?.item && state.progress_ms !== null && state.item.duration_ms) {
        setPlaybackState(state);
        setProgressMs(state.progress_ms);
        if (!isDragging) {
          setProgress((state.progress_ms / state.item.duration_ms) * 100);
        }
        
        // Extract context information
        if (state.context) {
          const contextUri = state.context.uri;
          if (contextUri) {
            if (contextUri.includes('playlist')) {
              const playlistId = contextUri.split(':').pop();
              if (playlistId) {
                // Try to get playlist name
                const name = await getPlaylistName(playlistId);
                if (name) {
                  setCurrentContext(`Playlist • ${name}`);
                  setPlaylistName(name);
                } else {
                  setCurrentContext(`Playlist • ${playlistId}`);
                }
              }
            } else if (contextUri.includes('album')) {
              const albumId = contextUri.split(':').pop();
              setCurrentContext(`Album • ${albumId}`);
            } else if (contextUri.includes('artist')) {
              const artistId = contextUri.split(':').pop();
              setCurrentContext(`Artist • ${artistId}`);
            } else if (contextUri.includes('user')) {
              setCurrentContext('Your Library');
            } else if (contextUri.includes('spotify:user:spotify:playlist:37i9dQZF1DXcBWIGoYBM5M')) {
              setCurrentContext('Today\'s Top Hits');
            } else if (contextUri.includes('spotify:user:spotify:playlist:37i9dQZEVXbMDoHDwVN2tF')) {
              setCurrentContext('Global Top 50');
            } else {
              setCurrentContext('Smart Shuffle');
            }
          } else {
            setCurrentContext('Smart Shuffle');
          }
        } else {
          setCurrentContext('Smart Shuffle');
        }
      }
    } catch (error) {
      console.error('Error updating playback state:', error);
    }
  }, [isDragging, setProgressMs]);

  useEffect(() => {
    updatePlaybackState();
    const interval = setInterval(updatePlaybackState, 1000);
    return () => clearInterval(interval);
  }, [updatePlaybackState]);

  const handlePlayPause = async () => {
    try {
      await controls.start({ scale: [1, 0.9, 1] });
      await playPause(!isPlaying);
      setIsPlaying(!isPlaying);
    } catch (error) {
      console.error('Error toggling play/pause:', error);
    }
  };

  const handleNext = async () => {
    try {
      await nextTrack();
    } catch (error) {
      console.error('Error skipping to next track:', error);
    }
  };

  const handlePrevious = async () => {
    try {
      await previousTrack();
    } catch (error) {
      console.error('Error skipping to previous track:', error);
    }
  };

  const handleVolumeChange = async (newVolume: number) => {
    try {
      await setVolume(newVolume);
      setVolume(newVolume);
    } catch (error) {
      console.error('Error setting volume:', error);
    }
  };

  const handleShuffle = async () => {
    try {
      await shufflePlaylist(!isShuffled);
      setIsShuffled(!isShuffled);
    } catch (error) {
      console.error('Error toggling shuffle:', error);
    }
  };

  const handleRepeat = async () => {
    const nextRepeatMode: ('off' | 'track' | 'context')[] = ['off', 'track', 'context'];
    const currentIndex = nextRepeatMode.indexOf(repeatMode);
    const newRepeatMode = nextRepeatMode[(currentIndex + 1) % nextRepeatMode.length];
    try {
      await toggleRepeat(newRepeatMode);
      setRepeatMode(newRepeatMode);
    } catch (error) {
      console.error('Error toggling repeat:', error);
    }
  };

  const handleLike = async () => {
    if (!currentTrack) return;
    try {
      const newLikeState = await likeTrack(currentTrack.id);
      setIsLiked(newLikeState);
    } catch (error) {
      console.error('Error toggling track like:', error);
    }
  };

  const playArtistTracks = async (artistId: string) => {
    if (!token || !artistId) return;
    
    try {
      // Play the artist's context (top tracks)
      await SpotifyApi.playContext(token, `spotify:artist:${artistId}`);
    } catch (error) {
      console.error('Error playing artist tracks:', error);
    }
  };

  const handleProgressBarClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressBarRef.current || !currentTrack) return;
    
    const rect = progressBarRef.current.getBoundingClientRect();
    const clickPosition = e.clientX - rect.left;
    const percentage = (clickPosition / rect.width) * 100;
    const newPosition = Math.floor((percentage / 100) * currentTrack.duration_ms);
    
    seekToPosition(newPosition);
    setProgress(percentage);
  };

  const handleProgressBarMouseDown = () => {
    setIsDragging(true);
  };

  const handleProgressBarMouseUp = async (e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressBarRef.current || !currentTrack) {
      setIsDragging(false);
      return;
    }
    
    const rect = progressBarRef.current.getBoundingClientRect();
    const clickPosition = e.clientX - rect.left;
    const percentage = (clickPosition / rect.width) * 100;
    const newPosition = Math.floor((percentage / 100) * currentTrack.duration_ms);
    
    try {
      await seekToPosition(newPosition);
      setProgress(percentage);
    } catch (error) {
      console.error('Error seeking to position:', error);
    }
    
    setIsDragging(false);
  };

  const handleProgressBarMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging || !progressBarRef.current) return;
    
    const rect = progressBarRef.current.getBoundingClientRect();
    const mousePosition = e.clientX - rect.left;
    const percentage = Math.max(0, Math.min(100, (mousePosition / rect.width) * 100));
    
    setDragProgress(percentage);
  };

  const handleProgressBarMouseLeave = () => {
    if (isDragging) {
      setIsDragging(false);
    }
  };

  const handleShare = async () => {
    if (!currentTrack) return;
    
    try {
      await navigator.share({
        title: currentTrack.name,
        text: `Check out ${currentTrack.name} by ${currentTrack.artists.map(artist => artist.name).join(', ')} on Spotify!`,
        url: currentTrack.external_urls.spotify
      });
    } catch (error) {
      console.error('Error sharing:', error);
      // Fallback to copying link to clipboard
      navigator.clipboard.writeText(currentTrack.external_urls.spotify);
      // You could show a toast notification here
    }
  };

  // Change visualizer style
  const cycleVisualizerStyle = () => {
    const styles: ('bars' | 'wave' | 'circles' | 'particles')[] = ['bars', 'wave', 'circles', 'particles'];
    const currentIndex = styles.indexOf(visualizerStyle);
    const nextStyle = styles[(currentIndex + 1) % styles.length];
    setVisualizerStyle(nextStyle);
  };

  // Change visualizer color
  const cycleVisualizerColor = () => {
    const currentIndex = availableColors.indexOf(visualizerColor);
    const nextColor = availableColors[(currentIndex + 1) % availableColors.length];
    setVisualizerColor(nextColor);
  };

  // Color mapping for the color button
  const getColorHex = (colorName: string): string => {
    const colorMap: Record<string, string> = {
      green: '#10b981',
      blue: '#3b82f6',
      purple: '#8b5cf6',
      pink: '#ec4899',
      red: '#ef4444',
      orange: '#f97316',
      yellow: '#eab308'
    };
    return colorMap[colorName] || colorMap.green;
  };

  // Handle adding tracks to queue
  const addToQueue = async (uri: string, id: string) => {
    if (!token) {
      setError('Authentication error. Please log in again.');
      return;
    }
    
    try {
      setSelectedTrackId(id); // Show loading state
      const response = await fetch(`https://api.spotify.com/v1/me/player/queue?uri=${encodeURIComponent(uri)}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      
      if (!response.ok) {
        throw new Error(`Failed to add to queue: ${response.status}`);
      }
      
      // Show success for a moment
      setTimeout(() => setSelectedTrackId(null), 1500);
    } catch (err) {
      console.error('Failed to add to queue:', err);
      setSelectedTrackId(null);
      setError('Could not add to queue. Make sure Spotify is playing.');
      setTimeout(() => setError(null), 3000);
    }
  };

  // Handle playing a track immediately
  const playSongNow = async (uri: string) => {
    if (!token) {
      setError('Authentication error. Please log in again.');
      return;
    }
    
    try {
      await SpotifyApi.playSmartly(token, uri);
    } catch (err) {
      console.error('Failed to play track:', err);
      setError('Could not play this track. Make sure Spotify is active on a device.');
      setTimeout(() => setError(null), 3000);
    }
  };

  // Toggle showing audio features for a track
  const toggleFeatures = (id: string) => {
    if (showFeatures === id) {
      setShowFeatures(null);
    } else {
      setShowFeatures(id);
    }
  };

  // Format percentage value with % sign
  const formatPercentage = (value: number | undefined | null) => {
    if (value === undefined || value === null) return '--';
    return `${Math.round(value * 100)}%`;
  };

  // Format tempo (BPM)
  const formatTempo = (tempo: number | undefined | null) => {
    if (tempo === undefined || tempo === null) return '--';
    return `${Math.round(tempo)} BPM`;
  };

  // Convert musical key number to note name
  const keyToNoteName = (key: number | undefined | null, mode: number | undefined | null) => {
    if (key === undefined || key === null) return 'Unknown';
    
    const keyNames = ['C', 'C♯/D♭', 'D', 'D♯/E♭', 'E', 'F', 'F♯/G♭', 'G', 'G♯/A♭', 'A', 'A♯/B♭', 'B'];
    const modeName = mode === 1 ? 'Major' : 'Minor';
    
    return `${keyNames[key]} ${modeName}`;
  };

  // Get a color based on feature value (0-1)
  const getFeatureColor = (value: number | undefined | null) => {
    if (value === undefined || value === null) return 'bg-gray-300';
    
    if (value < 0.3) return 'bg-blue-500';
    if (value < 0.6) return 'bg-green-500';
    return 'bg-red-500';
  };

  if (!currentTrack || !token) {
    return (
      <motion.div 
        className="bg-gradient-to-br from-gray-900/90 to-black/90 backdrop-blur-md rounded-xl shadow-xl p-4 border border-white/10 w-full"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="p-6 text-center text-gray-400">
          <AlertCircle className="w-6 h-6 mx-auto mb-2" />
          <p>Start playing a track on Spotify to see player controls</p>
        </div>
      </motion.div>
    );
  }

  // Create a track info object from the current track
  const trackInfo: TrackInfo = {
    id: currentTrack.id,
    name: currentTrack.name,
    artists: currentTrack.artists,
    uri: currentTrack.uri,
    duration_ms: currentTrack.duration_ms,
    albumName: currentTrack.album?.name || 'Unknown Album',
    albumImage: currentTrack.album?.images?.[0]?.url || 'https://via.placeholder.com/64',
    // Handle the audioFeatures property safely with optional chaining
    audioFeatures: (currentTrack as any).audioFeatures
  };

  return (
    <motion.div 
      className="bg-gradient-to-br from-gray-900/90 to-black/90 backdrop-blur-md rounded-2xl shadow-2xl p-6 w-full border border-white/10"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <div className="flex flex-col md:flex-row gap-8">
        {/* Album Art */}
        <div className="flex-shrink-0 w-full md:w-[300px]">
          <motion.div 
            className="relative overflow-hidden rounded-2xl shadow-2xl aspect-square group"
            onHoverStart={() => setIsHoveringArtwork(true)}
            onHoverEnd={() => setIsHoveringArtwork(false)}
            whileHover={{ scale: 1.02 }}
            transition={{ duration: 0.3 }}
          >
            <img
              ref={albumArtRef}
              src={currentTrack?.album?.images?.[0]?.url}
              alt={currentTrack?.album?.name}
              className="w-full h-full object-cover transform transition-transform duration-300 group-hover:scale-105"
            />
            
            <AudioVisualizer isPlaying={isPlaying} style={visualizerStyle} color={visualizerColor} />
            
            {/* Visualizer Control Buttons (appear on hover) */}
            <motion.div 
              className="absolute bottom-4 right-4 flex gap-2 z-10"
              initial={{ opacity: 0 }}
              animate={{ opacity: isHoveringArtwork ? 1 : 0 }}
              transition={{ duration: 0.2 }}
            >
              <button 
                onClick={(e) => { e.stopPropagation(); cycleVisualizerStyle(); }}
                className="p-1.5 bg-black/60 backdrop-blur-sm rounded-full text-white hover:bg-black/80 transition-colors"
                title="Change visualizer style"
              >
                {visualizerStyle === 'bars' && <BarChart className="w-4 h-4" />}
                {visualizerStyle === 'wave' && <Waves className="w-4 h-4" />}
                {visualizerStyle === 'circles' && <CircleDot className="w-4 h-4" />}
                {visualizerStyle === 'particles' && <Sparkles className="w-4 h-4" />}
              </button>
              <button 
                onClick={(e) => { e.stopPropagation(); cycleVisualizerColor(); }}
                className={`p-1.5 bg-black/60 backdrop-blur-sm rounded-full hover:bg-black/80 transition-colors`}
                style={{ color: getColorHex(visualizerColor) }}
                title="Change visualizer color"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 22C6.49 22 2 17.51 2 12S6.49 2 12 2s10 4.04 10 9c0 3.31-2.69 6-6 6h-1.77c-.28 0-.5.22-.5.5 0 .12.05.23.13.33.41.47.64 1.06.64 1.67A2.5 2.5 0 0 1 12 22zm0-18c-4.41 0-8 3.59-8 8s3.59 8 8 8c.28 0 .5-.22.5-.5a.54.54 0 0 0-.14-.35c-.41-.46-.63-1.05-.63-1.65a2.5 2.5 0 0 1 2.5-2.5H16c2.21 0 4-1.79 4-4 0-3.86-3.59-7-8-7z"/>
                </svg>
              </button>
            </motion.div>
            
            <motion.div 
              className="absolute inset-0 bg-black/50 flex items-center justify-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: isHoveringArtwork ? 1 : 0 }}
              transition={{ duration: 0.2 }}
            >
              <motion.button
                onClick={() => playSongNow(trackInfo.uri)}
                className="p-8 bg-green-500/90 hover:bg-green-600 rounded-full backdrop-blur-sm shadow-lg"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <Play className="w-12 h-12 text-white" />
              </motion.button>
            </motion.div>
          </motion.div>
        </div>

        {/* Track Info and Controls */}
        <div className="flex-1 flex flex-col justify-between min-w-0">
          {/* Track Info */}
          <div className="space-y-2">
            <motion.h2 
              className="text-2xl font-bold text-white truncate cursor-pointer hover:text-green-400 transition-colors"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              onClick={() => token && currentTrack.uri && SpotifyApi.playSmartly(token, currentTrack.uri)}
            >
              {currentTrack.name}
            </motion.h2>
            <motion.p 
              className="text-gray-400 truncate"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              {currentTrack.artists.map((artist: { name: string; id?: string }, index: number) => (
                <React.Fragment key={artist.id || index}>
                  {index > 0 && ", "}
                  <span 
                    className="cursor-pointer hover:text-green-400 transition-colors"
                    onClick={() => artist.id && playArtistTracks(artist.id)}
                  >
                    {artist.name}
                  </span>
                </React.Fragment>
              ))}
            </motion.p>
            <motion.p 
              className="text-gray-500 text-sm truncate cursor-pointer hover:text-green-400 transition-colors"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              onClick={() => token && currentTrack.album?.uri && SpotifyApi.playSmartly(token, currentTrack.uri, currentTrack.album.uri)}
            >
              {currentTrack.album.name}
            </motion.p>
            {currentContext && (
              <motion.div 
                className="text-xs text-gray-600 bg-gray-800/50 px-2 py-1 rounded-full inline-block"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
              >
                {playlistName ? `Playlist • ${playlistName}` : currentContext}
              </motion.div>
            )}
          </div>

          {/* Progress Bar */}
          <div className="space-y-2 my-4">
            <motion.div 
              ref={progressBarRef}
              className="w-full bg-white/10 rounded-full h-2 cursor-pointer relative overflow-hidden group"
              onClick={handleProgressBarClick}
              onMouseDown={handleProgressBarMouseDown}
              onMouseUp={handleProgressBarMouseUp}
              onMouseMove={handleProgressBarMouseMove}
              onMouseLeave={handleProgressBarMouseLeave}
              whileHover={{ height: '0.625rem' }}
              transition={{ duration: 0.2 }}
            >
              <motion.div
                className="bg-green-500 h-full rounded-full transition-all relative"
                style={{ width: `${isDragging ? dragProgress : progress}%` }}
                layoutId="progress"
              >
                <div 
                  className="absolute right-0 top-1/2 transform -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow-md opacity-0 group-hover:opacity-100 transition-opacity"
                />
              </motion.div>
            </motion.div>
            <div className="flex justify-between text-sm text-gray-400">
              <span>{formatTime(isDragging ? (dragProgress / 100) * currentTrack.duration_ms : playbackState?.progress_ms || 0)}</span>
              <span>{formatTime(currentTrack?.duration_ms || 0)}</span>
            </div>
          </div>

          {/* Playback Controls */}
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <motion.button
                  onClick={handlePrevious}
                  className="p-2 hover:bg-white/10 rounded-full transition-colors"
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                >
                  <SkipBack className="w-5 h-5 text-white" />
                </motion.button>
                <motion.button
                  onClick={handlePlayPause}
                  className="p-3 bg-white/10 hover:bg-white/20 rounded-full transition-colors"
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                >
                  {isPlaying ? (
                    <Pause className="w-5 h-5 text-white" />
                  ) : (
                    <Play className="w-5 h-5 text-white" />
                  )}
                </motion.button>
                <motion.button
                  onClick={handleNext}
                  className="p-2 hover:bg-white/10 rounded-full transition-colors"
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                >
                  <SkipForward className="w-5 h-5 text-white" />
                </motion.button>
              </div>
              <div className="flex items-center gap-4">
                <motion.button
                  onClick={handleShuffle}
                  className={`p-2 rounded-full transition-colors ${
                    isShuffled ? 'text-green-500' : 'text-white hover:bg-white/10'
                  }`}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                >
                  <Shuffle className="w-5 h-5" />
                </motion.button>
                <motion.button
                  onClick={handleRepeat}
                  className={`p-2 rounded-full transition-colors ${
                    repeatMode !== 'off' ? 'text-green-500' : 'text-white hover:bg-white/10'
                  }`}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                >
                  <Repeat className={`w-5 h-5 ${repeatMode === 'track' ? 'fill-current' : ''}`} />
                </motion.button>
              </div>
            </div>

            {/* Additional Controls */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <motion.button
                  onClick={handleLike}
                  className={`p-2 rounded-full transition-colors ${
                    isLiked ? 'text-red-500' : 'text-white hover:bg-white/10'
                  }`}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                >
                  <Heart className={`w-5 h-5 ${isLiked ? 'fill-current' : ''}`} />
                </motion.button>
                <motion.button
                  onClick={() => setShowPlaylists(true)}
                  className="p-2 hover:bg-white/10 rounded-full transition-colors text-white"
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                >
                  <ListMusic className="w-5 h-5" />
                </motion.button>
                <motion.button
                  onClick={handleShare}
                  className="p-2 hover:bg-white/10 rounded-full transition-colors text-white"
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                >
                  <Share2 className="w-5 h-5" />
                </motion.button>
              </div>
              <div 
                className="relative group"
                onMouseEnter={() => setShowVolumeSlider(true)}
                onMouseLeave={() => setShowVolumeSlider(false)}
              >
                <motion.button
                  onClick={() => handleVolumeChange(volume === 0 ? 50 : 0)}
                  className="p-2 hover:bg-white/10 rounded-full transition-colors"
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                >
                  {volume === 0 ? (
                    <VolumeX className="w-5 h-5 text-white" />
                  ) : (
                    <Volume2 className="w-5 h-5 text-white" />
                  )}
                </motion.button>
                <AnimatePresence>
                  {showVolumeSlider && (
                    <motion.div 
                      className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 bg-black/80 backdrop-blur-sm rounded-lg p-2"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      transition={{ duration: 0.2 }}
                    >
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={volume}
                        onChange={(e) => handleVolumeChange(Number(e.target.value))}
                        className="w-24 h-1 bg-white/20 rounded-full appearance-none cursor-pointer"
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <AnimatePresence>
        {showPlaylists && (
          <PlaylistManager
            currentTrack={currentTrack}
            onClose={() => setShowPlaylists(false)}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default NowPlaying;
