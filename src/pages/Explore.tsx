import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Music, Disc, Tag, Search, Play, Pause } from 'lucide-react';
import useSpotifyStore from '../stores/useSpotifyStore';
import { getRecommendations, getAvailableGenreSeeds, playTrack, pauseTrack } from '../lib/spotify';
import { motion } from 'framer-motion';

interface Track {
  id: string;
  name: string;
  artists: { name: string }[];
  album: {
    images: { url: string }[];
  };
  uri: string;
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

const Explore: React.FC = () => {
  const navigate = useNavigate();
  const { token, currentTrack } = useSpotifyStore();
  const [selectedGenre, setSelectedGenre] = useState<string>('');
  const [availableGenres, setAvailableGenres] = useState<string[]>([]);
  const [recommendations, setRecommendations] = useState<Track[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [playingTrackId, setPlayingTrackId] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);

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
    if (!token) {
      navigate('/');
      return;
    }
    
    // Load available genres
    const loadGenres = async () => {
      try {
        const genres = await getAvailableGenreSeeds();
        if (genres && genres.length > 0) {
          setAvailableGenres(genres);
          // Set a default genre
          setSelectedGenre(genres[0]);
          
          // Get initial recommendations based on first genre
          await fetchRecommendations(genres[0]);
        }
      } catch (error) {
        console.error('Error loading genres:', error);
      }
    };
    
    loadGenres();
  }, [token, navigate]);

  // Filter genres based on search query
  const filteredGenres = searchQuery
    ? availableGenres.filter(genre => 
        genre.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : availableGenres;

  // Fetch recommendations based on selected genre
  const fetchRecommendations = async (genre: string) => {
    if (!genre) return;
    
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('seed_genres', genre);
      params.append('limit', '20');
      
      const response = await fetch(`https://api.spotify.com/v1/recommendations?${params.toString()}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.tracks) {
          setRecommendations(data.tracks);
        }
      }
    } catch (error) {
      console.error('Error fetching recommendations:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle genre selection
  const handleGenreSelect = (genre: string) => {
    setSelectedGenre(genre);
    fetchRecommendations(genre);
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

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-black text-white p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header with back button */}
        <div className="flex items-center mb-8">
          <button 
            onClick={() => navigate(-1)}
            className="p-2 rounded-full bg-black/30 hover:bg-black/50 mr-4 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-2xl font-bold">Explore</h1>
        </div>
        
        {/* Two column layout */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {/* Sidebar with genres */}
          <div className="md:col-span-1">
            <div className="bg-gray-800/50 rounded-lg p-4">
              <h2 className="font-bold mb-4 flex items-center gap-2">
                <Tag className="w-4 h-4" /> Genres
              </h2>
              
              <div className="mb-4">
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input 
                    type="text"
                    placeholder="Search genres..."
                    className="bg-gray-700 rounded-full py-2 pl-10 pr-4 w-full text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
              </div>
              
              <div className="max-h-96 overflow-y-auto pr-2 space-y-1 custom-scrollbar">
                {filteredGenres.map(genre => (
                  <button
                    key={genre}
                    className={`w-full text-left py-2 px-3 rounded-md text-sm transition-colors ${
                      selectedGenre === genre 
                        ? 'bg-green-500 text-white' 
                        : 'hover:bg-gray-700 text-gray-300'
                    }`}
                    onClick={() => handleGenreSelect(genre)}
                  >
                    {genre}
                  </button>
                ))}
              </div>
            </div>
          </div>
          
          {/* Main content with recommendations */}
          <div className="md:col-span-3">
            <div className="bg-gray-800/30 rounded-lg p-4">
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                <Music className="w-5 h-5" /> 
                {selectedGenre ? `${selectedGenre} Recommendations` : 'Select a genre'}
              </h2>
              
              {isLoading ? (
                <div className="flex justify-center items-center py-12">
                  <div className="animate-spin w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full"></div>
                </div>
              ) : (
                <>
                  {recommendations.length > 0 ? (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                      {recommendations.map(track => (
                        <motion.div
                          key={track.id}
                          whileHover={{ y: -5 }}
                          className="bg-gray-800/50 rounded-lg overflow-hidden cursor-pointer group relative"
                          onClick={() => navigate(`/track/${track.id}`)}
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
                  ) : (
                    <div className="text-center py-12">
                      <p className="text-gray-400 mb-4">No recommendations found</p>
                      <button 
                        className="bg-green-500 hover:bg-green-600 text-white py-2 px-4 rounded-full text-sm transition-colors"
                        onClick={() => fetchRecommendations(selectedGenre)}
                      >
                        Try Again
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Explore; 