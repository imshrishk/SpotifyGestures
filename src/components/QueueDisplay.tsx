import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Music, Clock, RefreshCw, XCircle } from 'lucide-react';
import useSpotifyStore from '../stores/useSpotifyStore';
import { getQueue } from '../lib/spotify';

interface QueueDisplayProps {
  onClose: () => void;
}

interface QueueItem {
  id: string;
  name: string;
  artists: { name: string }[];
  album: {
    name: string;
    images: { url: string }[];
  };
  duration_ms: number;
}

const QueueDisplay: React.FC<QueueDisplayProps> = ({ onClose }) => {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { currentTrack, removeTrackFromQueue } = useSpotifyStore();

  const fetchQueue = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const queueData = await getQueue();
      setQueue(queueData.queue || []);
    } catch (err: any) {
      console.error('Error fetching queue:', err);
      setError(err?.message || 'Failed to load queue');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchQueue();
  }, [fetchQueue]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchQueue();
  };

  const formatDuration = (ms: number) => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="h-full flex flex-col p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Queue</h2>
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={handleRefresh}
          disabled={isLoading || isRefreshing}
          className={`p-2 rounded-full text-gray-400 hover:text-white transition-colors ${
            isRefreshing ? 'animate-spin' : ''
          }`}
        >
          <RefreshCw className="w-5 h-5" />
        </motion.button>
      </div>

      <AnimatePresence mode="wait">
        {isLoading ? (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex items-center justify-center flex-1"
          >
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-spotify-green"></div>
          </motion.div>
        ) : error ? (
          <motion.div
            key="error"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center justify-center flex-1 text-center"
          >
            <p className="text-red-400 mb-4">{error}</p>
            <button
              onClick={handleRefresh}
              className="text-sm text-gray-400 hover:text-white transition-colors"
            >
              Try again
            </button>
          </motion.div>
        ) : (
          <motion.div
            key="content"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex-1 flex flex-col"
          >
            {currentTrack && (
              <div className="mb-8">
                <h3 className="text-gray-400 text-sm uppercase mb-4">Now Playing</h3>
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center space-x-4 p-3 rounded-lg bg-white/5"
                >
                  <img
                    src={currentTrack.album.images[0].url}
                    alt={currentTrack.name}
                    className="w-12 h-12 rounded"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{currentTrack.name}</p>
                    <p className="text-sm text-gray-400 truncate">
                      {currentTrack.artists.map(a => a.name).join(', ')}
                    </p>
                  </div>
                  <span className="text-sm text-gray-400 flex-shrink-0">
                    {formatDuration(currentTrack.duration_ms)}
                  </span>
                </motion.div>
              </div>
            )}

            <div className="flex-1 overflow-y-auto">
              <h3 className="text-gray-400 text-sm uppercase mb-4">Next Up</h3>
              {queue.length > 0 ? (
                <div className="space-y-2">
                  {queue.map((track, index) => (
                    <motion.div
                      key={`${track.id}-${index}`}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="flex items-center space-x-4 p-3 rounded-lg hover:bg-white/5 transition-colors"
                    >
                      <img
                        src={track.album.images[0].url}
                        alt={track.name}
                        className="w-12 h-12 rounded"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{track.name}</p>
                        <p className="text-sm text-gray-400 truncate">
                          {track.artists.map(a => a.name).join(', ')}
                        </p>
                      </div>
                      <span className="text-sm text-gray-400 flex-shrink-0">
                        {formatDuration(track.duration_ms)}
                      </span>
                      <button
                        onClick={() => removeTrackFromQueue(track.id)}
                        className="p-1 rounded-full hover:bg-white/10 transition-colors"
                        title="Remove from Queue"
                      >
                        <XCircle className="w-4 h-4 text-gray-400 hover:text-red-500" />
                      </button>
                    </motion.div>
                  ))}
                </div>
              ) : (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex flex-col items-center justify-center text-gray-400 py-12"
                >
                  <Music className="w-12 h-12 mb-4" />
                  <p>No tracks in queue</p>
                </motion.div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default QueueDisplay; 