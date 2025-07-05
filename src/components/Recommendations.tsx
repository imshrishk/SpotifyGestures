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

  // Remove the entire Current Track UI section below
  return null;
};

export default PlayerCard; 