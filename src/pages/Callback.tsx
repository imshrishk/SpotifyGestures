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
        // Get token from URL hash fragments
        const hashParams = window.location.hash
          .substring(1)
          .split('&')
          .reduce((acc, item) => {
            const [key, value] = item.split('=');
            acc[key] = decodeURIComponent(value);
            return acc;
          }, {} as Record<string, string>);
        
        const accessToken = hashParams.access_token;
        const expiresIn = parseInt(hashParams.expires_in || '3600');
        
        if (!accessToken) {
          throw new Error('No access token found');
        }

        // Set the token in our app state and Spotify client
        // This will also store it in localStorage with expiration
        setToken(accessToken);
        setAccessToken(accessToken, expiresIn);

        // Get and store user data
        const spotifyUser = await getCurrentUser();
        // Map Spotify user to our User type
        const user = {
          id: spotifyUser.id,
          display_name: spotifyUser.display_name || 'Spotify User', // Provide default if undefined
          images: spotifyUser.images,
          followers: spotifyUser.followers,
          product: spotifyUser.product // Store account type (premium, free, etc.)
        };
        setUser(user); // This will also update localStorage

        // Clean up URL
        if (window.location.hash) {
          window.history.replaceState({}, document.title, window.location.pathname);
        }

        // Small delay to ensure store updates are processed
        setTimeout(() => {
          navigate('/');
        }, 100);
      } catch (error) {
        console.error('Auth error:', error);
        localStorage.removeItem('spotify_token');
        localStorage.removeItem('spotify_token_expiration');
        localStorage.removeItem('spotify_user');
        setError(error instanceof Error ? error.message : 'Failed to authenticate with Spotify');
        navigate('/');
      }
    };

    initializeSession();
  }, [navigate, setToken, setUser, setError]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center">
      <div className="bg-gray-800/50 backdrop-blur-lg rounded-lg shadow-xl p-8 flex flex-col items-center border border-white/10">
        <Loader2 className="w-8 h-8 text-green-500 animate-spin mb-4" />
        <div className="text-white text-lg font-medium">Connecting to Spotify...</div>
        <p className="text-gray-400 text-sm mt-2">Please wait while we set up your session</p>
      </div>
    </div>
  );
};

export default Callback;
