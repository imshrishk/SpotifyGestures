import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { History as HistoryIcon, Play } from 'lucide-react';
import useSpotifyStore from '../stores/useSpotifyStore';
import { SpotifyApi } from '../lib/spotifyApi';

interface Track {
  id: string;
  name: string;
  artists: { name: string }[];
  album: {
    name: string;
    images: { url: string }[];
  };
  duration_ms: number;
  played_at: string;
  uri: string;
}

interface HistoryItem {
  track: Track;
  played_at: string;
}

const History: React.FC = () => {
  const { token } = useSpotifyStore();
  const [tracks, setTracks] = useState<Track[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchHistory = async () => {
      if (!token) return;
      
      try {
        setIsLoading(true);
        const response = await SpotifyApi.getRecentlyPlayed(token);
        setTracks(response.items.map((item: HistoryItem) => item.track));
      } catch (error) {
        console.error('Error fetching history:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchHistory();
  }, [token]);

  const playSong = async (uri: string) => {
    if (!token) return;
    
    try {
      await SpotifyApi.playSmartly(token, uri);
    } catch (error) {
      console.error('Error playing track:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="loading-spinner" />
      </div>
    );
  }

  if (tracks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center">
        <HistoryIcon className="w-12 h-12 text-[var(--text-secondary)] mb-4" />
        <p className="text-[var(--text-secondary)]">No recently played tracks</p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-6 text-[var(--text-primary)]">Recently Played</h2>
      <div className="space-y-2">
        {tracks.map((track, index) => (
          <motion.div
            key={track.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.1 }}
            className="flex items-center space-x-4 p-3 rounded-lg hover:bg-[var(--background-pressed)] transition-colors cursor-pointer group"
            onClick={() => playSong(track.uri)}
          >
            <div className="relative">
              <img
                src={track.album.images[0]?.url}
                alt={track.album.name}
                className="w-12 h-12 rounded-md object-cover"
              />
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <Play className="w-5 h-5 text-white" />
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[var(--text-primary)] font-medium truncate">{track.name}</p>
              <p className="text-[var(--text-secondary)] text-sm truncate">
                {track.artists.map(artist => artist.name).join(', ')}
              </p>
            </div>
            <p className="text-[var(--text-secondary)] text-sm">
              {formatTime(track.duration_ms)}
            </p>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

const formatTime = (ms: number) => {
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

export default History; 