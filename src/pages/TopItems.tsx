import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Music, Disc, ChevronRight, Clock, UserIcon } from 'lucide-react';
import useSpotifyStore from '../stores/useSpotifyStore';
import { getTopTracks, getTopArtists } from '../lib/spotify';

interface TopItem {
  id: string;
  name: string;
  images?: { url: string }[];
  album?: {
    images: { url: string }[];
  };
  artists?: { name: string }[];
  uri: string;
}

type TimeRange = 'short_term' | 'medium_term' | 'long_term';
type ItemType = 'tracks' | 'artists';

const timeRangeLabels: Record<TimeRange, string> = {
  short_term: 'Last 4 Weeks',
  medium_term: 'Last 6 Months',
  long_term: 'All Time'
};

const timeRangeDescriptions: Record<TimeRange, string> = {
  short_term: 'Your top items from the past 4 weeks. This is your most recent listening activity.',
  medium_term: 'Your top items from the past 6 months. A good representation of your current favorites.',
  long_term: 'Your top items calculated from your full listening history. Your all-time favorites.'
};

const TopItems: React.FC = () => {
  const navigate = useNavigate();
  const { token } = useSpotifyStore();
  const [isLoading, setIsLoading] = useState(true);
  const [itemType, setItemType] = useState<ItemType>('tracks');
  
  // Store top items separately for each time range to allow viewing all ranges at once
  const [topTracks, setTopTracks] = useState<Record<TimeRange, TopItem[]>>({
    short_term: [],
    medium_term: [],
    long_term: []
  });
  
  const [topArtists, setTopArtists] = useState<Record<TimeRange, TopItem[]>>({
    short_term: [],
    medium_term: [],
    long_term: []
  });

  useEffect(() => {
    if (!token) {
      navigate('/login');
      return;
    }

    const loadTopItems = async () => {
      setIsLoading(true);
      
      try {
        // Load tracks and artists for all time ranges in parallel
        const timeRanges: TimeRange[] = ['short_term', 'medium_term', 'long_term'];
        
        const trackPromises = timeRanges.map(range => 
          getTopTracks(range, 50)
            .then(data => ({ range, data: data.items || [] }))
            .catch(err => {
              console.error(`Error loading top tracks for ${range}:`, err);
              return { range, data: [] };
            })
        );
        
        const artistPromises = timeRanges.map(range => 
          getTopArtists(range, 50)
            .then(data => ({ range, data: data.items || [] }))
            .catch(err => {
              console.error(`Error loading top artists for ${range}:`, err);
              return { range, data: [] };
            })
        );
        
        // Wait for all requests to complete
        const trackResults = await Promise.all(trackPromises);
        const artistResults = await Promise.all(artistPromises);
        
        // Update state with results
        const newTopTracks = { ...topTracks };
        const newTopArtists = { ...topArtists };
        
        trackResults.forEach(result => {
          newTopTracks[result.range] = result.data;
        });
        
        artistResults.forEach(result => {
          newTopArtists[result.range] = result.data;
        });
        
        setTopTracks(newTopTracks);
        setTopArtists(newTopArtists);
      } catch (error) {
        console.error('Error loading top items:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadTopItems();
  }, [token, navigate]);
  
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
          <h1 className="text-2xl font-bold">Your Top {itemType === 'tracks' ? 'Tracks' : 'Artists'}</h1>
        </div>

        {/* Toggle between tracks and artists */}
        <div className="flex border-b border-gray-800 mb-8">
          <button
            className={`px-4 py-3 font-medium flex items-center gap-2 ${
              itemType === 'tracks' 
                ? 'text-green-500 border-b-2 border-green-500' 
                : 'text-gray-400 hover:text-white'
            }`}
            onClick={() => setItemType('tracks')}
          >
            <Music className="w-4 h-4" /> Top Tracks
          </button>
          <button
            className={`px-4 py-3 font-medium flex items-center gap-2 ${
              itemType === 'artists' 
                ? 'text-green-500 border-b-2 border-green-500' 
                : 'text-gray-400 hover:text-white'
            }`}
            onClick={() => setItemType('artists')}
          >
            <Disc className="w-4 h-4" /> Top Artists
          </button>
        </div>

        {/* Show all time ranges at once */}
        <div className="space-y-12">
          {Object.entries(timeRangeLabels).map(([range, label]) => (
            <div key={range} className="mb-8">
              <h2 className="text-xl font-bold mb-2">{label}</h2>
              <p className="text-gray-400 text-sm mb-6">{timeRangeDescriptions[range as TimeRange]}</p>
              
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                {itemType === 'tracks' ? (
                  // Top tracks for this time range
                  topTracks[range as TimeRange].slice(0, 12).map((track, index) => (
                    <motion.div
                      key={`${track.id}-${index}`}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="bg-gray-800/30 rounded-lg p-3 hover:bg-gray-800/50 transition-colors group cursor-pointer"
                      onClick={() => navigate(`/track/${track.id}`)}
                    >
                      <div className="aspect-square mb-3 relative">
                        {track.album?.images[0] ? (
                          <img 
                            src={track.album.images[0].url} 
                            alt={track.name}
                            className="w-full h-full object-cover rounded-md"
                          />
                        ) : (
                          <div className="w-full h-full bg-gray-700 rounded-md flex items-center justify-center">
                            <Music className="w-12 h-12 text-gray-500" />
                          </div>
                        )}
                        <div className="absolute top-2 right-2 bg-gray-900/70 text-xs text-white rounded-full w-6 h-6 flex items-center justify-center">
                          {index + 1}
                        </div>
                      </div>
                      <div className="truncate font-medium text-sm">{track.name}</div>
                      <div className="text-xs text-gray-400 truncate">
                        {track.artists?.map(artist => artist.name).join(', ')}
                      </div>
                    </motion.div>
                  ))
                ) : (
                  // Top artists for this time range
                  topArtists[range as TimeRange].slice(0, 12).map((artist, index) => (
                    <motion.div
                      key={`${artist.id}-${index}`}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="bg-gray-800/30 rounded-lg p-3 hover:bg-gray-800/50 transition-colors cursor-pointer"
                    >
                      <div className="aspect-square mb-3 relative">
                        {artist.images && artist.images[0] ? (
                          <img 
                            src={artist.images[0].url} 
                            alt={artist.name}
                            className="w-full h-full object-cover rounded-full"
                          />
                        ) : (
                          <div className="w-full h-full bg-gray-700 rounded-full flex items-center justify-center">
                            <UserIcon className="w-12 h-12 text-gray-500" />
                          </div>
                        )}
                        <div className="absolute top-2 right-2 bg-gray-900/70 text-xs text-white rounded-full w-6 h-6 flex items-center justify-center">
                          {index + 1}
                        </div>
                      </div>
                      <div className="truncate font-medium text-sm text-center">{artist.name}</div>
                    </motion.div>
                  ))
                )}
              </div>
              
              {/* View all button */}
              <div className="mt-4 flex justify-center">
                <button 
                  className="text-sm text-gray-400 hover:text-white flex items-center gap-1"
                  onClick={() => navigate(`/top/${itemType}/${range}`)}
                >
                  View all <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default TopItems; 