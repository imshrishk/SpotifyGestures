import React from 'react';
import { Music } from 'lucide-react';
import { SPOTIFY_AUTH_URL } from '../lib/spotify';

const Login: React.FC = () => {
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

        <a
          href={SPOTIFY_AUTH_URL}
          className="inline-block bg-green-500 text-white px-8 py-3 rounded-full font-semibold hover:bg-green-600 transition-colors"
        >
          Connect with Spotify
        </a>
      </div>
    </div>
  );
};

export default Login;