import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, User } from 'lucide-react';
import { getUserFollowers } from '../lib/spotify';
import useSpotifyStore from '../stores/useSpotifyStore';

const Followers: React.FC = () => {
  const navigate = useNavigate();
  const { token, user } = useSpotifyStore();
  
  const [followerCount, setFollowerCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    if (!token) {
      navigate('/');
      return;
    }
    
    const loadFollowersData = async () => {
      try {
        setIsLoading(true);
        
        // Load followers data
        const followersData = await getUserFollowers();
        setFollowerCount(followersData.total);
        
        setIsLoading(false);
      } catch (error) {
        console.error('Error loading followers data:', error);
        setIsLoading(false);
      }
    };
    
    loadFollowersData();
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
          <h1 className="text-2xl font-bold">Followers</h1>
        </div>
        
        {/* Followers information */}
        <div className="mt-8 max-w-lg mx-auto">
          <div className="bg-gray-800/50 rounded-lg p-6 text-center">
            <div className="w-32 h-32 mx-auto mb-6">
              {user?.images && user.images[0] ? (
                <img 
                  src={user.images[0].url} 
                  alt={user.display_name}
                  className="w-full h-full object-cover rounded-full"
                />
              ) : (
                <div className="w-full h-full bg-gray-700 rounded-full flex items-center justify-center">
                  <User className="w-16 h-16 text-gray-500" />
                </div>
              )}
            </div>
            
            <h2 className="text-2xl font-bold mb-4">{user?.display_name}</h2>
            
            <div className="text-4xl font-bold mb-2">
              {followerCount.toLocaleString()}
            </div>
            <div className="text-gray-400">
              {followerCount === 1 ? 'Follower' : 'Followers'}
            </div>
            
            <div className="mt-8 text-gray-400">
              <p>Spotify currently doesn't provide an API to view who is following you.</p>
              <p className="mt-2">You can view your followers on the Spotify app or website.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Followers; 