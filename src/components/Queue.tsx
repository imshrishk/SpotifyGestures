import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  List, 
  Music, 
  Shuffle, 
  Repeat, 
  Play, 
  Plus, 
  Trash2, 
  X, 
  Search,
  Clock,
  Volume2,
  SkipForward,
  Heart,
  MoreHorizontal,
  BarChart3
} from 'lucide-react';
import useSpotifyStore from '../stores/useSpotifyStore';
import { shufflePlaylist, toggleRepeat, getRecentlyPlayed, addToQueue, searchTracks } from '../lib/spotify';
import { SpotifyApi } from '../lib/spotifyApi';

interface Track {
  id: string;
  name: string;
  artists: { name: string }[];
  album: { name: string; images: { url: string }[] };
  duration_ms?: number;
  uri: string;
}

const Queue: React.FC = () => {
  const { queue, token, removeTrackFromQueue, currentPlaylist } = useSpotifyStore();
  const [activeTab, setActiveTab] = useState<'upcoming' | 'recent'>('upcoming');
  const [isShuffled, setIsShuffled] = useState(false);
  const [repeatMode, setRepeatMode] = useState<'off' | 'track' | 'context'>('off');
  const [recentTracks, setRecentTracks] = useState<Track[]>([]);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Track[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hoveredTrack, setHoveredTrack] = useState<string | null>(null);

  useEffect(() => {
    const fetchRecentTracks = async () => {
      try {
        const response = await getRecentlyPlayed(20);
        const formattedTracks: Track[] = response.items.map((item: { track: any }) => {
          const track = item.track;
          return {
            id: track.id,
            name: track.name,
            artists: track.artists,
            album: track.album,
            duration_ms: track.duration_ms,
            uri: track.uri
          };
        });
        setRecentTracks(formattedTracks);
      } catch (error) {
        console.error(error);
      }
    };
    fetchRecentTracks();
  }, []);

  const displayTracks = activeTab === 'upcoming' ? queue : recentTracks;

  const handleShuffle = async () => {
    try {
      await shufflePlaylist(!isShuffled);
      setIsShuffled(!isShuffled);
    } catch (error) {
      console.error(error);
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
      console.error(error);
    }
  };

  const playSong = async (uri: string) => {
    if (!token) return;
    try {
      if (currentPlaylist && currentPlaylist.uri && currentPlaylist.type === 'playlist') {
        await SpotifyApi.playSmartly(token, uri, currentPlaylist.uri);
      } else {
        await SpotifyApi.playSmartly(token, uri);
      }
    } catch (error) {
      console.error('Error playing track:', error);
    }
  };

  const handleAddToQueue = async (track: Track) => {
    if (!token) return;
    
    try {
      await addToQueue(track.uri);
      setShowAddDialog(false);
      setSearchQuery('');
      setSearchResults([]);
    } catch (error) {
      console.error('Error adding track to queue:', error);
    }
  };

  const handleRemoveFromQueue = async (trackId: string) => {
    removeTrackFromQueue(trackId);
  };

  const performSearch = async (query: string) => {
    if (!query.trim() || !token) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const tracks = await searchTracks(query, 10);
      const formattedTracks: Track[] = tracks.map((track: { id: string; name: string; artists: any[]; album: any; duration_ms?: number; uri: string }) => ({
        id: track.id,
        name: track.name,
        artists: track.artists,
        album: track.album,
        duration_ms: track.duration_ms,
        uri: track.uri
      }));
      setSearchResults(formattedTracks);
    } catch (error) {
      console.error('Error searching tracks:', error);
    } finally {
      setIsSearching(false);
    }
  };

  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      performSearch(searchQuery);
    }, 300);

    return () => clearTimeout(debounceTimer);
  }, [searchQuery, token]);

  const formatDuration = (ms: number | undefined) => {
    if (!ms) return '0:00';
    const minutes = Math.floor(ms / 60000);
    const seconds = ((ms % 60000) / 1000).toFixed(0);
    return `${minutes}:${parseInt(seconds) < 10 ? '0' : ''}${seconds}`;
  };

  const getRepeatIcon = () => {
    switch (repeatMode) {
      case 'track':
        return <Repeat className="w-5 h-5 fill-current" />;
      case 'context':
        return <Repeat className="w-5 h-5" />;
      default:
        return <Repeat className="w-5 h-5" />;
    }
  };

  const getQueueStats = (tracks: Track[]) => {
    let totalMs = 0;
    const artistCount: Record<string, number> = {};
    tracks.forEach(track => {
      totalMs += track.duration_ms || 0;
      track.artists.forEach((a: { name: string }) => {
        artistCount[a.name] = (artistCount[a.name] || 0) + 1;
      });
    });
    const totalMinutes = Math.floor(totalMs / 60000);
    const mostCommonArtist = Object.entries(artistCount).sort((a: [string, number], b: [string, number]) => b[1] - a[1])[0]?.[0] || '-';
    return { totalMinutes, mostCommonArtist };
  };

  const stats = getQueueStats(queue);

  return (
    <div className="relative">
      {/* Queue Stats Card - moved above queue, right-aligned */}
      <div className="flex justify-end mb-4">
        <div className="bg-gray-800/80 rounded-xl shadow p-3 flex flex-col items-end min-w-[180px] border border-white/10">
          <div className="flex items-center gap-2 mb-1">
            <BarChart3 className="w-4 h-4 text-green-400" />
            <span className="font-semibold text-white text-xs">Queue Stats</span>
          </div>
          <div className="text-xs text-gray-300 mb-0.5">Total time: <span className="font-bold text-green-400">{stats.totalMinutes} min</span></div>
          <div className="text-xs text-gray-300">Top artist: <span className="font-bold text-green-400">{stats.mostCommonArtist}</span></div>
        </div>
      </div>

      {/* Main Queue Container */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-br from-gray-900/95 via-gray-800/90 to-gray-900/95 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/10 p-8 w-full"
      >
        {/* Header Section */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl shadow-lg">
                <List className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white">Music Queue</h2>
                <p className="text-gray-400 text-sm">
                  {activeTab === 'upcoming' ? `${queue.length} tracks in queue` : `${recentTracks.length} recent tracks`}
                </p>
              </div>
            </div>
          </div>

          {/* Tab Switcher */}
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-1.5 flex items-center">
            <motion.button
              onClick={() => setActiveTab('upcoming')}
              className={`relative px-6 py-2.5 rounded-xl text-sm font-medium transition-all duration-300 ${
                activeTab === 'upcoming' 
                  ? 'text-white' 
                  : 'text-gray-400 hover:text-white'
              }`}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              {activeTab === 'upcoming' && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute inset-0 bg-gradient-to-r from-green-500 to-emerald-600 rounded-xl"
                  initial={false}
                  transition={{ type: "spring", stiffness: 500, damping: 30 }}
                />
              )}
              <span className="relative z-10 flex items-center gap-2">
                <SkipForward className="w-4 h-4" />
                Upcoming
              </span>
            </motion.button>
            <motion.button
              onClick={() => setActiveTab('recent')}
              className={`relative px-6 py-2.5 rounded-xl text-sm font-medium transition-all duration-300 ${
                activeTab === 'recent' 
                  ? 'text-white' 
                  : 'text-gray-400 hover:text-white'
              }`}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              {activeTab === 'recent' && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute inset-0 bg-gradient-to-r from-green-500 to-emerald-600 rounded-xl"
                  initial={false}
                  transition={{ type: "spring", stiffness: 500, damping: 30 }}
                />
              )}
              <span className="relative z-10 flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Recent
              </span>
            </motion.button>
          </div>
        </div>

        {/* Controls Section */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            {activeTab === 'upcoming' && (
              <motion.button
                onClick={() => setShowAddDialog(true)}
                className="flex items-center gap-2 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white px-4 py-2.5 rounded-xl font-medium shadow-lg transition-all duration-300"
                whileHover={{ scale: 1.05, y: -2 }}
                whileTap={{ scale: 0.95 }}
              >
                <Plus className="w-4 h-4" />
                Add Track
              </motion.button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <motion.button
              onClick={handleShuffle}
              className={`p-3 rounded-xl transition-all duration-300 ${
                isShuffled 
                  ? 'bg-gradient-to-r from-green-500 to-emerald-600 text-white shadow-lg' 
                  : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
              }`}
              whileHover={{ scale: 1.1, rotate: 5 }}
              whileTap={{ scale: 0.9 }}
              title="Shuffle"
            >
              <Shuffle className="w-5 h-5" />
            </motion.button>
            <motion.button
              onClick={handleRepeat}
              className={`p-3 rounded-xl transition-all duration-300 ${
                repeatMode !== 'off' 
                  ? 'bg-gradient-to-r from-green-500 to-emerald-600 text-white shadow-lg' 
                  : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
              }`}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              title={`Repeat: ${repeatMode}`}
            >
              {getRepeatIcon()}
            </motion.button>
          </div>
        </div>

        {/* Tracks List */}
        <div className="space-y-3 max-h-[600px] overflow-y-auto custom-scrollbar bg-gray-900/70 rounded-2xl p-2">
          <AnimatePresence mode="wait">
            {displayTracks.length === 0 ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="flex flex-col items-center justify-center text-gray-400 py-16"
              >
                <div className="p-6 bg-gray-800/50 rounded-3xl mb-4">
                  <Music className="w-16 h-16 text-gray-600" />
                </div>
                <p className="text-lg font-medium">
                  {activeTab === 'upcoming' ? 'Queue is empty' : 'No recent tracks'}
                </p>
                <p className="text-sm text-gray-500 mt-1">
                  {activeTab === 'upcoming' 
                    ? 'Add some tracks to get started!' 
                    : 'Your recently played tracks will appear here'
                  }
                </p>
              </motion.div>
            ) : (
              displayTracks.slice(0, 20).map((track, index) => (
                <motion.div
                  key={`${track.id}-${index}`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  transition={{ delay: index * 0.03 }}
                  className={`group flex items-center gap-4 bg-gray-800/80 hover:bg-gray-700/80 rounded-xl shadow-sm border border-white/5 px-4 py-3 transition-all duration-200 cursor-pointer relative ${hoveredTrack === track.id ? 'ring-2 ring-green-400/30' : ''}`}
                  onMouseEnter={() => setHoveredTrack(track.id)}
                  onMouseLeave={() => setHoveredTrack(null)}
                >
                  {/* Track Number */}
                  <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-gray-700/60 text-xs font-semibold text-gray-300 group-hover:text-white transition-colors">
                    {index + 1}
                  </div>
                  {/* Album Art */}
                  <img
                    src={track.album.images[2]?.url || '/placeholder-album.png'}
                    alt={track.album.name}
                    className="w-12 h-12 rounded-lg object-cover shadow-md"
                  />
                  {/* Track Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className="font-semibold text-white text-base break-all max-w-[320px] whitespace-normal"
                        title={track.name}
                        style={{ wordBreak: 'break-all', overflowWrap: 'break-word' }}
                      >
                        {track.name}
                      </span>
                    </div>
                    <span
                      className="text-xs text-gray-400 break-all max-w-[320px] block"
                      title={track.artists.map((a: { name: string }) => a.name).join(', ')}
                      style={{ wordBreak: 'break-all', overflowWrap: 'break-word' }}
                    >
                      {track.artists.map((a: { name: string }) => a.name).join(', ')}
                    </span>
                    <span
                      className="text-[11px] text-gray-500 break-all block mt-0.5 max-w-[320px]"
                      title={track.album.name}
                      style={{ wordBreak: 'break-all', overflowWrap: 'break-word' }}
                    >
                      {track.album.name}
                    </span>
                  </div>
                  {/* Duration */}
                  {track.duration_ms && (
                    <div className="flex items-center gap-1 text-xs text-gray-400 min-w-[48px]">
                      <Clock className="w-4 h-4" />
                      <span>{formatDuration(track.duration_ms)}</span>
                    </div>
                  )}
                  {/* Play Button */}
                  <motion.button
                    className="p-2 bg-green-500 hover:bg-green-600 rounded-full shadow transition-colors flex items-center justify-center mr-1"
                    whileHover={{ scale: 1.08 }}
                    whileTap={{ scale: 0.95 }}
                    title="Play this song"
                    onClick={e => { e.stopPropagation(); playSong(track.uri); }}
                  >
                    <Play className="w-4 h-4 text-white" />
                  </motion.button>
                  {/* Remove Button */}
                  {activeTab === 'upcoming' && (
                    <motion.button
                      onClick={e => { e.stopPropagation(); handleRemoveFromQueue(track.id); }}
                      className="p-2 hover:bg-red-500/20 rounded-full transition-colors"
                      whileHover={{ scale: 1.08 }}
                      whileTap={{ scale: 0.95 }}
                      title="Remove from queue"
                    >
                      <Trash2 className="w-4 h-4 text-gray-400 hover:text-red-400" />
                    </motion.button>
                  )}
                  {/* Divider */}
                  {index < displayTracks.length - 1 && (
                    <div className="absolute left-4 right-4 bottom-0 h-px bg-gradient-to-r from-transparent via-gray-700 to-transparent opacity-60" />
                  )}
                </motion.div>
              ))
            )}
          </AnimatePresence>
        </div>

        {/* Footer */}
        {displayTracks.length > 20 && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center text-sm text-gray-500 mt-6 pt-4 border-t border-gray-700/50"
          >
            +{displayTracks.length - 20} more tracks
          </motion.div>
        )}
      </motion.div>

      {/* Add Track Dialog */}
      <AnimatePresence>
        {showAddDialog && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => {
              setShowAddDialog(false);
              setSearchQuery('');
              setSearchResults([]);
            }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-3xl p-8 w-full max-w-2xl mx-4 shadow-2xl border border-white/10"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl">
                    <Plus className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-white">Add Track to Queue</h3>
                    <p className="text-gray-400 text-sm">Search and add your favorite tracks</p>
                  </div>
                </div>
                <motion.button
                  onClick={() => {
                    setShowAddDialog(false);
                    setSearchQuery('');
                    setSearchResults([]);
                  }}
                  className="p-2 hover:bg-gray-700/50 rounded-xl transition-colors"
                  whileHover={{ scale: 1.1, rotate: 90 }}
                  whileTap={{ scale: 0.9 }}
                >
                  <X className="w-6 h-6 text-gray-400 hover:text-white" />
                </motion.button>
              </div>
              
              {/* Search Input */}
              <div className="relative mb-6">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search for a track, artist, or album..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full p-4 pl-12 bg-gray-800/50 text-white rounded-2xl border border-gray-700/50 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all duration-300"
                />
              </div>
              
              {/* Search Results */}
              <div className="max-h-96 overflow-y-auto custom-scrollbar">
                <AnimatePresence mode="wait">
                  {isSearching ? (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="flex items-center justify-center py-12"
                    >
                      <div className="flex items-center gap-3 text-gray-400">
                        <div className="w-6 h-6 border-2 border-gray-600 border-t-green-500 rounded-full animate-spin"></div>
                        <span>Searching...</span>
                      </div>
                    </motion.div>
                  ) : searchResults.length > 0 ? (
                    <div className="space-y-2">
                      {searchResults.map((track, index) => (
                        <motion.div
                          key={track.id}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.05 }}
                          className="flex items-center gap-4 p-4 hover:bg-gray-700/50 rounded-2xl cursor-pointer transition-all duration-300 group"
                          onClick={() => handleAddToQueue(track)}
                        >
                          <img
                            src={track.album.images[2]?.url || '/placeholder-album.png'}
                            alt={track.album.name}
                            className="w-12 h-12 rounded-xl object-cover shadow-lg group-hover:shadow-2xl transition-all duration-300"
                          />
                          <div className="flex-1 min-w-0">
                            <h4 className="font-semibold text-white truncate group-hover:text-green-400 transition-colors">
                              {track.name}
                            </h4>
                            <p className="text-sm text-gray-400 truncate">
                              {track.artists.map((a: { name: string }) => a.name).join(', ')}
                            </p>
                            <p className="text-xs text-gray-500 truncate mt-1">
                              {track.album.name}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            {track.duration_ms && (
                              <span className="text-sm text-gray-400">
                                {formatDuration(track.duration_ms)}
                              </span>
                            )}
                            <motion.div
                              className="p-2 bg-green-500/20 rounded-xl opacity-0 group-hover:opacity-100 transition-all duration-300"
                              whileHover={{ scale: 1.1 }}
                            >
                              <Plus className="w-4 h-4 text-green-400" />
                            </motion.div>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  ) : searchQuery && !isSearching ? (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="flex flex-col items-center justify-center py-12 text-gray-400"
                    >
                      <Search className="w-16 h-16 text-gray-600 mb-4" />
                      <p className="text-lg font-medium">No tracks found</p>
                      <p className="text-sm text-gray-500 mt-1">Try a different search term</p>
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Queue;
