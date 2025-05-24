import React from 'react';
import { motion } from 'framer-motion';
import { Music, ArrowRight, Sparkles } from 'lucide-react';

const SPOTIFY_AUTH_URL = `https://accounts.spotify.com/authorize?client_id=${import.meta.env.VITE_SPOTIFY_CLIENT_ID}&response_type=token&redirect_uri=${encodeURIComponent(import.meta.env.VITE_REDIRECT_URI || 'http://localhost:3000/callback')}&scope=user-read-private%20user-read-email%20user-modify-playback-state%20user-read-playback-state%20user-read-recently-played%20streaming%20user-read-currently-playing`;

const Login: React.FC = () => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#0a0a0a] to-[#1a1a1a] p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full bg-[#121212] rounded-xl p-8 text-center shadow-2xl border border-[#2a2a2a]"
      >
        <motion.div
          initial={{ scale: 0.8 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2 }}
          className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-r from-[#1DB954] to-[#1ed760] flex items-center justify-center shadow-lg"
        >
          <Music className="w-10 h-10 text-white" />
        </motion.div>
        
        <div className="flex items-center justify-center mb-2">
          <Sparkles className="w-5 h-5 text-[#1DB954] mr-2" />
          <h1 className="text-3xl font-bold text-white">
            Spotify Gestures
          </h1>
        </div>
        
        <p className="text-[#a0a0a0] mb-8 text-lg">
          Control your Spotify playback with hand gestures. Connect your Spotify account to get started.
        </p>
        
        <motion.button
          onClick={() => window.location.href = SPOTIFY_AUTH_URL}
          className="group relative w-full bg-gradient-to-r from-[#1DB954] to-[#1ed760] text-white font-bold py-4 px-8 rounded-lg hover:shadow-lg transition-all duration-300 flex items-center justify-center"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <span className="mr-2">Connect with Spotify</span>
          <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform duration-300" />
          <div className="absolute inset-0 rounded-lg bg-white opacity-0 group-hover:opacity-10 transition-opacity duration-300"></div>
        </motion.button>
        
        <div className="mt-8 text-sm text-[#707070]">
          <p>By connecting, you agree to our Terms of Service and Privacy Policy</p>
        </div>
      </motion.div>
    </div>
  );
};

export default Login; 