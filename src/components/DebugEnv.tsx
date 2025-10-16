import React from 'react';
import { authCreds, generateCodeVerifier, generateCodeChallenge } from '../lib/authCreds';

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

  // Build an informational URL (not used for redirect when using PKCE)
  const infoUrl = `https://accounts.spotify.com/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scopes)}&response_type=code`;

  const handleForceLoginPKCE = async () => {
    try {
      // Generate PKCE verifier & challenge and store verifier before redirect
      const codeVerifier = generateCodeVerifier();
      localStorage.setItem('pkce_code_verifier', codeVerifier);
      const codeChallenge = await generateCodeChallenge(codeVerifier);

      const params = new URLSearchParams({
        client_id: authCreds.client_id || clientId || '',
        response_type: 'code',
        redirect_uri: authCreds.redirect_uri || redirectUri || '',
        code_challenge_method: 'S256',
        code_challenge: codeChallenge,
        state: authCreds.state || 'spotify-auth',
        scope: authCreds.scope || scopes,
        show_dialog: 'true',
      });

      window.location.href = `${authCreds.auth_endpoint}?${params.toString()}`;
    } catch (e) {
      console.error('Failed to initiate PKCE login from DebugEnv:', e);
      // Fall back to instructing the user to use the normal Login button
      alert('Failed to start PKCE login. Use the in-app Login button instead.');
    }
  };

  return (
    <div className="p-4 bg-gray-800 text-white rounded-lg mt-4">
      <h3 className="text-lg font-bold mb-2">Debug Environment Variables</h3>
      <div className="space-y-2">
        <p><strong>Client ID:</strong> {clientId || 'Not set'}</p>
        <p><strong>Redirect URI:</strong> {redirectUri || 'Not set'}</p>
        <p><strong>Auth (PKCE) example:</strong> {infoUrl}</p>
        <p><strong>Current Path:</strong> {window.location.pathname}</p>
        <p><strong>Hash:</strong> {window.location.hash || 'No hash'}</p>
        <button 
          onClick={handleForceLoginPKCE}
          className="mt-2 px-3 py-1 bg-blue-600 text-white rounded text-sm"
        >
          Force PKCE Login
        </button>
      </div>
    </div>
  );
};

export default DebugEnv;