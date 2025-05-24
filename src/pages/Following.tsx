import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ExternalLink, User } from 'lucide-react';
import { getUserFollowedArtists } from '../lib/spotify';
import useSpotifyStore from '../stores/useSpotifyStore';
import { motion } from 'framer-motion';

interface Artist {
  id: string;
  name: string;
  images?: { url: string }[];
  external_urls?: { spotify: string };
  followers?: { total: number };
}

const Following: React.FC = () => {
  const navigate = useNavigate();
  const { token } = useSpotifyStore();
  
  const [followedArtists, setFollowedArtists] = useState<Artist[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    if (!token) {
      navigate('/');
      return;
    }
    
    const loadFollowingData = async () => {
      try {
        setIsLoading(true);
        
        // Load followed artists
        const artistsData = await getUserFollowedArtists();
        if (artistsData?.items) {
          setFollowedArtists(artistsData.items);
        }
        
        setIsLoading(false);
      } catch (error) {
        console.error('Error loading following data:', error);
        setIsLoading(false);
      }
    };
    
    loadFollowingData();
  }, [token, navigate]);
  
  if (isLoading) {
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
            onClick={() => navigate('/profile')}
            className="p-2 rounded-full bg-black/30 hover:bg-black/50 mr-4 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-2xl font-bold">Following</h1>
        </div>
        
        {/* Followed artists list */}
        <div className="mt-8">
          <h2 className="text-xl font-bold mb-6">Artists</h2>
          
          {followedArtists.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <p>You're not following any artists yet.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {followedArtists.map((artist, index) => (
                <motion.div
                  key={artist.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="bg-gray-800/50 p-4 rounded-lg hover:bg-gray-700/50 transition-colors"
                >
                  <div className="flex flex-col items-center text-center">
                    <div className="w-32 h-32 mb-4">
                      {artist.images && artist.images[0] ? (
                        <img 
                          src={artist.images[0].url} 
                          alt={artist.name}
                          className="w-full h-full object-cover rounded-full"
                        />
                      ) : (
                        <div className="w-full h-full bg-gray-700 rounded-full flex items-center justify-center">
                          <User className="w-12 h-12 text-gray-500" />
                        </div>
                      )}
                    </div>
                    <div className="font-medium mb-1">{artist.name}</div>
                    <div className="text-sm text-gray-400 mb-3">
                      {artist.followers?.total.toLocaleString()} followers
                    </div>
                    <a
                      href={artist.external_urls?.spotify}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs flex items-center gap-1 text-gray-400 hover:text-white"
                    >
                      Open in Spotify <ExternalLink className="w-3 h-3" />
                    </a>
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

export default Following; 