import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import NowPlaying from '../components/NowPlaying';
import Queue from '../components/Queue';
import GestureControl from '../components/GestureControl';
import UserProfile from '../components/UserProfile';
import useSpotifyStore from '../stores/useSpotifyStore';
import { getCurrentTrack, getQueue } from '../lib/spotify';
import { AlertCircle, Loader2 } from 'lucide-react';

const Player: React.FC = () => {
  const navigate = useNavigate();
  const { token, user, error, setCurrentTrack, setQueue, setError, setIsPlaying } =
    useSpotifyStore();
  const [isLoading, setIsLoading] = useState(true);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    if (!token || !user) {
      navigate('/');
      return;
    }
  
    const updatePlayerState = async () => {
      try {
        const [trackResponse, queueResponse] = await Promise.all([
          getCurrentTrack(),
          getQueue(),
        ]);
  
        console.log('Track Response:', trackResponse);
        console.log('Queue Response:', queueResponse);
  
        if (trackResponse?.item) {
          setCurrentTrack(trackResponse.item);
          setIsPlaying(trackResponse.is_playing);
          setError(null);
        } else {
          console.warn('No current track found');
          setCurrentTrack(null);
        }
  
        if (queueResponse?.queue) {
          setQueue(queueResponse.queue);
        } else {
          console.warn('No queue found');
          setQueue([]);
        }
  
        setIsLoading(false);
        setRetryCount(0);
      } catch (error) {
        console.error('Failed to fetch player state:', error);
        
        // More detailed error logging
        if (error instanceof Error) {
          console.error('Error details:', error.message);
          setError(error.message);
        }
  
        // Improved error handling
        if (retryCount < 3) {
          setRetryCount((prev) => prev + 1);
          setError(`Reconnecting to Spotify... (Attempt ${retryCount + 1}/3)`);
        } else {
          setError('Unable to connect to Spotify. Please check your connection and active device.');
        }
  
        setIsLoading(false);
      }
    };
  
    updatePlayerState();
    const interval = setInterval(updatePlayerState, 5000);
  
    return () => clearInterval(interval);
  }, [token, user, navigate, setCurrentTrack, setQueue, setError, setIsPlaying, retryCount]);

  if (!token || !user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-black text-white p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">Spotify Gesture Control</h1>
          <UserProfile />
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-8 h-8 animate-spin text-green-500" />
          </div>
        ) : (
          <>
            {error && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 mb-8 flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                <div>
                  <p className="text-red-200">{error}</p>
                  {retryCount > 0 && (
                    <p className="text-red-300 text-sm mt-1">
                      Retry attempt {retryCount}/3...
                    </p>
                  )}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 space-y-8">
                <NowPlaying />
                <Queue />
              </div>

              <div className="bg-gray-800 rounded-xl p-6">
                <h2 className="text-xl font-semibold mb-4">Gesture Control</h2>
                <GestureControl />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default Player;