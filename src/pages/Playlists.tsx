import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Clock, ListMusic, Music, Plus, Search, Play } from 'lucide-react';
import { getUserPlaylists, createPlaylist } from '../lib/spotify';
import useSpotifyStore from '../stores/useSpotifyStore';
import { motion } from 'framer-motion';

interface Playlist {
  id: string;
  name: string;
  description?: string | null;
  images?: { url: string }[];
  owner: {
    display_name: string;
  };
  tracks: {
    total: number;
  };
}

const Playlists: React.FC = () => {
  const navigate = useNavigate();
  const { token, user } = useSpotifyStore();
  
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [filteredPlaylists, setFilteredPlaylists] = useState<Playlist[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [isCreatingPlaylist, setIsCreatingPlaylist] = useState(false);
  
  useEffect(() => {
    if (!token) {
      navigate('/');
      return;
    }
    
    const loadPlaylistsData = async () => {
      try {
        setIsLoading(true);
        
        // Load user playlists - getUserPlaylists already returns the items array
        const playlistsData = await getUserPlaylists();
        if (playlistsData && Array.isArray(playlistsData)) {
          setPlaylists(playlistsData as Playlist[]);
          setFilteredPlaylists(playlistsData as Playlist[]);
        }
        
        setIsLoading(false);
      } catch (error) {
        console.error('Error loading playlists data:', error);
        setIsLoading(false);
      }
    };
    
    loadPlaylistsData();
  }, [token, navigate]);
  
  useEffect(() => {
    if (searchTerm) {
      const filtered = playlists.filter(playlist => 
        playlist.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredPlaylists(filtered);
    } else {
      setFilteredPlaylists(playlists);
    }
  }, [searchTerm, playlists]);
  
  const handleCreatePlaylist = async () => {
    if (!newPlaylistName.trim()) return;
    
    try {
      setIsCreatingPlaylist(true);
      await createPlaylist(newPlaylistName);
      
      // Refresh playlists
      const playlistsData = await getUserPlaylists();
      if (playlistsData && Array.isArray(playlistsData)) {
        setPlaylists(playlistsData as Playlist[]);
        setFilteredPlaylists(playlistsData as Playlist[]);
      }
      setNewPlaylistName('');
    } catch (error) {
      console.error('Error creating playlist:', error);
    } finally {
      setIsCreatingPlaylist(false);
    }
  };
  
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-900 to-black flex items-center justify-center">
        <div className="animate-pulse flex flex-col items-center">
          <div className="w-32 h-32 bg-gray-700 rounded mb-4"></div>
          <div className="h-6 w-48 bg-gray-700 rounded mb-2"></div>
          <div className="h-4 w-32 bg-gray-700 rounded"></div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-black text-white p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header with back button */}
        <div className="flex items-center mb-8">
          <button 
            onClick={() => navigate('/profile')}
            className="p-2 rounded-full bg-black/30 hover:bg-black/50 mr-4 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-2xl font-bold">Your Playlists</h1>
        </div>
        
        {/* Search and create */}
        <div className="flex flex-col md:flex-row items-stretch gap-4 mb-8">
          <div className="flex-1 relative">
            <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
              <Search className="w-5 h-5 text-gray-400" />
            </div>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search your playlists"
              className="bg-gray-800/50 w-full py-3 pl-10 pr-4 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
          
          <div className="flex gap-2">
            <input
              type="text"
              value={newPlaylistName}
              onChange={(e) => setNewPlaylistName(e.target.value)}
              placeholder="New playlist name"
              className="bg-gray-800/50 py-3 px-4 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 flex-1"
            />
            <button
              onClick={handleCreatePlaylist}
              disabled={isCreatingPlaylist || !newPlaylistName.trim()}
              className={`py-3 px-4 rounded-lg flex items-center gap-2 ${
                isCreatingPlaylist || !newPlaylistName.trim()
                  ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                  : 'bg-green-500 hover:bg-green-600'
              }`}
            >
              <Plus className="w-5 h-5" /> Create
            </button>
          </div>
        </div>
        
        {/* Playlists grid */}
        <div className="mt-8">
          {filteredPlaylists.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              {searchTerm ? (
                <p>No playlists match your search.</p>
              ) : (
                <p>You don't have any playlists yet. Create one to get started!</p>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {filteredPlaylists.map((playlist, index) => (
                <motion.div
                  key={playlist.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="bg-gray-800/50 rounded-lg overflow-hidden hover:bg-gray-700/50 transition-colors cursor-pointer group"
                  onClick={() => navigate(`/playlist/${playlist.id}`)}
                >
                  <div className="aspect-square relative">
                    {playlist.images && playlist.images[0] ? (
                      <img 
                        src={playlist.images[0].url} 
                        alt={playlist.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-gray-700 flex items-center justify-center">
                        <ListMusic className="w-16 h-16 text-gray-500" />
                      </div>
                    )}
                    <div className="absolute bottom-2 right-2 bg-black/70 text-xs px-2 py-1 rounded-full">
                      {playlist.tracks.total} tracks
                    </div>
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <div className="flex space-x-2">
                        <button 
                          className="p-3 bg-green-500 rounded-full transform translate-y-2 group-hover:translate-y-0 transition-transform"
                          onClick={(e) => {
                            e.stopPropagation();
                          }}
                        >
                          <Play className="w-6 h-6 text-white" fill="white" />
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="p-4">
                    <div className="font-medium truncate mb-1">{playlist.name}</div>
                    <div className="text-sm text-gray-400 truncate">
                      By {playlist.owner.display_name}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Playlists;
