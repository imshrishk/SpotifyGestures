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
        const getAccessTokenFromLocation = () => {
          if (window.location.hash) {
            const hashParams = window.location.hash
              .substring(1)
              .split('&')
              .reduce((acc, item) => {
                const [key, value] = item.split('=');
                acc[key] = decodeURIComponent(value);
                return acc;
              }, {} as Record<string, string>);
            return hashParams.access_token;
          }
          const searchParams = new URLSearchParams(window.location.search);
          return searchParams.get('access_token');
        };
        const accessToken = getAccessTokenFromLocation();
        if (!accessToken) {
          throw new Error('No access token found in URL');
        }
        setToken(accessToken);
        setAccessToken(accessToken);
        const user = await getCurrentUser();
        setUser(user);
        window.history.replaceState({}, document.title, window.location.pathname);
        navigate('/player');
      } catch (error) {
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
