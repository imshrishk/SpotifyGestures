import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Music, Play, Pause } from 'lucide-react';
import useSpotifyStore from '../stores/useSpotifyStore';
import { playTrack, pauseTrack } from '../lib/spotify';
import { motion } from 'framer-motion';



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


import { RecommendationSlab } from '../lib/recommendationStrategies';

const Explore: React.FC = () => {
  const navigate = useNavigate();
  const { token, currentTrack } = useSpotifyStore();
  const [slabs, setSlabs] = useState<RecommendationSlab[]>([]);
  const [isLoading, setIsLoading] = useState(false);
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
    fetchSlabs();
  }, [token, navigate]);

  const fetchSlabs = async () => {
    setIsLoading(true);
    try {
      // Import dynamically to avoid circular dependencies if any, or just use the global import
      const { getMultiSlabRecommendations } = await import('../lib/spotify');
      const fetchedSlabs = await getMultiSlabRecommendations();
      setSlabs(fetchedSlabs);
    } catch (error) {
      console.error('Error fetching recommendations:', error);
    } finally {
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

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-black text-white p-4 md:p-8 pb-24">
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

        {isLoading ? (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full"></div>
          </div>
        ) : (
          <div className="space-y-12">
            {slabs.length > 0 ? (
              slabs.map((slab) => (
                <div key={slab.type} className="space-y-4">
                  <div>
                    <h2 className="text-xl font-bold flex items-center gap-2">
                      {slab.label} <span className="text-xs font-normal text-gray-500 uppercase tracking-wider border border-gray-700 px-2 py-0.5 rounded">{slab.type}</span>
                    </h2>
                    <p className="text-sm text-gray-400">{slab.description}</p>
                  </div>

                  {slab.tracks.length > 0 ? (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                      {slab.tracks.map((track: any) => (
                        <motion.div
                          key={track.id}
                          whileHover={{ y: -5 }}
                          className="bg-gray-800/50 rounded-lg overflow-hidden cursor-pointer group relative"
                          onClick={() => navigate(`/track/${track.id}`)}
                        >
                          <div className="aspect-square relative">
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
                            <div className="truncate text-xs text-gray-400">{track.artists.map((a: any) => a.name).join(', ')}</div>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  ) : (
                    <div className="bg-gray-800/30 p-6 rounded-lg text-center">
                      <p className="text-gray-500">No tracks found for this mood yet. Try listening to more music!</p>
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div className="text-center py-12">
                <p className="text-gray-400 mb-4">No recommendations found yet. Try playing some music!</p>
                <div className="inline-block text-left bg-gray-900 p-4 rounded text-xs font-mono text-gray-500 mb-4">
                  <p>Debug Info:</p>
                  <p>Token: {token ? 'Present' : 'Missing'}</p>
                  <p>Slabs: {slabs.length}</p>
                </div>
                <div>
                  <button
                    onClick={() => fetchSlabs()}
                    className="mt-4 px-4 py-2 bg-green-600 rounded-full text-sm hover:bg-green-700 transition"
                  >
                    Retry Fetching
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Explore;
