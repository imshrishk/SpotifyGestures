import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Clock, Music, Disc, Calendar, ChevronRight, ListMusic, UserIcon, Clock3, Clock12, LogOut } from 'lucide-react';
import useSpotifyStore from '../stores/useSpotifyStore';
import { getCurrentUser, getUserPlaylists, getTopTracks, getTopArtists, getRecentlyPlayed, signOut } from '../lib/spotify';
import { motion } from 'framer-motion';

interface TopItem {
  id: string;
  name: string;
  images?: { url: string }[];
  album?: {
    images: { url: string }[];
  };
  artists?: { name: string }[];
  uri: string;
  played_at?: string;
}

interface SpotifyUserProfile {
  id: string;
  display_name: string;
  images?: { url: string }[];
  followers?: { total: number };
  product?: string;
}

type TimeRange = 'short_term' | 'medium_term' | 'long_term';

const Profile: React.FC = () => {
  const navigate = useNavigate();
  const { token, user, setUser } = useSpotifyStore();
  const [topTracks, setTopTracks] = useState<TopItem[]>([]);
  const [topArtists, setTopArtists] = useState<TopItem[]>([]);
  const [recentlyPlayed, setRecentlyPlayed] = useState<TopItem[]>([]);
  const [playlists, setPlaylists] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'tracks' | 'artists' | 'recent'>('tracks');
  const [tracksTimeRange, setTracksTimeRange] = useState<TimeRange>('medium_term');
  const [artistsTimeRange, setArtistsTimeRange] = useState<TimeRange>('medium_term');
  const [userProfile, setUserProfile] = useState<SpotifyUserProfile | null>(null);

  const timeRangeLabels = {
    short_term: 'Last 4 Weeks',
    medium_term: 'Last 6 Months',
    long_term: 'All Time'
  };

  useEffect(() => {
    if (!token) {
      navigate('/');
      return;
    }

    const loadUserData = async () => {
      try {
        setIsLoading(true);
        
        // Always fetch fresh user data to ensure accurate information
        const userData = await getCurrentUser();
        
        // Ensure user data has correct fields before setting
        if (userData) {
          // Format followers object if it doesn't exist
          if (!userData.followers) {
            userData.followers = { total: 0, href: "" };
          }
          
          setUser(userData as any);
          setUserProfile(userData as unknown as SpotifyUserProfile);
        }
        
        // Load user's playlists
        const playlistsResponse = await getUserPlaylists();
        if (playlistsResponse && Array.isArray(playlistsResponse)) {
          setPlaylists(playlistsResponse.slice(0, 6));
        }
        
        await Promise.all([
          loadTopTracks(tracksTimeRange),
          loadTopArtists(artistsTimeRange),
          loadRecentlyPlayed()
        ]);
        
        setIsLoading(false);
      } catch (error) {
        console.error('Error loading profile data:', error);
        setIsLoading(false);
      }
    };
    
    loadUserData();
  }, [token, navigate, setUser, tracksTimeRange, artistsTimeRange]);

  const loadTopTracks = async (timeRange: TimeRange) => {
    try {
      const tracksResponse = await getTopTracks(timeRange);
      if (tracksResponse?.items) {
        setTopTracks(tracksResponse.items.slice(0, 10));
      }
    } catch (error) {
      console.error('Error loading top tracks:', error);
    }
  };

  const loadTopArtists = async (timeRange: TimeRange) => {
    try {
      const artistsResponse = await getTopArtists(timeRange);
      if (artistsResponse?.items) {
        setTopArtists(artistsResponse.items.slice(0, 10));
      }
    } catch (error) {
      console.error('Error loading top artists:', error);
    }
  };

  const loadRecentlyPlayed = async () => {
    try {
      const recentResponse = await getRecentlyPlayed();
      if (recentResponse?.items) {
        // Use type assertion to work around type issues
        setRecentlyPlayed(recentResponse.items.map(item => ({
          ...item.track,
          played_at: item.played_at
        })) as unknown as TopItem[]);
      }
    } catch (error) {
      console.error('Error loading recently played tracks:', error);
    }
  };

  // Effect to reload data when time range changes
  useEffect(() => {
    if (!isLoading && token) {
      loadTopTracks(tracksTimeRange);
    }
  }, [tracksTimeRange, token]);

  useEffect(() => {
    if (!isLoading && token) {
      loadTopArtists(artistsTimeRange);
    }
  }, [artistsTimeRange, token]);
  
  if (!token || isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-900 to-black flex items-center justify-center">
        <div className="animate-pulse flex flex-col items-center">
          <div className="w-32 h-32 bg-gray-700 rounded-full mb-4"></div>
          <div className="h-6 w-48 bg-gray-700 rounded mb-2"></div>
          <div className="h-4 w-32 bg-gray-700 rounded"></div>
        </div>
      </div>
    );
  }

  const renderTimeRangeSelector = (
    currentRange: TimeRange, 
    onChange: (range: TimeRange) => void
  ) => (
    <div className="flex flex-wrap gap-2 mb-4">
      {(['short_term', 'medium_term', 'long_term'] as TimeRange[]).map((range) => (
        <button
          key={range}
          onClick={() => onChange(range)}
          className={`px-3 py-1 text-xs rounded-full ${
            currentRange === range 
              ? 'bg-green-500 text-white' 
              : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
          }`}
        >
          {timeRangeLabels[range]}
        </button>
      ))}
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-black text-white p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header with back button */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center">
          <button 
            onClick={() => navigate('/player')}
            className="p-2 rounded-full bg-black/30 hover:bg-black/50 mr-4 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-2xl font-bold">Your Profile</h1>
          </div>
          <button 
            onClick={signOut}
            className="p-2 rounded-full bg-red-500/20 hover:bg-red-500/40 transition-colors flex items-center gap-2 text-sm"
            title="Sign out"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign out</span>
          </button>
        </div>
        
        {/* User profile header */}
        <div className="flex flex-col md:flex-row items-center md:items-start gap-8 mb-12">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative"
          >
            {userProfile?.images && userProfile.images[0] ? (
              <img 
                src={userProfile.images[0].url} 
                alt={userProfile.display_name}
                className="w-40 h-40 rounded-full object-cover border-4 border-green-500 shadow-lg"
              />
            ) : (
              <div className="w-40 h-40 rounded-full bg-gray-800 flex items-center justify-center border-4 border-green-500">
                <UserIcon className="w-24 h-24 text-gray-400" />
              </div>
            )}
          </motion.div>
          
          <div>
            <motion.h2 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-3xl font-bold mb-2"
            >
              {userProfile?.display_name}
            </motion.h2>
            
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6"
            >
              <div 
                className="bg-black/30 p-4 rounded-lg cursor-pointer hover:bg-black/50 transition-colors"
                onClick={() => navigate('/followers')}
              >
                <div className="text-gray-400 text-sm mb-1">Followers</div>
                <div className="text-xl font-semibold">
                  {userProfile?.followers?.total 
                    ? userProfile.followers.total.toLocaleString() 
                    : '0'}
                </div>
              </div>
              <div 
                className="bg-black/30 p-4 rounded-lg cursor-pointer hover:bg-black/50 transition-colors"
                onClick={() => navigate('/following')}
              >
                <div className="text-gray-400 text-sm mb-1">Following</div>
                <div className="text-xl font-semibold">Artists</div>
              </div>
              <div 
                className="bg-black/30 p-4 rounded-lg cursor-pointer hover:bg-black/50 transition-colors"
                onClick={() => navigate('/playlists')}
              >
                <div className="text-gray-400 text-sm mb-1">Playlists</div>
                <div className="text-xl font-semibold">{playlists.length}</div>
              </div>
              <div className="bg-black/30 p-4 rounded-lg">
                <div className="text-gray-400 text-sm mb-1">Account Type</div>
                <div className="text-xl font-semibold capitalize">
                  {userProfile?.product === 'premium' ? 'Premium' : userProfile?.product || 'Free'}
                </div>
              </div>
            </motion.div>
          </div>
        </div>
        
        {/* User playlists section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mb-12"
        >
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <ListMusic className="w-6 h-6" /> Your Playlists
            </h2>
            <button
              onClick={() => navigate('/playlists')}
              className="text-sm text-gray-400 hover:text-white flex items-center"
            >
              View all <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {playlists.map(playlist => (
              <motion.div
                key={playlist.id}
                whileHover={{ y: -5 }}
                className="bg-gray-800/50 rounded-lg overflow-hidden cursor-pointer"
                onClick={() => navigate(`/playlist/${playlist.id}`)}
              >
                <div className="aspect-square">
                  {playlist.images && playlist.images[0] ? (
                    <img 
                      src={playlist.images[0].url} 
                      alt={playlist.name} 
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-gray-700 flex items-center justify-center">
                      <Music className="w-12 h-12 text-gray-500" />
                    </div>
                  )}
                </div>
                <div className="p-3">
                  <div className="truncate text-sm font-medium">{playlist.name}</div>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
        
        {/* Tabs for top tracks, artists, recently played */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <div className="flex border-b border-gray-800 mb-6">
            <button
              className={`px-4 py-3 font-medium flex items-center gap-2 ${
                activeTab === 'tracks' 
                  ? 'text-green-500 border-b-2 border-green-500' 
                  : 'text-gray-400 hover:text-white'
              }`}
              onClick={() => setActiveTab('tracks')}
            >
              <Music className="w-4 h-4" /> Top Tracks
            </button>
            <button
              className={`px-4 py-3 font-medium flex items-center gap-2 ${
                activeTab === 'artists' 
                  ? 'text-green-500 border-b-2 border-green-500' 
                  : 'text-gray-400 hover:text-white'
              }`}
              onClick={() => setActiveTab('artists')}
            >
              <Disc className="w-4 h-4" /> Top Artists
            </button>
            <button
              className={`px-4 py-3 font-medium flex items-center gap-2 ${
                activeTab === 'recent' 
                  ? 'text-green-500 border-b-2 border-green-500' 
                  : 'text-gray-400 hover:text-white'
              }`}
              onClick={() => setActiveTab('recent')}
            >
              <Clock className="w-4 h-4" /> Recently Played
            </button>
          </div>
          
          {/* Tab content */}
          <div className="space-y-2">
            {activeTab === 'tracks' && (
              <>
                {renderTimeRangeSelector(tracksTimeRange, setTracksTimeRange)}
                
                {topTracks.map((track, index) => (
              <motion.div
                key={track.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className="flex items-center p-3 rounded-lg hover:bg-white/5 group"
              >
                <div className="w-10 h-10 flex-shrink-0 mr-4">
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
                </div>
                <div className="flex-1 min-w-0">
                      <div 
                        className="truncate font-medium hover:text-green-500 cursor-pointer"
                        onClick={() => navigate(`/track/${track.id}`)}
                      >
                        {track.name}
                      </div>
                  <div className="text-sm text-gray-400 truncate">
                    {track.artists?.map(a => a.name).join(', ')}
                  </div>
                </div>
                <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        className="p-2 bg-green-500 rounded-full"
                        onClick={() => navigate(`/track/${track.id}`)}
                      >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            ))}
              </>
            )}
            
            {activeTab === 'artists' && (
              <>
                {renderTimeRangeSelector(artistsTimeRange, setArtistsTimeRange)}
                
                {topArtists.map((artist, index) => (
              <motion.div
                key={artist.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className="flex items-center p-3 rounded-lg hover:bg-white/5 group"
              >
                <div className="w-10 h-10 flex-shrink-0 mr-4">
                  {artist.images && artist.images[0] ? (
                    <img 
                      src={artist.images[0].url} 
                      alt={artist.name}
                      className="w-full h-full object-cover rounded-full"
                    />
                  ) : (
                    <div className="w-full h-full bg-gray-700 rounded-full flex items-center justify-center">
                      <UserIcon className="w-6 h-6 text-gray-500" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="truncate font-medium">{artist.name}</div>
                </div>
                <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                  <button className="p-2 bg-green-500 rounded-full">
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            ))}
              </>
            )}
            
            {activeTab === 'recent' && recentlyPlayed.map((track, index) => (
              <motion.div
                key={track.id + (track.played_at || '')}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className="flex items-center p-3 rounded-lg hover:bg-white/5 group"
              >
                <div className="w-10 h-10 flex-shrink-0 mr-4">
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
                </div>
                <div className="flex-1 min-w-0">
                  <div 
                    className="truncate font-medium hover:text-green-500 cursor-pointer"
                    onClick={() => navigate(`/track/${track.id}`)}
                  >
                    {track.name}
                  </div>
                  <div className="text-sm text-gray-400 truncate">
                    {track.artists?.map(a => a.name).join(', ')}
                  </div>
                </div>
                <div className="text-xs text-gray-500">
                  {track.played_at && new Date(track.played_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default Profile; 