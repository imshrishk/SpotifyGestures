import React, { useState, useEffect } from 'react';
import { Hand, Palette, Star } from 'lucide-react';
import { SPOTIFY_AUTH_URL, buildPkceAuthUrl } from '../lib/spotify';
import useSpotifyStore from '../stores/useSpotifyStore';
import Player from '../pages/Player';

const AuthOrPlayer: React.FC = () => {
  const { isAuthenticated } = useSpotifyStore();
  const [isLoading, setIsLoading] = useState(false);
  const token = localStorage.getItem('spotify_token');
  const tokenExpiry = localStorage.getItem('spotify_token_expires_at');
  const authenticated = !!(token && tokenExpiry && Date.now() < parseInt(tokenExpiry));

  useEffect(() => {
    try {
      console.debug('[AuthOrPlayer] isAuthenticated effect, result:', isAuthenticated());
    } catch {
      console.debug('[AuthOrPlayer] isAuthenticated check failed');
    }
  }, [isAuthenticated]);

  const handleLogin = async () => {
    setIsLoading(true);
    try {
      const url = await buildPkceAuthUrl();
      const authUrlWithDialog = url.includes('show_dialog') ? url : `${url}&show_dialog=true`;
      window.location.href = authUrlWithDialog;
    } catch {
      const authUrlWithDialog = `${SPOTIFY_AUTH_URL}&show_dialog=true`;
      window.location.href = authUrlWithDialog;
    }
  };

  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showPreview, setShowPreview] = useState(true);

  if (authenticated) {
    return <Player previewMode={false} />;
  }

  return (
    <div className="min-h-screen w-full text-white relative overflow-hidden bg-black">
      <div className={`absolute inset-0 ${showPreview ? 'pointer-events-none' : 'pointer-events-auto'}`}>
        <div className="w-full h-full">
            <div className={`${showPreview ? 'filter blur-sm opacity-90' : 'filter blur-0 opacity-100'} scale-100`}>
            <Player previewMode={showPreview ? true : false} />
          </div>
        </div>
      </div>

      <div className="relative z-20 flex items-center justify-center min-h-screen p-4">
        <div className="bg-black/30 backdrop-blur-sm rounded-xl p-6 max-w-lg w-full border border-white/10 text-center shadow-lg">
          <h2 className="text-2xl font-semibold text-white mb-2">Preview</h2>
          <p className="text-sm text-gray-300 mb-4">Explore the app preview before signing in.</p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => setShowLoginModal(true)}
              className="px-6 py-2 bg-green-500 text-white rounded-full font-medium hover:bg-green-600 transition-colors"
            >
              Sign in
            </button>
            <button
              onClick={() => setShowPreview(false)}
              className="px-6 py-2 bg-white/10 text-white rounded-full hover:bg-white/20 transition-colors"
            >
              Continue preview
            </button>
          </div>
          <p className="text-xs text-gray-400 mt-4">You can sign in to enable playback controls and personalization.</p>
        </div>
      </div>

      {showLoginModal && (
        <div className="fixed inset-0 z-30 bg-black/60 flex items-center justify-center p-4" onClick={() => setShowLoginModal(false)}>
          <div className="relative z-40 bg-gray-900/95 backdrop-blur-md rounded-2xl p-8 max-w-md w-full border border-gray-700/50 text-center" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-3xl font-bold mb-2 text-white">Welcome to</h2>
            <h1 className="text-4xl font-bold mb-4 bg-gradient-to-r from-green-400 to-blue-500 bg-clip-text text-transparent">Spotify Gestures</h1>
            <p className="text-gray-300 mb-6 text-lg">Control Your Music with a Wave of Your Hand</p>
            <div className="space-y-3 mb-6">
              <div className="flex items-center justify-center space-x-2 text-gray-300">
                <Hand className="text-green-400" size={20} />
                <span>Gesture Control</span>
              </div>
              <div className="flex items-center justify-center space-x-2 text-gray-300">
                <Palette className="text-green-400" size={20} />
                <span>Dynamic Theming</span>
              </div>
              <div className="flex items-center justify-center space-x-2 text-gray-300">
                <Star className="text-green-400" size={20} />
                <span>AI Recommendations</span>
              </div>
            </div>
            <button
              onClick={handleLogin}
              disabled={isLoading}
              className="bg-green-500 text-white px-8 py-4 rounded-full font-bold text-lg hover:bg-green-600 transition-all duration-300 shadow-lg w-full"
            >
              {isLoading ? 'Connecting...' : 'Login with Spotify'}
            </button>
            <p className="text-sm text-gray-500 mt-4">Login to access all features and start controlling your music</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default AuthOrPlayer;
