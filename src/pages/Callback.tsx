import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { setAccessToken, getCurrentUser } from '../lib/spotify';
import useSpotifyStore from '../stores/useSpotifyStore';
import { Loader2 } from 'lucide-react';

const Callback: React.FC = () => {
  const navigate = useNavigate();
  const { setToken, setUser, setError } = useSpotifyStore();

  useEffect(() => {
    const initializeSession = async () => {
      try {
        console.log('Current URL hash:', window.location.hash);

        const hash = window.location.hash
          .substring(1)
          .split('&')
          .reduce((acc, item) => {
            const [key, value] = item.split('=');
            acc[key] = value;
            return acc;
          }, {} as { [key: string]: string });

        console.log('Parsed hash object:', hash);  // Log the parsed object to verify token extraction

        if (!hash.access_token) {
          throw new Error('No access token received from Spotify');
        }

        // Set token and initialize Spotify client
        setToken(hash.access_token);
        setAccessToken(hash.access_token);

        // Fetch user profile
        const user = await getCurrentUser();
        setUser(user);

        // Clear hash from URL to prevent it from showing in the URL bar
        window.history.replaceState({}, document.title, window.location.pathname);
        console.log('Redirecting to /player...');  // Log to verify navigation
        navigate('/player');  // Trigger the navigation to the player page
      } catch (error) {
        console.error('Authentication error:', error);
        setError(error instanceof Error ? error.message : 'Failed to authenticate with Spotify');
        navigate('/');
      }
    };

    initializeSession();
  }, [navigate, setToken, setUser, setError]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center">
      <div className="bg-white rounded-lg shadow-xl p-8 flex flex-col items-center">
        <Loader2 className="w-8 h-8 text-green-500 animate-spin mb-4" />
        <div className="text-gray-800 text-lg font-medium">Connecting to Spotify...</div>
        <p className="text-gray-500 text-sm mt-2">Please wait while we set up your session</p>
      </div>
    </div>
  );
};

export default Callback;