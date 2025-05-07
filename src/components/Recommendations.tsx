import React, { useState } from 'react';
import useSpotifyStore from '../stores/useSpotifyStore';
import { motion, AnimatePresence } from 'framer-motion';
import { Music, Play, Plus, AlertCircle, Check as CheckIcon } from 'lucide-react';
import { SpotifyApi } from '../lib/spotifyApi';

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

const PlayerCard: React.FC = () => {
  const { currentTrack, token } = useSpotifyStore();
  const [error, setError] = useState<string | null>(null);
  const [selectedTrackId, setSelectedTrackId] = useState<string | null>(null);
  const [showFeatures, setShowFeatures] = useState<string | null>(null);

  // Format duration from milliseconds to minutes:seconds
  const formatDuration = (ms: number | undefined) => {
    if (!ms) return '--:--';
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
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
    audioFeatures: (currentTrack as any).audioFeatures
  };

  return (
    <motion.div 
      className="bg-gradient-to-br from-gray-900/90 to-black/90 backdrop-blur-md rounded-xl shadow-xl p-4 border border-white/10 w-full"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <div className="flex items-center mb-4">
        <Music className="w-5 h-5 text-green-500 mr-2" />
        <h3 className="text-white text-lg font-semibold">Current Track</h3>
      </div>

      {error && (
        <div className="p-4 mb-4 bg-red-500/10 rounded-lg text-red-500 text-center">
          {error}
        </div>
      )}

      <div className="space-y-3">
        <motion.div 
          key={trackInfo.id}
          className="bg-black/30 rounded-lg p-3 hover:bg-white/5 transition-colors border border-white/5 relative overflow-hidden group"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
        >
          <div className="flex items-center">
            <div className="flex-shrink-0 relative">
              <img 
                src={trackInfo.albumImage} 
                alt={trackInfo.albumName} 
                className="w-12 h-12 rounded-md"
              />
              <motion.div 
                className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                initial={{ opacity: 0 }}
                whileHover={{ opacity: 1 }}
              >
                <motion.button
                  onClick={() => playSongNow(trackInfo.uri)}
                  className="p-2 bg-green-500 rounded-full"
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                >
                  <Play className="w-4 h-4 text-white" />
                </motion.button>
              </motion.div>
            </div>
            
            <div className="ml-3 flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <div className="flex-1 cursor-pointer hover:text-green-400 transition-colors" onClick={() => playSongNow(trackInfo.uri)}>
                  <h4 className="text-white font-medium text-sm truncate">{trackInfo.name}</h4>
                  <p className="text-gray-400 text-xs truncate hover:text-green-400 transition-colors">{trackInfo.artists.map(a => a.name).join(', ')}</p>
                </div>
                
                <div className="flex-shrink-0 flex items-center ml-2">
                  <div className="flex flex-col items-end mr-2">
                    <span className="text-xs text-gray-400">{formatDuration(trackInfo.duration_ms)}</span>
                  </div>
                  
                  <motion.button
                    onClick={() => addToQueue(trackInfo.uri, trackInfo.id)}
                    className={`p-1.5 ${selectedTrackId === trackInfo.id ? 'bg-green-500 text-white' : 'bg-white/10 text-white hover:bg-white/20'} rounded-full transition-colors`}
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    disabled={selectedTrackId === trackInfo.id}
                  >
                    {selectedTrackId === trackInfo.id ? (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="w-4 h-4"
                      >
                        <CheckIcon className="w-4 h-4" />
                      </motion.div>
                    ) : (
                      <Plus className="w-4 h-4" />
                    )}
                  </motion.button>
                </div>
              </div>
              
              {/* Features Toggle */}
              <div className="mt-2 flex items-center justify-end">
                <button 
                  onClick={() => toggleFeatures(trackInfo.id)}
                  className="text-xs text-gray-400 hover:text-white transition-colors"
                >
                  {showFeatures === trackInfo.id ? 'Hide features' : 'Show features'}
                </button>
              </div>
              
              {/* Audio Features */}
              <AnimatePresence>
                {showFeatures === trackInfo.id && trackInfo.audioFeatures && (
                  <motion.div 
                    className="mt-3 pt-3 border-t border-white/10 grid grid-cols-2 md:grid-cols-3 gap-2"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    <div className="space-y-1">
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-gray-400">Energy</span>
                        <span className="text-xs text-white">{formatPercentage(trackInfo.audioFeatures.energy)}</span>
                      </div>
                      <div className="w-full h-1.5 bg-gray-700 rounded-full overflow-hidden">
                        <div 
                          className={`h-full ${getFeatureColor(trackInfo.audioFeatures.energy)} rounded-full`}
                          style={{ width: `${(trackInfo.audioFeatures.energy || 0) * 100}%` }}
                        />
                      </div>
                    </div>
                    
                    <div className="space-y-1">
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-gray-400">Danceability</span>
                        <span className="text-xs text-white">{formatPercentage(trackInfo.audioFeatures.danceability)}</span>
                      </div>
                      <div className="w-full h-1.5 bg-gray-700 rounded-full overflow-hidden">
                        <div 
                          className={`h-full ${getFeatureColor(trackInfo.audioFeatures.danceability)} rounded-full`}
                          style={{ width: `${(trackInfo.audioFeatures.danceability || 0) * 100}%` }}
                        />
                      </div>
                    </div>
                    
                    <div className="space-y-1">
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-gray-400">Mood</span>
                        <span className="text-xs text-white">{formatPercentage(trackInfo.audioFeatures.valence)}</span>
                      </div>
                      <div className="w-full h-1.5 bg-gray-700 rounded-full overflow-hidden">
                        <div 
                          className={`h-full ${getFeatureColor(trackInfo.audioFeatures.valence)} rounded-full`}
                          style={{ width: `${(trackInfo.audioFeatures.valence || 0) * 100}%` }}
                        />
                      </div>
                    </div>
                    
                    <div className="space-y-1">
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-gray-400">Acousticness</span>
                        <span className="text-xs text-white">{formatPercentage(trackInfo.audioFeatures.acousticness)}</span>
                      </div>
                      <div className="w-full h-1.5 bg-gray-700 rounded-full overflow-hidden">
                        <div 
                          className={`h-full ${getFeatureColor(trackInfo.audioFeatures.acousticness)} rounded-full`}
                          style={{ width: `${(trackInfo.audioFeatures.acousticness || 0) * 100}%` }}
                        />
                      </div>
                    </div>
                    
                    <div className="text-xs text-gray-400">
                      <span className="block mb-1">Tempo: <span className="text-white">{formatTempo(trackInfo.audioFeatures.tempo)}</span></span>
                      <span className="block">Key: <span className="text-white">{keyToNoteName(trackInfo.audioFeatures.key, trackInfo.audioFeatures.mode)}</span></span>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
};

export default PlayerCard; 