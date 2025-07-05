import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Hand, Palette, Star } from 'lucide-react';
import { SPOTIFY_AUTH_URL } from '../lib/spotify';
import useSpotifyStore from '../stores/useSpotifyStore';

const Login: React.FC = () => {
  const [isLoading, setIsLoading] = useState(false);
  const { clearSession } = useSpotifyStore();
  const navigate = useNavigate();

  useEffect(() => {
    // Check if the user is already authenticated and redirect if so
    // This prevents clearing session on every visit to login page
    const storedToken = localStorage.getItem('spotify_token');
    const storedTokenExpiresAt = localStorage.getItem('spotify_token_expires_at');
    const storedUser = localStorage.getItem('spotify_user');

    if (storedToken && storedTokenExpiresAt && new Date().getTime() < parseInt(storedTokenExpiresAt) && storedUser) {
      // If authenticated, redirect to home or player page
      navigate('/'); // Assuming '/' is the main authenticated route
    } else {
      // Only clear session if no valid token is found, ensuring a clean slate for new login
      clearSession();
    }
  }, [clearSession]);

  const handleLogin = () => {
    setIsLoading(true);
    const authUrlWithDialog = `${SPOTIFY_AUTH_URL}&show_dialog=true`;
    window.location.href = authUrlWithDialog;
  };

  return (
    <div className="min-h-screen w-full bg-gray-900 text-white flex flex-col items-center justify-center p-4 overflow-hidden">
      <motion.div
        initial={{ opacity: 0, y: -100 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
        className="text-center z-10"
      >
        <h1 className="text-5xl md:text-7xl font-bold mb-4">Spotify Gestures</h1>
        <p className="text-lg md:text-xl text-gray-300 mb-8">
          Control Your Music with a Wave of Your Hand.
        </p>
        <motion.div
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <button
            onClick={handleLogin}
            disabled={isLoading}
            className="bg-green-500 text-white px-8 py-4 rounded-full font-bold text-lg hover:bg-green-600 transition-all duration-300 shadow-lg"
          >
            {isLoading ? 'Connecting...' : 'Login with Spotify'}
          </button>
        </motion.div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5, duration: 1 }}
        className="absolute bottom-10 w-full flex justify-center items-center space-x-8 z-10"
      >
        <div className="flex items-center space-x-2">
          <Hand className="text-green-400" />
          <span>Gesture Control</span>
        </div>
        <div className="flex items-center space-x-2">
          <Palette className="text-green-400" />
          <span>Dynamic Theming</span>
        </div>
        <div className="flex items-center space-x-2">
          <Star className="text-green-400" />
          <span>AI Recommendations</span>
        </div>
      </motion.div>

      {/* Animated background */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0">
        {[...Array(20)].map((_, i) => (
          <motion.div
            key={i}
            initial={{
              x: Math.random() * 100 + 'vw',
              y: Math.random() * 100 + 'vh',
              scale: Math.random() * 1.5 + 0.5,
              opacity: 0,
            }}
            animate={{
              opacity: [0, 0.1, 0],
            }}
            transition={{
              duration: Math.random() * 10 + 5,
              repeat: Infinity,
              repeatType: 'loop',
              delay: Math.random() * 5,
            }}
            className="absolute rounded-full bg-green-500/10"
            style={{
              width: Math.random() * 200 + 100,
              height: Math.random() * 200 + 100,
            }}
          />
        ))}
      </div>
    </div>
  );
};

export default Login;
