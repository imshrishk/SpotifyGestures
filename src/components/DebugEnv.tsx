import React from 'react';

const DebugEnv: React.FC = () => {
  const clientId = import.meta.env.VITE_SPOTIFY_CLIENT_ID;
  const redirectUri = import.meta.env.VITE_REDIRECT_URI;
  const scopes = [
    'user-read-private',
    'user-read-email',
    'user-modify-playback-state',
    'user-read-playback-position',
    'user-library-read',
    'user-library-modify',
    'user-read-playback-state',
    'user-read-currently-playing',
    'user-read-recently-played',
    'user-top-read',
    'playlist-modify-public',
    'playlist-modify-private'
  ].join(' ');
  
  const authUrl = `https://accounts.spotify.com/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scopes)}&response_type=token&show_dialog=true`;

  return (
    <div className="p-4 bg-gray-800 text-white rounded-lg mt-4">
      <h3 className="text-lg font-bold mb-2">Debug Environment Variables</h3>
      <div className="space-y-2">
        <p><strong>Client ID:</strong> {clientId || 'Not set'}</p>
        <p><strong>Redirect URI:</strong> {redirectUri || 'Not set'}</p>
        <p><strong>Auth URL:</strong> {authUrl}</p>
        <p><strong>Current Path:</strong> {window.location.pathname}</p>
        <p><strong>Hash:</strong> {window.location.hash || 'No hash'}</p>
        <button 
          onClick={() => window.location.href = authUrl}
          className="mt-2 px-3 py-1 bg-blue-600 text-white rounded text-sm"
        >
          Force Login
        </button>
      </div>
    </div>
  );
};

export default DebugEnv; 