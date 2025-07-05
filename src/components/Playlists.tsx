import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ListMusic, Play, Pause, ChevronRight, ChevronLeft, Clock, User, Info, Plus } from 'lucide-react';
import useSpotifyStore from '../stores/useSpotifyStore';
import { SpotifyApi } from '../lib/spotifyApi';
import { addToQueue } from '../lib/spotify';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

interface Playlist {
  id: string;
  name: string;
  description: string;
  images: { url: string }[];
  owner: {
    display_name: string;
  };
  tracks: {
    total: number;
  };
  uri: string;
}

interface PlaylistTrack {
  id: string;
  name: string;
  uri: string;
  artists: { name: string; id?: string }[];
  album: {
    name: string;
    images: { url: string }[];
  };
  duration_ms: number;
  added_at?: string;
  added_by?: {
    id: string;
    display_name?: string;
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

const Playlists: React.FC = () => {
  const { token, currentTrack } = useSpotifyStore();
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPlaylist, setSelectedPlaylist] = useState<Playlist | null>(null);
  const [playlistTracks, setPlaylistTracks] = useState<PlaylistTrack[]>([]);
  const [isLoadingTracks, setIsLoadingTracks] = useState(false);
  const [playingTrackId, setPlayingTrackId] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playlistDuration, setPlaylistDuration] = useState<number>(0);
  const navigate = useNavigate();

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

  useEffect(() => {
    const fetchPlaylists = async () => {
      if (!token) return;
      
      try {
        setIsLoading(true);
        const response = await SpotifyApi.getUserPlaylists(token);
        setPlaylists(response.items);
      } catch (error) {
        console.error('Error fetching playlists:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPlaylists();
  }, [token]);

  useEffect(() => {
    if (!selectedPlaylist || !token) return;
    
    const fetchPlaylistTracks = async () => {
      try {
        setIsLoadingTracks(true);
        const response = await SpotifyApi.getPlaylistTracks(token, selectedPlaylist.id);
        
        // Map to our track format and filter out null tracks
        const tracks = response.items
          .filter((item: any) => item.track && item.track.id) // Filter out null or invalid tracks
          .map((item: any) => ({
            id: item.track.id,
            name: item.track.name,
            uri: item.track.uri,
            artists: item.track.artists,
            album: item.track.album,
            duration_ms: item.track.duration_ms,
            added_at: item.added_at,
            added_by: item.added_by
          }));
        
        console.log(`Processed ${tracks.length} valid tracks out of ${response.items.length} total items`);
        
        // Calculate total duration
        const totalDuration = tracks.reduce((total: number, track: PlaylistTrack) => {
          return total + (track.duration_ms || 0);
        }, 0);
        
        setPlaylistDuration(totalDuration);
        setPlaylistTracks(tracks);
      } catch (error) {
        console.error('Error fetching playlist tracks:', error);
      } finally {
        setIsLoadingTracks(false);
      }
    };
    
    fetchPlaylistTracks();
  }, [selectedPlaylist, token]);

  const playPlaylist = async (uri: string, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
    }
    
    if (!token) return;
    
    try {
      console.log(`Playing entire playlist with URI: ${uri}`);
      await SpotifyApi.playContext(token, uri);
      // We don't set isPlaying here because the currentTrack useEffect will handle that
    } catch (error) {
      console.error('Error playing playlist:', error);
    }
  };
  
  const playTrack = async (trackUri: string, trackId: string, playlistUri: string, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
    }
    
    if (!token) return;

    try {
      console.log(`Playing track: ${trackId} from playlist: ${playlistUri}`);
      
      if (playingTrackId === trackId && isPlaying) {
        // If the track is already playing, just pause it
        console.log('Pausing currently playing track');
        await SpotifyApi.pausePlayback(token);
        setIsPlaying(false);
        return;
      }

      // Always attempt to play from playlist context - this ensures proper queue
      console.log(`Finding track position in playlist of ${playlistTracks.length} tracks`);
      const trackIndex = playlistTracks.findIndex(track => track.id === trackId);
      
      if (trackIndex !== -1) {
        console.log(`Found track at position ${trackIndex} in playlist. Playing context.`);
        try {
          // Adding explicit playlist context and offset to ensure queue is maintained
          await SpotifyApi.playContext(token, playlistUri, trackIndex);
          console.log(`Successfully started playback from playlist position ${trackIndex}`);
          setPlayingTrackId(trackId);
          setIsPlaying(true);
        } catch (error) {
          console.error('Error playing from context with index:', error);
          // Only fall back to direct track play if all context attempts fail
          alert('Could not start playlist context playback. Please make sure your Spotify app is open and active.');
        }
      } else {
        console.warn('Track not found in playlist array - using direct URI playback as last resort');
        try {
          await SpotifyApi.playContext(token, playlistUri, 0);
          setPlayingTrackId(trackId);
          setIsPlaying(true);
        } catch (error) {
          console.error('Error playing playlist from start as last resort:', error);
          alert('Could not start playlist playback.');
        }
      }
    } catch (error) {
      console.error('Error in playTrack:', error);
    }
  };

  const formatDuration = (ms: number) => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const formatTotalDuration = (ms: number) => {
    const minutes = Math.floor(ms / 60000);
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    
    if (hours > 0) {
      return `${hours} hr ${remainingMinutes} min`;
    }
    return `${minutes} min`;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  const goBack = () => {
    setSelectedPlaylist(null);
    setPlaylistTracks([]);
  };

  // Add this new function to handle navigation to track info
  const navigateToTrackInfo = (trackId: string) => {
    navigate(`/track/${trackId}`);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  if (playlists.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center">
        <ListMusic className="w-12 h-12 text-gray-400 mb-4" />
        <p className="text-gray-400">No playlists found</p>
      </div>
    );
  }

  if (selectedPlaylist) {
    return (
      <div className="p-6">
        <div className="flex flex-col md:flex-row items-start gap-6 mb-8">
          <div className="flex-shrink-0">
            <button 
              onClick={goBack}
              className="mb-4 p-2 rounded-full bg-black/30 hover:bg-black/50 flex items-center gap-1 transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
              <span>Back to playlists</span>
            </button>
            
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="w-48 h-48 md:w-64 md:h-64"
            >
              <img
                src={selectedPlaylist.images[0]?.url || '/default-playlist.png'}
                alt={selectedPlaylist.name}
                className="w-full h-full object-cover rounded-md shadow-lg"
              />
            </motion.div>
          </div>
          
          <div className="flex-1">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <span className="uppercase text-sm text-gray-400 font-medium">Playlist</span>
              <h2 className="text-3xl md:text-5xl font-bold mt-1 mb-4">{selectedPlaylist.name}</h2>
              
              {selectedPlaylist.description && (
                <p className="text-gray-400 mb-6">{selectedPlaylist.description}</p>
              )}
              
              <div className="flex items-center text-sm text-gray-400 mb-6">
                <div className="flex items-center">
                  <User className="w-4 h-4 mr-1" />
                  <span>{selectedPlaylist.owner.display_name}</span>
                </div>
                <span className="mx-2">•</span>
                <span>{playlistTracks.length} tracks</span>
                <span className="mx-2">•</span>
                <span>{formatTotalDuration(playlistDuration)}</span>
              </div>
              
              <button 
                className="px-8 py-3 bg-green-500 hover:bg-green-600 text-white rounded-full flex items-center gap-2 font-medium transition-colors"
                onClick={() => playPlaylist(selectedPlaylist.uri)}
              >
                <Play className="w-5 h-5" fill="white" />
                Play
              </button>
            </motion.div>
          </div>
        </div>
        
        {isLoadingTracks ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full"></div>
            <span className="ml-2">Loading tracks...</span>
          </div>
        ) : (
          <div>
            {/* Track header */}
            <div className="grid grid-cols-[16px_4fr_3fr_2fr_1fr_auto] gap-4 border-b border-gray-800 py-2 px-4 text-gray-400 text-sm font-medium sticky top-0 bg-black z-10">
              <span>#</span>
              <span>Title</span>
              <span>Album</span>
              <span>Date Added</span>
              <span className="flex items-center justify-end">
                <Clock className="w-4 h-4" />
              </span>
              <span className="flex items-center justify-center">
                <Info className="w-4 h-4" />
              </span>
            </div>
            
            {/* Track list - simple display of all tracks */}
            <div className="divide-y divide-gray-800/50 max-h-[70vh] overflow-y-auto">
              {playlistTracks.length > 0 ? (
                playlistTracks.map((track, index) => (
                  <div
                    key={`${track.id}-${index}`}
                    className={`grid grid-cols-[16px_4fr_3fr_2fr_1fr_auto] gap-4 py-3 px-4 hover:bg-white/5 group transition-colors rounded-md ${
                      playingTrackId === track.id ? 'bg-white/10' : ''
                    }`}
                  >
                    <div className="flex items-center justify-center relative">
                      {playingTrackId === track.id ? (
                        <button
                          onClick={(e) => playTrack(track.uri, track.id, selectedPlaylist.uri, e)}
                          className="text-green-500"
                        >
                          {isPlaying ? (
                            <Pause className="w-4 h-4" fill="currentColor" />
                          ) : (
                            <Play className="w-4 h-4" fill="currentColor" />
                          )}
                        </button>
                      ) : (
                        <span className="text-gray-500 group-hover:opacity-0 transition-opacity">
                          {index + 1}
                        </span>
                      )}
                      <button
                        onClick={(e) => playTrack(track.uri, track.id, selectedPlaylist.uri, e)}
                        className={`absolute transition-opacity ${playingTrackId === track.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
                      >
                        <Play className="w-4 h-4" fill="currentColor" />
                      </button>
                    </div>
                    
                    <div className="flex items-center">
                      <div className="w-10 h-10 mr-3 flex-shrink-0">
                        <img
                          src={track.album.images[0]?.url || '/default-cover.png'}
                          alt={track.album.name}
                          className="w-full h-full object-cover rounded-sm"
                        />
                      </div>
                      <div className="min-w-0">
                        <div className={`truncate font-medium ${playingTrackId === track.id ? 'text-green-500' : ''}`}>
                          {track.name}
                        </div>
                        <div className="text-sm text-gray-400 truncate">
                          {track.artists.map(artist => artist.name).join(', ')}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center text-gray-400 truncate">
                      {track.album.name}
                    </div>
                    
                    <div className="flex items-center text-gray-400 text-sm">
                      {track.added_at && formatDate(track.added_at)}
                    </div>
                    
                    <div className="flex items-center justify-end text-gray-400 text-sm">
                      {formatDuration(track.duration_ms)}
                    </div>
                    
                    <div className="flex items-center justify-center space-x-2">
                      <button
                        onClick={async (e) => {
                          e.stopPropagation();
                          try {
                            await addToQueue(track.uri);
                            alert('Added to queue!');
                          } catch (error) {
                            console.error('Error adding to queue:', error);
                            alert('Failed to add to queue.');
                          }
                        }}
                        className="p-2 rounded-full bg-blue-500 hover:bg-blue-600 opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Add to Queue"
                      >
                        <Plus className="w-4 h-4 text-white" />
                      </button>
                      <button
                        onClick={() => navigateToTrackInfo(track.id)}
                        className="p-2 rounded-full bg-green-500 hover:bg-green-600 opacity-0 group-hover:opacity-100 transition-opacity"
                        title="View Track Info"
                      >
                        <Info className="w-4 h-4 text-white" />
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-8 text-center text-gray-400">
                  No tracks found in this playlist.
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-6">Your Playlists</h2>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
        {playlists.map((playlist, index) => (
          <motion.div
            key={playlist.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            className="bg-gray-800/30 rounded-md p-4 group cursor-pointer hover:bg-gray-800/50 transition-colors"
            onClick={() => setSelectedPlaylist(playlist)}
          >
            <div className="aspect-square mb-4 rounded-md overflow-hidden relative">
              <img
                src={playlist.images[0]?.url || '/default-playlist.png'}
                alt={playlist.name}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              />
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <div className="flex space-x-2">
                  <div 
                    className="p-3 bg-green-500 rounded-full transform translate-y-2 group-hover:translate-y-0 transition-transform"
                    onClick={(e) => playPlaylist(playlist.uri, e)}
                  >
                    <Play className="w-6 h-6 text-white" fill="white" />
                  </div>
                </div>
              </div>
            </div>
            <h3 className="font-bold truncate">{playlist.name}</h3>
            <p className="text-sm text-gray-400 truncate">{playlist.description || 'Playlist'}</p>
            <div className="mt-2 text-sm text-gray-500">
              <span>{playlist.tracks.total} tracks</span>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default Playlists; 