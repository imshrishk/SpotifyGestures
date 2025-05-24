import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Clock, Heart, MoreHorizontal, Music, Play, Pause, Plus, User, Info } from 'lucide-react';
import { getPlaylistDetails, getPlaylistTracks, followPlaylist, unfollowPlaylist, checkUserFollowsPlaylists, playTrack as playSingleTrack, getTrackAudioFeatures } from '../lib/spotify';
import { SpotifyApi } from '../lib/spotifyApi';
import useSpotifyStore from '../stores/useSpotifyStore';
import { motion } from 'framer-motion';
import AudioFeatures from '../components/AudioFeatures';

interface PlaylistTrack {
  added_at: string;
  track: {
    id: string;
    name: string;
    uri: string;
    duration_ms: number;
    artists?: Array<{
      id: string;
      name: string;
    }>;
    album?: {
      id: string;
      name: string;
      images: Array<{
        url: string;
      }>;
    };
    images?: Array<{
      url: string;
    }>;
    show?: {
      name: string;
    };
    type: string;
  };
}

// Add CurrentPlaybackState interface
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

interface TrackAudioFeatures {
  acousticness: number;
  danceability: number;
  energy: number;
  instrumentalness: number;
  key: number;
  liveness: number;
  loudness: number;
  mode: number;
  speechiness: number;
  tempo: number;
  time_signature: number;
  valence: number;
}

const PlaylistDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { token, user, currentTrack, isPlaying } = useSpotifyStore();
  
  const [playlist, setPlaylist] = useState<any>(null);
  const [tracks, setTracks] = useState<PlaylistTrack[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFollowing, setIsFollowing] = useState(false);
  const [playingTrackId, setPlayingTrackId] = useState<string | null>(null);
  const [selectedTrackFeatures, setSelectedTrackFeatures] = useState<TrackAudioFeatures | null>(null);
  const [showFeatures, setShowFeatures] = useState<string | null>(null);
  const [featuresError, setFeaturesError] = useState(false);
  
  useEffect(() => {
    if (!token) {
      navigate('/');
      return;
    }
    
    const loadPlaylistData = async () => {
      try {
        setIsLoading(true);
        
        // Load playlist details
        if (id) {
          const playlistData = await getPlaylistDetails(id);
          setPlaylist(playlistData);
          
          // Load playlist tracks
          const tracksData = await getPlaylistTracks(id);
          // Transform tracks data to match our interface
          const transformedTracks = tracksData.map((item: any) => ({
            added_at: item.added_at,
            track: {
              id: item.track?.id || '',
              name: item.track?.name || '',
              uri: item.track?.uri || '',
              duration_ms: item.track?.duration_ms || 0,
              artists: item.track?.artists,
              album: item.track?.album,
              images: item.track?.images,
              show: item.track?.show,
              type: item.track?.type || ''
            }
          }));
          setTracks(transformedTracks);
          
          // Check if user follows this playlist
          if (user?.id) {
            const follows = await checkUserFollowsPlaylists(id, user.id);
            setIsFollowing(follows);
          }
        }
        
        setIsLoading(false);
      } catch (error) {
        console.error('Error loading playlist data:', error);
        setIsLoading(false);
      }
    };
    
    loadPlaylistData();
  }, [token, navigate, id, user?.id]);

  // Update playing track state when currentTrack changes
  useEffect(() => {
    const typedCurrentTrack = currentTrack as unknown as CurrentPlaybackState;
    if (typedCurrentTrack?.item) {
      setPlayingTrackId(typedCurrentTrack.item.id);
    }
  }, [currentTrack]);
  
  const formatDuration = (ms: number) => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };
  
  const handlePlayTrack = async (uri: string) => {
    try {
      // This function is for playing a single track from the list
      await playSingleTrack(uri);
    } catch (error: any) {
      console.error('Error playing track:', error);
      alert('Error playing track. Please make sure Spotify is open on one of your devices.');
    }
  };
  
  const handlePlayPlaylistContext = async (playlistUri: string) => {
    if (!token) return;
    try {
      await SpotifyApi.playContext(token, playlistUri, 0); // Play playlist from the beginning
    } catch (error: any) {
      console.error('Error playing playlist context:', error);
      // Potentially use the same alert, or a more specific one
      alert('Error starting playlist. Please make sure Spotify is open on one of your devices and try again.');
    }
  };
  
  const handleFollowPlaylist = async () => {
    try {
      if (!id) return;
      
      if (isFollowing) {
        await unfollowPlaylist(id);
        setIsFollowing(false);
      } else {
        await followPlaylist(id);
        setIsFollowing(true);
      }
    } catch (error) {
      console.error('Error toggling playlist follow:', error);
    }
  };

  const getItemImage = (item: PlaylistTrack['track']) => {
    if (item.album?.images && item.album.images[0]) {
      return item.album.images[0].url;
    } else if (item.images && item.images[0]) {
      return item.images[0].url;
    }
    return null;
  };

  const getItemTitle = (item: PlaylistTrack['track']) => {
    return item.name;
  };

  const getItemSubtitle = (item: PlaylistTrack['track']) => {
    if (item.type === 'episode') {
      return item.show?.name || '';
    } else if (item.artists) {
      return item.artists.map(artist => artist.name).join(', ');
    }
    return '';
  };

  const handleTrackInfo = async (trackId: string) => {
    try {
      setFeaturesError(false);
      if (showFeatures === trackId) {
        setShowFeatures(null);
        setSelectedTrackFeatures(null);
        return;
      }

      const features = await getTrackAudioFeatures(trackId);
      setSelectedTrackFeatures(features);
      setShowFeatures(trackId);
    } catch (error) {
      console.error('Error fetching audio features:', error);
      setFeaturesError(true);
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

  if (!playlist) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-900 to-black flex items-center justify-center text-white">
        <div className="text-center">
          <Music className="w-16 h-16 mx-auto mb-4 text-gray-400" />
          <h2 className="text-2xl font-bold mb-2">Playlist Not Found</h2>
          <p className="text-gray-400">The playlist you're looking for doesn't exist or you don't have access to it.</p>
          <button
            onClick={() => navigate('/playlists')}
            className="mt-6 px-6 py-2 bg-green-500 hover:bg-green-600 rounded-full transition-colors"
          >
            Back to Playlists
          </button>
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
            onClick={() => navigate('/playlists')}
            className="p-2 rounded-full bg-black/30 hover:bg-black/50 mr-4 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-2xl font-bold">Playlist</h1>
        </div>
        
        {/* Playlist header */}
        <div className="flex flex-col md:flex-row gap-8 mb-8">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3 }}
            className="w-full md:w-64 h-64 md:h-64 flex-shrink-0"
          >
            {playlist.images && playlist.images[0] ? (
              <img
                src={playlist.images[0].url}
                alt={playlist.name}
                className="w-full h-full object-cover rounded-lg shadow-2xl"
              />
            ) : (
              <div className="w-full h-full bg-gray-800 rounded-lg flex items-center justify-center">
                <Music className="w-16 h-16 text-gray-600" />
              </div>
            )}
          </motion.div>
          
          <div className="flex flex-col items-center md:items-start">
            <div className="text-sm text-gray-400 mb-1">Playlist</div>
            <motion.h2 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-3xl font-bold mb-2"
            >
              {playlist.name}
            </motion.h2>
            
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="text-sm text-gray-400 mb-4"
            >
              <div className="flex items-center gap-2">
                {playlist.owner && (
                  <span className="flex items-center gap-1">
                    <User className="w-3 h-3" /> {playlist.owner.display_name}
                  </span>
                )}
                <span>•</span>
                <span>{playlist.tracks.total} songs</span>
              </div>
            </motion.div>
            
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="flex gap-3 mt-4"
            >
              <button
                onClick={() => handlePlayPlaylistContext(playlist.uri)}
                className="py-2 px-8 bg-green-500 rounded-full font-medium flex items-center gap-2 hover:bg-green-600 transition-colors"
              >
                <Play className="w-5 h-5 fill-current" /> Play
              </button>
              
              <button
                onClick={handleFollowPlaylist}
                className={`p-2 rounded-full ${
                  isFollowing ? 'bg-green-500' : 'bg-gray-800 hover:bg-gray-700'
                } transition-colors`}
              >
                {isFollowing ? (
                  <Heart className="w-5 h-5 fill-current" />
                ) : (
                  <Plus className="w-5 h-5" />
                )}
              </button>
              
              <button className="p-2 rounded-full bg-gray-800 hover:bg-gray-700 transition-colors">
                <MoreHorizontal className="w-5 h-5" />
              </button>
            </motion.div>
          </div>
        </div>
        
        {/* Tracks list */}
        <div className="mt-8">
          <table className="w-full text-left">
            <thead className="border-b border-gray-800">
              <tr className="text-gray-400 text-sm">
                <th className="pb-2 w-12">#</th>
                <th className="pb-2">Title</th>
                <th className="pb-2 hidden md:table-cell">Album</th>
                <th className="pb-2 text-right">
                  <Clock className="w-4 h-4 inline" />
                </th>
                <th className="pb-2 w-20"></th>
              </tr>
            </thead>
            <tbody>
              {tracks.map((item, index) => (
                <motion.tr
                  key={`${item.track.id}-${index}`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.05 * index }}
                  className="hover:bg-white/5 group"
                >
                  <td className="py-3 px-2">
                    <span className="group-hover:hidden">{index + 1}</span>
                    <button 
                      onClick={() => handlePlayTrack(item.track.uri)}
                      className="hidden group-hover:inline"
                    >
                      <Play className="w-4 h-4 fill-current" />
                    </button>
                  </td>
                  <td className="py-3">
                    <div className="flex items-center">
                      <div className="w-10 h-10 mr-3 flex-shrink-0 relative group/image">
                        {getItemImage(item.track) ? (
                          <img 
                            src={getItemImage(item.track)!} 
                            alt={getItemTitle(item.track)}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full bg-gray-700 flex items-center justify-center">
                            <Music className="w-5 h-5 text-gray-500" />
                          </div>
                        )}
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover/image:opacity-100 flex items-center justify-center transition-opacity">
                          <button 
                            onClick={() => handlePlayTrack(item.track.uri)}
                            className="p-1.5 bg-green-500 rounded-full"
                          >
                            <Play className="w-3.5 h-3.5 text-white fill-current" />
                          </button>
                        </div>
                      </div>
                      <div>
                        <div 
                          className="font-medium hover:text-green-500 cursor-pointer"
                          onClick={() => {
                            if (item.track.type !== 'episode') {
                              navigate(`/track/${item.track.id}`);
                            }
                          }}
                        >
                          {getItemTitle(item.track)}
                        </div>
                        <div className="text-sm text-gray-400">
                          {getItemSubtitle(item.track)}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 hidden md:table-cell text-gray-400">
                    {item.track.album?.name || (item.track.type === 'episode' ? item.track.show?.name : '')}
                  </td>
                  <td className="py-3 text-right text-gray-400">
                    {formatDuration(item.track.duration_ms)}
                  </td>
                  <td className="py-3 text-right">
                    <button 
                      onClick={() => handleTrackInfo(item.track.id)}
                      className="p-2 bg-green-500 hover:bg-green-600 rounded-full transition-colors"
                      aria-label="View track details"
                    >
                      <Info className="w-4 h-4 text-white" />
                    </button>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>

          {/* Audio Features Display */}
          {showFeatures && selectedTrackFeatures && !featuresError && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="mt-8 bg-gray-800/30 rounded-lg p-6"
            >
              <AudioFeatures features={{
                acousticness: selectedTrackFeatures.acousticness,
                danceability: selectedTrackFeatures.danceability,
                energy: selectedTrackFeatures.energy,
                instrumentalness: selectedTrackFeatures.instrumentalness,
                liveness: selectedTrackFeatures.liveness,
                speechiness: selectedTrackFeatures.speechiness,
                valence: selectedTrackFeatures.valence,
                tempo: selectedTrackFeatures.tempo
              }} />
            </motion.div>
          )}

          {/* Error Message */}
          {featuresError && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-8 bg-red-900/30 border border-red-800 rounded-lg p-4"
            >
              <div className="flex items-center gap-3">
                <Info className="text-red-500 w-5 h-5" />
                <p className="text-sm text-red-200">
                  Unable to fetch audio features. Please try again later.
                </p>
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PlaylistDetail; 