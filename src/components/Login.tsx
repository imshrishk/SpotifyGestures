import React from 'react';
import { motion } from 'framer-motion';
import { Music, ArrowRight, Sparkles } from 'lucide-react';

import { authCreds, generateCodeVerifier, generateCodeChallenge } from '../lib/authCreds';

const buildPkceAuthUrl = async () => {
  const codeVerifier = generateCodeVerifier();
  localStorage.setItem('pkce_code_verifier', codeVerifier);
  const codeChallenge = await generateCodeChallenge(codeVerifier);
  const params = new URLSearchParams({
    client_id: authCreds.client_id || import.meta.env.VITE_SPOTIFY_CLIENT_ID || '',
    response_type: 'code',
    redirect_uri: authCreds.redirect_uri || encodeURIComponent(import.meta.env.VITE_REDIRECT_URI || 'http://localhost:3000/callback'),
    code_challenge_method: 'S256',
    code_challenge: codeChallenge,
    state: authCreds.state,
    scope: authCreds.scope,
    show_dialog: 'true'
  });
  return `${authCreds.auth_endpoint}?${params.toString()}`;
};

const Login: React.FC = () => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#0a0a0a] to-[#1a1a1a] p-4 relative overflow-hidden">
      <div className="absolute inset-0 flex items-center justify-center opacity-30 pointer-events-none">
        <div className="grid grid-cols-3 gap-4 max-w-5xl w-full px-8">
          <div className="h-40 rounded-lg bg-gradient-to-br from-[#1DB954] to-[#1ed760]/30 blur-sm transform rotate-1" />
          <div className="h-40 rounded-lg bg-gradient-to-br from-[#4ade80] to-[#60a5fa]/30 blur-sm -translate-y-2" />
          <div className="h-40 rounded-lg bg-gradient-to-br from-[#60a5fa] to-[#7c3aed]/30 blur-sm translate-y-2" />
        </div>
      </div>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full bg-[#121212] rounded-xl p-8 text-center shadow-2xl border border-[#2a2a2a] relative z-10"
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
          <h1 className="text-3xl font-bold text-white">Spotify Gestures</h1>
        </div>

        <p className="text-[#a0a0a0] mb-8 text-lg">Control your Spotify playback with hand gestures. Connect your Spotify account to get started.</p>

        <motion.button
          onClick={async () => { const url = await buildPkceAuthUrl(); window.location.href = url; }}
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