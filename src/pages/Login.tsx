import React, { useState, useEffect } from 'react';
import { Music } from 'lucide-react';
import { SPOTIFY_AUTH_URL } from '../lib/spotify';
import useSpotifyStore from '../stores/useSpotifyStore';

const Login: React.FC = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { clearSession } = useSpotifyStore();
  
  // Immediately clear any existing session when the login page is loaded
  useEffect(() => {
    clearSession();
    localStorage.removeItem('spotify_token');
    localStorage.removeItem('spotify_token_expiration');
  }, [clearSession]);

  const handleLogin = async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Force showing the dialog to make sure the user can select proper permissions
      const authUrlWithDialog = `${SPOTIFY_AUTH_URL}&show_dialog=true`;
      window.location.href = authUrlWithDialog;
    } catch (err) {
      setError('Failed to connect to Spotify. Please try again.');
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full text-center">
        <div className="mb-6">
          <Music className="w-16 h-16 text-green-500 mx-auto" />
        </div>
        <h1 className="text-3xl font-bold mb-2">Welcome to Spotify Gesture Control</h1>
        <p className="text-gray-600 mb-8">
          Control your music with hand gestures and enjoy a hands-free experience
        </p>
        {error && <p className="text-red-500 mb-4">{error}</p>}
        <button
          onClick={handleLogin}
          disabled={isLoading}
          className="inline-block bg-green-500 text-white px-8 py-3 rounded-full font-semibold hover:bg-green-600 transition-colors"
        >
          {isLoading ? 'Connecting...' : 'Connect with Spotify'}
        </button>
      </div>
    </div>
  );
};

export default Login;
