import React, { useState, useEffect } from 'react';
import { Plus, Trash, Music, ChevronDown, ChevronUp } from 'lucide-react';
import useSpotifyStore from '../stores/useSpotifyStore';
import { createPlaylist, deletePlaylist, getUserPlaylists, getPlaylistTracks } from '../lib/spotify';

const PlaylistManager: React.FC = () => {
  const { user } = useSpotifyStore();
  const [playlists, setPlaylists] = useState([]);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [expandedPlaylist, setExpandedPlaylist] = useState(null);
  const [playlistTracks, setPlaylistTracks] = useState([]);

  useEffect(() => {
    const fetchPlaylists = async () => {
      if (user) {
        const playlists = await getUserPlaylists();
        setPlaylists(playlists.items);
      }
    };
    fetchPlaylists();
  }, [user]);

  useEffect(() => {
    const fetchPlaylistTracks = async () => {
      if (expandedPlaylist) {
        const tracks = await getPlaylistTracks(expandedPlaylist.id);
        setPlaylistTracks(tracks.items);
      }
    };
    fetchPlaylistTracks();
  }, [expandedPlaylist]);

  const handleCreatePlaylist = async () => {
    if (newPlaylistName.trim()) {
      await createPlaylist(newPlaylistName);
      const playlists = await getUserPlaylists();
      setPlaylists(playlists.items);
      setNewPlaylistName('');
    }
  };

  const handleDeletePlaylist = async (playlistId) => {
    await deletePlaylist(playlistId);
    const playlists = await getUserPlaylists();
    setPlaylists(playlists.items);
    setConfirmDelete(null);
  };

  const handlePlaylistClick = (playlist) => {
    if (expandedPlaylist === playlist) {
      setExpandedPlaylist(null);
    } else {
      setExpandedPlaylist(playlist);
    }
  };

  return (
    <div className="bg-white/10 backdrop-blur-md rounded-2xl shadow-2xl p-6 w-full border border-white/10">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-white">Playlists</h2>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={newPlaylistName}
            onChange={(e) => setNewPlaylistName(e.target.value)}
            placeholder="New Playlist Name"
            className="bg-gray-800 text-white p-2 rounded-lg"
          />
          <button
            onClick={handleCreatePlaylist}
            className="p-2 bg-green-500 text-white rounded-full hover:bg-green-600 transition-colors"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>
      </div>
      <div className="space-y-4 max-h-[500px] overflow-y-auto custom-scrollbar">
        {playlists.length === 0 ? (
          <div className="flex items-center justify-center text-gray-400 py-10">
            <Music className="w-12 h-12 text-gray-300 mr-4" />
            <p>No playlists found</p>
          </div>
        ) : (
          playlists.map((playlist) => (
            <div key={playlist.id} className="flex flex-col gap-3 p-3 hover:bg-white/5 rounded-xl transition-colors group">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <img
                    src={playlist.images[0]?.url || '/placeholder-playlist.png'}
                    alt={playlist.name}
                    className="w-12 h-12 rounded-lg object-cover shadow-md"
                  />
                  <p className="font-medium text-white truncate">{playlist.name}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handlePlaylistClick(playlist)}
                    className="p-2 bg-gray-700 text-white rounded-full hover:bg-gray-600 transition-colors"
                  >
                    {expandedPlaylist === playlist ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                  </button>
                  {confirmDelete === playlist.id ? (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleDeletePlaylist(playlist.id)}
                        className="p-2 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
                      >
                        Confirm
                      </button>
                      <button
                        onClick={() => setConfirmDelete(null)}
                        className="p-2 bg-gray-500 text-white rounded-full hover:bg-gray-600 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmDelete(playlist.id)}
                      className="p-2 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
                    >
                      <Trash className="w-5 h-5" />
                    </button>
                  )}
                </div>
              </div>
              {expandedPlaylist === playlist && (
                <div className="space-y-2">
                  {playlistTracks.map((track) => (
                    <div key={track.track.id} className="flex items-center gap-3 p-2 hover:bg-white/10 rounded-xl transition-colors">
                      <img
                        src={track.track.album.images[0].url}
                        alt={track.track.name}
                        className="w-10 h-10 rounded-lg object-cover shadow-md"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-white truncate">{track.track.name}</p>
                        <p className="text-sm text-gray-400 truncate">
                          {track.track.artists.map((a) => a.name).join(', ')}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default PlaylistManager;
