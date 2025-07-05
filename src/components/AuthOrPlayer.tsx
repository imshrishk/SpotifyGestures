import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Music, Hand, Palette, Star, X } from 'lucide-react';
import { SPOTIFY_AUTH_URL } from '../lib/spotify';
import useSpotifyStore from '../stores/useSpotifyStore';
import Player from '../pages/Player';

const AuthOrPlayer: React.FC = () => {
  const { token, user, clearSession, isAuthenticated } = useSpotifyStore();
  const [isLoading, setIsLoading] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(!isAuthenticated());

  // Hide login modal when user successfully logs in
  React.useEffect(() => {
    if (isAuthenticated()) {
      setShowLoginModal(false);
    }
  }, [isAuthenticated]);

  const handleLogin = () => {
    setIsLoading(true);
    const authUrlWithDialog = `${SPOTIFY_AUTH_URL}&show_dialog=true`;
    window.location.href = authUrlWithDialog;
  };

  const handleCloseModal = () => {
    setShowLoginModal(false);
  };

  // Always render the Player component to show the interface
  return (
    <>
      <Player />
      
      {/* Login Modal Overlay */}
      <AnimatePresence>
        {showLoginModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="bg-gray-900/95 backdrop-blur-md rounded-2xl p-8 max-w-md w-full border border-gray-700/50 relative"
            >
              {/* Close button */}
              <button
                onClick={handleCloseModal}
                className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
              >
                <X size={24} />
              </button>

              <div className="text-center">
                <motion.div
                  initial={{ y: -20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.1 }}
                >
                  <h2 className="text-3xl font-bold mb-2 text-white">Welcome to</h2>
                  <h1 className="text-4xl font-bold mb-4 bg-gradient-to-r from-green-400 to-blue-500 bg-clip-text text-transparent">
                    Spotify Gestures
                  </h1>
                </motion.div>

                <motion.p
                  initial={{ y: -20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.2 }}
                  className="text-gray-300 mb-6 text-lg"
                >
                  Control Your Music with a Wave of Your Hand
                </motion.p>

                <motion.div
                  initial={{ y: -20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.3 }}
                  className="space-y-3 mb-6"
                >
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
                </motion.div>

                <motion.div
                  initial={{ y: -20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.4 }}
                >
                  <button
                    onClick={handleLogin}
                    disabled={isLoading}
                    className="bg-green-500 text-white px-8 py-4 rounded-full font-bold text-lg hover:bg-green-600 transition-all duration-300 shadow-lg w-full"
                  >
                    {isLoading ? 'Connecting...' : 'Login with Spotify'}
                  </button>
                </motion.div>

                <motion.p
                  initial={{ y: -20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.5 }}
                  className="text-sm text-gray-500 mt-4"
                >
                  Login to access all features and start controlling your music
                </motion.p>

                {/* Demo Preview */}
                <motion.div
                  initial={{ y: -20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.6 }}
                  className="mt-6 p-4 bg-gray-800/50 rounded-lg border border-gray-700/50"
                >
                  <h4 className="text-white font-semibold mb-3 text-center">App Preview</h4>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="flex items-center space-x-2 text-gray-300">
                      <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                      <span>Real-time playback</span>
                    </div>
                    <div className="flex items-center space-x-2 text-gray-300">
                      <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>
                      <span>Gesture controls</span>
                    </div>
                    <div className="flex items-center space-x-2 text-gray-300">
                      <div className="w-2 h-2 bg-purple-400 rounded-full animate-pulse"></div>
                      <span>AI recommendations</span>
                    </div>
                    <div className="flex items-center space-x-2 text-gray-300">
                      <div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse"></div>
                      <span>Dynamic themes</span>
                    </div>
                  </div>
                </motion.div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default AuthOrPlayer;
