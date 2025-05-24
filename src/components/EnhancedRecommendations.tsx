import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  getRecommendations, 
  getAvailableGenreSeeds, 
  getTopTracks, 
  getTopArtists, 
  playTrack, 
  pauseTrack,
  addTrackToPlaylist
} from '../lib/spotify';
import { 
  Music, 
  Play, 
  Pause, 
  RefreshCw, 
  Plus, 
  Sliders, 
  Disc, 
  Tag, 
  Save,
  X,
  Check
} from 'lucide-react';
import useSpotifyStore from '../stores/useSpotifyStore';
import { SpotifyApi } from '../lib/spotifyApi';
import { getUserPlaylists } from '../lib/spotify'; 

interface Artist {
  id: string;
  name: string;
  images?: { url: string }[];
}

interface Track {
  id: string;
  name: string;
  artists: { name: string; id?: string }[];
  uri: string;
  album?: {
    name: string;
    images: { url: string }[];
  };
}

interface PlaylistOption {
  id: string;
  name: string;
  images?: { url: string }[];
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

const EnhancedRecommendations: React.FC = () => {
  const { token, currentTrack } = useSpotifyStore();
  const [recommendations, setRecommendations] = useState<Track[]>([]);
  const [availableGenres, setAvailableGenres] = useState<string[]>([]);
  const [topTracks, setTopTracks] = useState<Track[]>([]);
  const [topArtists, setTopArtists] = useState<Artist[]>([]);
  const [selectedTracks, setSelectedTracks] = useState<Track[]>([]);
  const [selectedArtists, setSelectedArtists] = useState<Artist[]>([]);
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOptionsOpen, setIsOptionsOpen] = useState(false);
  const [playingTrackId, setPlayingTrackId] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showPlaylistDialog, setShowPlaylistDialog] = useState(false);
  const [playlistOptions, setPlaylistOptions] = useState<PlaylistOption[]>([]);
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

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

  // Load initial data
  useEffect(() => {
    if (token) {
      const loadInitialData = async () => {
        try {
          setIsLoading(true);
          
          // Load available genres
          const genresData = await getAvailableGenreSeeds();
          if (genresData) {
            setAvailableGenres(genresData);
          }
          
          // Load top tracks
          const tracksData = await getTopTracks('medium_term', 20);
          if (tracksData?.items) {
            setTopTracks(tracksData.items);
          }
          
          // Load top artists
          const artistsData = await getTopArtists('medium_term', 20);
          if (artistsData?.items) {
            setTopArtists(artistsData.items);
          }
          
          // Set initial selection (1 track, 1 artist, 1 genre)
          if (tracksData?.items?.length > 0) {
            setSelectedTracks([tracksData.items[0]]);
          }
          
          if (artistsData?.items?.length > 0) {
            setSelectedArtists([artistsData.items[0]]);
          }
          
          if (genresData?.length > 0) {
            setSelectedGenres([genresData[0]]);
          }
          
          // Load initial recommendations
          await fetchRecommendations();
          
          setIsLoading(false);
        } catch (error) {
          console.error('Error loading initial data:', error);
          setIsLoading(false);
        }
      };
      
      loadInitialData();
    }
  }, [token]);

  // Load user playlists when showing dialog
  useEffect(() => {
    if (showPlaylistDialog && token) {
      const loadPlaylists = async () => {
        try {
          const playlists = await getUserPlaylists();
          if (playlists && playlists.items) {
            // Map the response to match the PlaylistOption type
            const playlistOptions: PlaylistOption[] = playlists.items.map(playlist => ({
              id: playlist.id,
              name: playlist.name,
              images: playlist.images
            }));
            setPlaylistOptions(playlistOptions);
          }
        } catch (error) {
          console.error('Error loading playlists:', error);
        }
      };
      
      loadPlaylists();
    }
  }, [showPlaylistDialog, token]);

  // Filter genres based on search query
  const filteredGenres = searchQuery
    ? availableGenres.filter(genre => 
        genre.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : availableGenres;

  // Filter tracks based on search query
  const filteredTracks = searchQuery
    ? topTracks.filter(track => 
        track.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        track.artists.some(artist => artist.name.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    : topTracks;

  // Filter artists based on search query
  const filteredArtists = searchQuery
    ? topArtists.filter(artist => 
        artist.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : topArtists;

  // Fetch recommendations based on selected seeds
  const fetchRecommendations = async () => {
    try {
      setIsLoading(true);
      
      // Prepare seed data
      const seedTracks = selectedTracks.map(track => track.id).slice(0, 5);
      const seedArtists = selectedArtists.map(artist => artist.id).slice(0, 5);
      const seedGenres = selectedGenres.slice(0, 5);
      
      // Ensure we have at least one seed
      if (seedTracks.length === 0 && seedArtists.length === 0 && seedGenres.length === 0) {
        throw new Error('At least one seed is required');
      }
      
      // Calculate how many of each seed we can use (max 5 total)
      const totalSeeds = seedTracks.length + seedArtists.length + seedGenres.length;
      let maxTracks = Math.min(seedTracks.length, 5);
      let maxArtists = Math.min(seedArtists.length, 5 - maxTracks);
      let maxGenres = Math.min(seedGenres.length, 5 - maxTracks - maxArtists);
      
      // Prepare API parameters
      const params = new URLSearchParams();
      
      if (maxTracks > 0) {
        params.append('seed_tracks', seedTracks.slice(0, maxTracks).join(','));
      }
      
      if (maxArtists > 0) {
        params.append('seed_artists', seedArtists.slice(0, maxArtists).join(','));
      }
      
      if (maxGenres > 0) {
        params.append('seed_genres', seedGenres.slice(0, maxGenres).join(','));
      }
      
      params.append('limit', '20');
      
      // Make API request
      const response = await fetch(`https://api.spotify.com/v1/recommendations?${params.toString()}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to get recommendations: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data?.tracks) {
        setRecommendations(data.tracks);
      }
      
      setIsLoading(false);
    } catch (error) {
      console.error('Error fetching recommendations:', error);
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

  // Handle adding/removing a track to/from selection
  const toggleTrack = (track: Track) => {
    // Check if track is already selected
    const trackIndex = selectedTracks.findIndex(t => t.id === track.id);
    
    if (trackIndex === -1) {
      // Add track if not at limit
      if (selectedTracks.length < 5) {
        setSelectedTracks([...selectedTracks, track]);
      }
    } else {
      // Remove track
      setSelectedTracks(selectedTracks.filter(t => t.id !== track.id));
    }
  };

  // Handle adding/removing an artist to/from selection
  const toggleArtist = (artist: Artist) => {
    // Check if artist is already selected
    const artistIndex = selectedArtists.findIndex(a => a.id === artist.id);
    
    if (artistIndex === -1) {
      // Add artist if not at limit
      if (selectedArtists.length < 5) {
        setSelectedArtists([...selectedArtists, artist]);
      }
    } else {
      // Remove artist
      setSelectedArtists(selectedArtists.filter(a => a.id !== artist.id));
    }
  };

  // Handle adding/removing a genre to/from selection
  const toggleGenre = (genre: string) => {
    // Check if genre is already selected
    const genreIndex = selectedGenres.findIndex(g => g === genre);
    
    if (genreIndex === -1) {
      // Add genre if not at limit
      if (selectedGenres.length < 5) {
        setSelectedGenres([...selectedGenres, genre]);
      }
    } else {
      // Remove genre
      setSelectedGenres(selectedGenres.filter(g => g !== genre));
    }
  };

  // Save recommendations to a playlist
  const saveToPlaylist = async () => {
    if (!selectedPlaylistId || recommendations.length === 0) {
      return;
    }
    
    try {
      setIsSaving(true);
      
      // Add each track to the playlist
      for (const track of recommendations) {
        await addTrackToPlaylist(selectedPlaylistId, track.uri);
      }
      
      setSaveSuccess(true);
      setTimeout(() => {
        setSaveSuccess(false);
        setShowPlaylistDialog(false);
      }, 2000);
      
      setIsSaving(false);
    } catch (error) {
      console.error('Error saving to playlist:', error);
      setIsSaving(false);
    }
  };

  return (
    <div className="w-full p-4">
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Music className="w-6 h-6" /> Enhanced Recommendations
        </h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsOptionsOpen(!isOptionsOpen)}
            className={`p-2 rounded-full ${isOptionsOpen ? 'bg-green-500' : 'bg-gray-700'} hover:bg-green-600 transition-colors`}
          >
            <Sliders className="w-5 h-5" />
          </button>
          <button
            onClick={fetchRecommendations}
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
          <button
            onClick={() => setShowPlaylistDialog(true)}
            className="flex items-center gap-1 text-sm bg-gray-700 hover:bg-gray-600 text-white py-2 px-4 rounded-full transition-colors"
            disabled={recommendations.length === 0}
          >
            <Save className="w-4 h-4" />
            Save to Playlist
          </button>
        </div>
      </div>
      
      {/* Selection criteria */}
      {isOptionsOpen && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="mb-6 bg-gray-800/50 rounded-lg p-4"
        >
          <h3 className="font-bold mb-3">Customize Recommendations</h3>
          
          <div className="mb-4">
            <input
              type="text"
              placeholder="Search tracks, artists, or genres..."
              className="w-full p-2 bg-gray-700 rounded-md mb-4"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Track selection */}
            <div className="bg-gray-900/60 rounded-lg p-3">
              <h4 className="font-medium flex items-center gap-1 mb-2">
                <Music className="w-4 h-4" /> Tracks 
                <span className="text-xs text-gray-400 ml-1">({selectedTracks.length}/5)</span>
              </h4>
              
              <div className="flex flex-wrap gap-1 mb-2">
                {selectedTracks.map(track => (
                  <div 
                    key={track.id} 
                    className="bg-green-500 text-xs py-1 px-2 rounded-full flex items-center gap-1"
                  >
                    <span className="max-w-[100px] truncate">{track.name}</span>
                    <button 
                      onClick={() => toggleTrack(track)}
                      className="ml-1"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
              
              <div className="max-h-32 overflow-y-auto custom-scrollbar">
                {filteredTracks.map(track => (
                  <div 
                    key={track.id}
                    className={`flex items-center p-1.5 rounded text-sm hover:bg-white/10 cursor-pointer mb-1
                      ${selectedTracks.some(t => t.id === track.id) ? 'bg-white/20' : ''}`}
                    onClick={() => toggleTrack(track)}
                  >
                    <div className="w-6 h-6 mr-2">
                      {track.album?.images[0] ? (
                        <img 
                          src={track.album.images[0].url} 
                          alt={track.name}
                          className="w-full h-full object-cover rounded"
                        />
                      ) : (
                        <Music className="w-full h-full" />
                      )}
                    </div>
                    <div className="truncate flex-1">{track.name}</div>
                    {selectedTracks.some(t => t.id === track.id) && (
                      <Check className="w-4 h-4 text-green-500 ml-1" />
                    )}
                  </div>
                ))}
              </div>
            </div>
            
            {/* Artist selection */}
            <div className="bg-gray-900/60 rounded-lg p-3">
              <h4 className="font-medium flex items-center gap-1 mb-2">
                <Disc className="w-4 h-4" /> Artists
                <span className="text-xs text-gray-400 ml-1">({selectedArtists.length}/5)</span>
              </h4>
              
              <div className="flex flex-wrap gap-1 mb-2">
                {selectedArtists.map(artist => (
                  <div 
                    key={artist.id} 
                    className="bg-purple-500 text-xs py-1 px-2 rounded-full flex items-center gap-1"
                  >
                    <span className="max-w-[100px] truncate">{artist.name}</span>
                    <button 
                      onClick={() => toggleArtist(artist)}
                      className="ml-1"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
              
              <div className="max-h-32 overflow-y-auto custom-scrollbar">
                {filteredArtists.map(artist => (
                  <div 
                    key={artist.id}
                    className={`flex items-center p-1.5 rounded text-sm hover:bg-white/10 cursor-pointer mb-1
                      ${selectedArtists.some(a => a.id === artist.id) ? 'bg-white/20' : ''}`}
                    onClick={() => toggleArtist(artist)}
                  >
                    <div className="w-6 h-6 mr-2">
                      {artist.images && artist.images[0] ? (
                        <img 
                          src={artist.images[0].url} 
                          alt={artist.name}
                          className="w-full h-full object-cover rounded-full"
                        />
                      ) : (
                        <Disc className="w-full h-full" />
                      )}
                    </div>
                    <div className="truncate flex-1">{artist.name}</div>
                    {selectedArtists.some(a => a.id === artist.id) && (
                      <Check className="w-4 h-4 text-green-500 ml-1" />
                    )}
                  </div>
                ))}
              </div>
            </div>
            
            {/* Genre selection */}
            <div className="bg-gray-900/60 rounded-lg p-3">
              <h4 className="font-medium flex items-center gap-1 mb-2">
                <Tag className="w-4 h-4" /> Genres
                <span className="text-xs text-gray-400 ml-1">({selectedGenres.length}/5)</span>
              </h4>
              
              <div className="flex flex-wrap gap-1 mb-2">
                {selectedGenres.map(genre => (
                  <div 
                    key={genre} 
                    className="bg-blue-500 text-xs py-1 px-2 rounded-full flex items-center gap-1"
                  >
                    <span className="max-w-[100px] truncate">{genre}</span>
                    <button 
                      onClick={() => toggleGenre(genre)}
                      className="ml-1"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
              
              <div className="max-h-32 overflow-y-auto custom-scrollbar">
                {filteredGenres.map(genre => (
                  <div 
                    key={genre}
                    className={`flex items-center p-1.5 rounded text-sm hover:bg-white/10 cursor-pointer mb-1
                      ${selectedGenres.includes(genre) ? 'bg-white/20' : ''}`}
                    onClick={() => toggleGenre(genre)}
                  >
                    <Tag className="w-4 h-4 mr-2" />
                    <div className="truncate flex-1">{genre}</div>
                    {selectedGenres.includes(genre) && (
                      <Check className="w-4 h-4 text-green-500 ml-1" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
          
          <div className="mt-4 flex justify-end">
            <button
              onClick={fetchRecommendations}
              className="bg-green-500 text-white py-2 px-4 rounded-md hover:bg-green-600"
              disabled={selectedTracks.length + selectedArtists.length + selectedGenres.length === 0}
            >
              Generate Recommendations
            </button>
          </div>
        </motion.div>
      )}
      
      {/* Recommendations grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {recommendations.map((track) => (
          <motion.div
            key={track.id}
            whileHover={{ y: -5 }}
            className="bg-gray-800/50 rounded-lg overflow-hidden cursor-pointer group relative"
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
      
      {/* Loading state */}
      {isLoading && (
        <div className="flex justify-center items-center mt-8">
          <div className="animate-pulse text-gray-400 flex items-center">
            <RefreshCw className="w-5 h-5 mr-2 animate-spin" />
            Loading recommendations...
          </div>
        </div>
      )}
      
      {/* Empty state */}
      {recommendations.length === 0 && !isLoading && (
        <div className="text-center py-16 bg-gray-800/30 rounded-lg">
          <div className="text-gray-400 mb-2">No recommendations yet</div>
          <p className="text-sm text-gray-500 max-w-md mx-auto mb-4">
            Select tracks, artists, or genres as seed data to generate personalized recommendations.
          </p>
          <button 
            onClick={() => {
              if (!isOptionsOpen) setIsOptionsOpen(true);
              fetchRecommendations();
            }}
            className="bg-green-500 text-white py-2 px-4 rounded-full hover:bg-green-600"
          >
            Generate Recommendations
          </button>
        </div>
      )}
      
      {/* Playlist save dialog */}
      {showPlaylistDialog && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-lg p-5 w-full max-w-md">
            <h3 className="text-xl font-bold mb-4">Save to Playlist</h3>
            
            {saveSuccess ? (
              <div className="text-center py-8">
                <div className="flex justify-center mb-4">
                  <div className="bg-green-500 p-3 rounded-full inline-flex">
                    <Check className="w-6 h-6" />
                  </div>
                </div>
                <p className="font-medium">Tracks successfully added to playlist!</p>
              </div>
            ) : (
              <>
                <p className="text-gray-400 mb-4">
                  Select a playlist to save {recommendations.length} tracks to:
                </p>
                
                <div className="max-h-64 overflow-y-auto mb-4 custom-scrollbar">
                  {playlistOptions.map(playlist => (
                    <div 
                      key={playlist.id}
                      className={`flex items-center p-2 rounded-md hover:bg-gray-700 cursor-pointer mb-1 ${
                        selectedPlaylistId === playlist.id ? 'bg-gray-700' : ''
                      }`}
                      onClick={() => setSelectedPlaylistId(playlist.id)}
                    >
                      <div className="w-10 h-10 mr-3">
                        {playlist.images && playlist.images[0] ? (
                          <img 
                            src={playlist.images[0].url} 
                            alt={playlist.name} 
                            className="w-full h-full object-cover rounded"
                          />
                        ) : (
                          <div className="w-full h-full bg-gray-600 rounded flex items-center justify-center">
                            <Music className="w-6 h-6 text-gray-400" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 truncate">{playlist.name}</div>
                      {selectedPlaylistId === playlist.id && (
                        <Check className="w-5 h-5 text-green-500" />
                      )}
                    </div>
                  ))}
                </div>
                
                <div className="flex justify-end gap-2">
                  <button 
                    className="px-4 py-2 bg-gray-700 rounded-md hover:bg-gray-600"
                    onClick={() => setShowPlaylistDialog(false)}
                  >
                    Cancel
                  </button>
                  <button 
                    className="px-4 py-2 bg-green-500 rounded-md hover:bg-green-600 flex items-center disabled:opacity-50"
                    disabled={!selectedPlaylistId || isSaving}
                    onClick={saveToPlaylist}
                  >
                    {isSaving ? (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4 mr-2" />
                        Save
                      </>
                    )}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default EnhancedRecommendations; 