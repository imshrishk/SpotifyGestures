import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { getRecommendationsFromUserProfile, playTrack, pauseTrack } from '../lib/spotify';
import { Music, Play, Pause, RefreshCw, Plus } from 'lucide-react';
import useSpotifyStore from '../stores/useSpotifyStore';
import { useNavigate } from 'react-router-dom';

interface RecommendedTrack {
  id: string;
  name: string;
  artists: { 
    name: string;
    id?: string;
  }[];
  uri: string;
  album?: {
    name: string;
    images: { url: string }[];
  };
}

interface CurrentPlaybackState {
  is_playing: boolean;
  item: {
    id: string;
    uri: string;
    name: string;
    artists: any[];
    album: any;
    [key: string]: any;
  };
  progress_ms: number;
  device: any;
  [key: string]: any;
}

interface UserRecommendationsProps {
  title?: string;
  limit?: number;
  showRefresh?: boolean;
  isCompact?: boolean;
  onTrackSelect?: (track: RecommendedTrack) => void;
}

const UserRecommendations: React.FC<UserRecommendationsProps> = ({
  title = "Recommended For You",
  limit = 5,
  showRefresh = true,
  isCompact = false,
  onTrackSelect
}) => {
  const navigate = useNavigate();
  const { token, currentTrack } = useSpotifyStore();
  const [recommendations, setRecommendations] = useState<RecommendedTrack[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [playingTrackId, setPlayingTrackId] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);

  // Check if current track is playing
  useEffect(() => {
    const typedCurrentTrack = currentTrack as unknown as CurrentPlaybackState;
    if (typedCurrentTrack?.is_playing && typedCurrentTrack?.item) {
      setPlayingTrackId(typedCurrentTrack.item.id);
      setIsPlaying(true);
    } else {
      setIsPlaying(false);
    }
  }, [currentTrack]);

  // Load recommendations on component mount
  useEffect(() => {
    if (token) {
      fetchRecommendations();
    }
  }, [token]);

  // Fetch recommendations from API
  const fetchRecommendations = async () => {
    try {
      setIsLoading(true);
      const recommendationsResponse = await getRecommendationsFromUserProfile();
      if (recommendationsResponse?.tracks) {
        setRecommendations(recommendationsResponse.tracks.slice(0, limit));
      }
      setIsLoading(false);
    } catch (error) {
      console.error('Error loading recommendations:', error);
      setIsLoading(false);
    }
  };

  // Handle playing a track
  const handlePlayTrack = async (uri: string, id: string, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
    }
    
    try {
      if (playingTrackId === id && isPlaying) {
        await pauseTrack();
        setIsPlaying(false);
      } else {
        await playTrack(uri);
        setPlayingTrackId(id);
        setIsPlaying(true);
      }
    } catch (error) {
      console.error('Error playing track:', error);
    }
  };

  // Handle track selection
  const handleTrackSelect = (track: RecommendedTrack, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
    }
    
    if (onTrackSelect) {
      onTrackSelect(track);
    } else {
      navigate(`/track/${track.id}`);
    }
  };

  return (
    <div className="w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Music className="w-6 h-6" /> {title}
        </h2>
        {showRefresh && (
          <button
            onClick={() => fetchRecommendations()}
            className="flex items-center gap-1 text-sm bg-green-500 hover:bg-green-600 text-white py-2 px-4 rounded-full transition-colors"
            disabled={isLoading}
          >
            {isLoading ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
            Refresh
          </button>
        )}
      </div>
      
      {/* Grid or List display based on isCompact prop */}
      {isCompact ? (
        // Compact list view
        <div className="space-y-2 bg-gray-900/50 rounded-lg p-4">
          {recommendations.map((track) => (
            <motion.div
              key={track.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-center p-2 rounded-lg hover:bg-white/5 group"
              onClick={() => handleTrackSelect(track)}
            >
              <div className="w-10 h-10 flex-shrink-0 mr-3 relative">
                {track.album?.images[0] ? (
                  <img 
                    src={track.album.images[0].url} 
                    alt={track.name}
                    className="w-full h-full object-cover rounded"
                  />
                ) : (
                  <div className="w-full h-full bg-gray-700 rounded flex items-center justify-center">
                    <Music className="w-6 h-6 text-gray-500" />
                  </div>
                )}
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                  {playingTrackId === track.id && isPlaying ? (
                    <button 
                      className="p-1.5 bg-green-500 rounded-full"
                      onClick={(e) => handlePlayTrack(track.uri, track.id, e)}
                    >
                      <Pause className="w-3.5 h-3.5 text-white" fill="white" />
                    </button>
                  ) : (
                    <button 
                      className="p-1.5 bg-green-500 rounded-full"
                      onClick={(e) => handlePlayTrack(track.uri, track.id, e)}
                    >
                      <Play className="w-3.5 h-3.5 text-white" fill="white" />
                    </button>
                  )}
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="truncate text-sm font-medium">{track.name}</div>
                <div className="text-xs text-gray-400 truncate">
                  {track.artists.map(a => a.name).join(', ')}
                </div>
              </div>
              <button 
                className="p-1.5 bg-gray-700 hover:bg-gray-600 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={(e) => {
                  e.stopPropagation();
                  // Handle add to queue or playlist
                }}
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </motion.div>
          ))}
        </div>
      ) : (
        // Grid view
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {recommendations.map((track) => (
            <motion.div
              key={track.id}
              whileHover={{ y: -5 }}
              className="bg-gray-800/50 rounded-lg overflow-hidden cursor-pointer group relative"
              onClick={() => handleTrackSelect(track)}
            >
              <div className="aspect-square">
                {track.album?.images[0] ? (
                  <img 
                    src={track.album.images[0].url} 
                    alt={track.name} 
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-gray-700 flex items-center justify-center">
                    <Music className="w-12 h-12 text-gray-500" />
                  </div>
                )}
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                  {playingTrackId === track.id && isPlaying ? (
                    <button 
                      className="p-3 bg-green-500 rounded-full"
                      onClick={(e) => handlePlayTrack(track.uri, track.id, e)}
                    >
                      <Pause className="w-5 h-5 text-white" fill="white" />
                    </button>
                  ) : (
                    <button 
                      className="p-3 bg-green-500 rounded-full"
                      onClick={(e) => handlePlayTrack(track.uri, track.id, e)}
                    >
                      <Play className="w-5 h-5 text-white" fill="white" />
                    </button>
                  )}
                </div>
              </div>
              <div className="p-3">
                <div className="truncate text-sm font-medium">{track.name}</div>
                <div className="truncate text-xs text-gray-400">{track.artists.map(a => a.name).join(', ')}</div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
      
      {/* Loading and empty states */}
      {isLoading && (
        <div className="flex justify-center items-center mt-4">
          <div className="animate-pulse text-gray-400">Loading recommendations...</div>
        </div>
      )}
      
      {recommendations.length === 0 && !isLoading && (
        <div className="text-center py-10 bg-gray-800/30 rounded-lg">
          <div className="text-gray-400">No recommendations available</div>
          <button 
            onClick={fetchRecommendations}
            className="mt-4 bg-white/10 hover:bg-white/20 py-2 px-4 rounded-full text-sm transition-colors"
          >
            Try Again
          </button>
        </div>
      )}
    </div>
  );
};

export default UserRecommendations; 