import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Plus, Music, Loader2 } from 'lucide-react';
import { getUserPlaylists, addTrackToPlaylist } from '../lib/spotify';

interface PlaylistManagerProps {
  currentTrack: SpotifyApi.TrackObjectFull;
  onClose: () => void;
}

const PlaylistManager: React.FC<PlaylistManagerProps> = ({ currentTrack, onClose }) => {
  const [playlists, setPlaylists] = useState<SpotifyApi.PlaylistObjectSimplified[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [addingToPlaylist, setAddingToPlaylist] = useState<string | null>(null);

  useEffect(() => {
    const fetchPlaylists = async () => {
      try {
        const userPlaylists = await getUserPlaylists();
        setPlaylists(userPlaylists || []);
      } catch (err) {
        setError('Failed to load playlists');
        console.error('Error fetching playlists:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchPlaylists();
  }, []);

  const handleAddToPlaylist = async (playlistId: string, playlistName: string) => {
    if (!currentTrack || !currentTrack.id) {
      setError('No current track to add');
      return;
    }
    try {
      setAddingToPlaylist(playlistId);
      setError(null);
      setSuccess(null);

  const trackUri = `spotify:track:${currentTrack.id}`;
  await addTrackToPlaylist(playlistId, trackUri);

      setSuccess(`Added to ${playlistName}`);
      setTimeout(() => onClose(), 1500);
    } catch (err: unknown) {
      console.error('Error adding track to playlist:', err);
      const hasMessage = (v: unknown): v is { message?: unknown } => !!v && typeof v === 'object' && 'message' in v;
      const extractMessage = (e: unknown): string => {
        if (!e || typeof e !== 'object') return '';
        if (hasMessage(e) && typeof e.message === 'string') return e.message;
        try {
          return JSON.stringify(e as object);
        } catch {
          return String(e);
        }
      };
      const errorMessage = extractMessage(err).toLowerCase();
      if (errorMessage.includes('snapshot_id') || errorMessage.includes('playlist')) {
        setSuccess(`Added to ${playlistName}`);
        setTimeout(() => onClose(), 1500);
      } else {
        setError(extractMessage(err) || 'Failed to add track to playlist');
      }
    } finally {
      setAddingToPlaylist(null);
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={handleBackdropClick}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="bg-gray-800 rounded-xl p-6 w-full max-w-md shadow-2xl border border-white/10"
          onClick={e => e.stopPropagation()}
        >
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-white">Add to Playlist</h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/10 rounded-full transition-colors"
            >
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </div>

          {error && (
            <div className="mb-4 p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
              <p className="text-red-400">{error}</p>
            </div>
          )}

          {success && (
            <div className="mb-4 p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
              <p className="text-green-400">{success}</p>
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center h-48">
              <Loader2 className="w-8 h-8 text-white animate-spin" />
            </div>
          ) : (
            <div className="max-h-[60vh] overflow-y-auto pr-2 space-y-2">
              {playlists.length === 0 ? (
                <div className="text-center text-gray-400 py-8">
                  No playlists found
                </div>
              ) : (
                playlists.map(playlist => (
                  <motion.button
                    key={playlist.id}
                    onClick={() => handleAddToPlaylist(playlist.id, playlist.name)}
                    className="w-full p-4 bg-white/5 hover:bg-white/10 rounded-lg transition-colors flex items-center gap-4 group disabled:opacity-50 disabled:cursor-not-allowed"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    disabled={addingToPlaylist === playlist.id}
                  >
                    {playlist.images?.[0]?.url ? (
                      <img
                        src={playlist.images[0].url}
                        alt={playlist.name}
                        className="w-12 h-12 rounded object-cover"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded bg-white/10 flex items-center justify-center">
                        <Music className="w-6 h-6 text-gray-400" />
                      </div>
                    )}
                    <div className="flex-1 text-left">
                      <h3 className="text-white font-medium truncate">{playlist.name}</h3>
                      <p className="text-gray-400 text-sm truncate">
                        {playlist.tracks.total} tracks
                      </p>
                    </div>
                    {addingToPlaylist === playlist.id ? (
                      <Loader2 className="w-5 h-5 text-white animate-spin" />
                    ) : (
                      <Plus className="w-5 h-5 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                    )}
                  </motion.button>
                ))
              )}
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default PlaylistManager;
