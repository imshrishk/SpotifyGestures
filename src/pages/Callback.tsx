import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { authCreds } from '../lib/authCreds';
import { setAccessToken, getCurrentUser, getCurrentTrack, getQueue } from '../lib/spotify';
import useSpotifyStore from '../stores/useSpotifyStore';
import { Loader2 } from 'lucide-react';

const Callback: React.FC = () => {
  const navigate = useNavigate();
  const { setToken, setUser, setError, setCurrentTrack, setQueue } = useSpotifyStore();

  useEffect(() => {
    const initializeSession = async () => {
      try {
        // Diagnostics: log full URL and stored verifier for debugging
        console.log('[Callback] URL:', window.location.href);
        console.log('[Callback] search:', window.location.search);
        console.log('[Callback] hash:', window.location.hash);
        console.log('[Callback] pkce_code_verifier (before):', localStorage.getItem('pkce_code_verifier'));
        // Get code and state from query params
        const params = new URLSearchParams(window.location.search);
        const code = params.get('code');
        const state = params.get('state');
        const errorParam = params.get('error');

        if (errorParam) {
          throw new Error(errorParam);
        }
        // If no authorization code in the query, try to parse implicit-flow hash
        // (development fallback: some flows may return access_token in hash)
        if (!code) {
          // try parse hash for access_token or code
          const hash = window.location.hash.replace(/^#/, '');
          const hashParams = new URLSearchParams(hash);
          const implicitToken = hashParams.get('access_token');
          const implicitExpires = hashParams.get('expires_in');
          const implicitError = hashParams.get('error');
          if (implicitError) {
            throw new Error(implicitError);
          }
          if (implicitToken) {
            // We received an implicit token — use it as a development fallback
            console.warn('[Callback] Received implicit access_token in hash — using fallback flow.');
            setToken(implicitToken);
            const expires = implicitExpires ? parseInt(implicitExpires, 10) : undefined;
            // store without refresh token (implicit flow)
            setAccessToken(implicitToken, expires, undefined as unknown as string);
            localStorage.removeItem('pkce_code_verifier');

            // fetch user and persist snapshot similar to code flow
            const spotifyUser = await getCurrentUser();
            const user = {
              id: spotifyUser.id,
              display_name: spotifyUser.display_name || 'Spotify User',
              images: spotifyUser.images,
              followers: spotifyUser.followers,
              product: spotifyUser.product,
            };
            setUser(user);
            try {
              const tokenExpiry = parseInt(localStorage.getItem('spotify_token_expires_at') || '0') || null;
              const persistedState = {
                token: implicitToken,
                user,
                refreshToken: null,
                tokenExpiry,
                currentTrack: null,
                currentPlaylist: null,
                queue: [],
                isPlaying: false,
                volume: 50,
                error: null,
                progress_ms: null,
                audioFeatures: null,
                audioAnalysis: null,
              };
              localStorage.setItem('spotify-storage', JSON.stringify(persistedState));
            } catch (e) {
              console.warn('Failed to write persisted spotify-storage snapshot (implicit):', e);
            }

            // Clean up URL and navigate home
            if (window.location.hash) {
              window.history.replaceState({}, document.title, window.location.pathname);
            }
            setTimeout(() => navigate('/'), 100);
            return;
          }
          // No code and no implicit token -> explicit error
          throw new Error('No authorization code found');
        }
        if (state !== authCreds.state) {
          throw new Error('Invalid state parameter');
        }

        // Get code_verifier from localStorage
        const codeVerifier = localStorage.getItem('pkce_code_verifier');
        console.log('[Callback] Retrieved code_verifier:', codeVerifier ? 'Found' : 'Not found');
        if (!codeVerifier) {
          console.error('[Callback] PKCE code verifier missing. Available localStorage keys:', Object.keys(localStorage));
          throw new Error('PKCE code verifier not found. Please try logging in again.');
        }

        // Guard: ensure we only try to exchange this exact code once. React
        // StrictMode can double-invoke effects in dev which causes the code to
        // be consumed and the second attempt to fail with invalid_grant.
        const exchangeKey = `spotify_exchanging_${code}`;
        const exchangedKey = `spotify_exchanged_${code}`;
        if (sessionStorage.getItem(exchangedKey)) {
          console.warn('[Callback] Authorization code already exchanged for this code — skipping exchange.');
          // Clean up and navigate home (session should be set by first exchange)
          localStorage.removeItem('pkce_code_verifier');
          setTimeout(() => navigate('/'), 100);
          return;
        }
        if (sessionStorage.getItem(exchangeKey)) {
          console.warn('[Callback] Token exchange already in progress for this code — skipping duplicate attempt.');
          return;
        }

        // Mark as exchanging to prevent duplicate attempts
        try {
          sessionStorage.setItem(exchangeKey, '1');
        } catch (e) {
          console.warn('[Callback] Failed to set exchange guard in sessionStorage', e);
        }

        // Exchange code for tokens
        const body = new URLSearchParams({
          client_id: authCreds.client_id,
          grant_type: 'authorization_code',
          code,
          redirect_uri: authCreds.redirect_uri,
          code_verifier: codeVerifier,
        });
        // Diagnostic logs to detect redirect_uri mismatches
        console.log('[Callback] authCreds.redirect_uri:', authCreds.redirect_uri);
        console.log('[Callback] window.location.origin:', window.location.origin);
        console.log('[Callback] token request body:', body.toString().slice(0, 1000));
        const response = await fetch(authCreds.token_endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: body.toString(),
        });
        let data = await response.json().catch(() => ({}));
        if (!response.ok) {
          console.warn('[Callback] Token endpoint returned', response.status, data);
          // Retry once using the current origin as redirect_uri (handles localhost vs 127.0.0.1 disparities)
          try {
            const altRedirect = `${window.location.origin}/callback`;
            if (altRedirect !== authCreds.redirect_uri) {
              console.log('[Callback] Retrying token exchange with alt redirect_uri:', altRedirect);
              const altBody = new URLSearchParams({
                client_id: authCreds.client_id,
                grant_type: 'authorization_code',
                code,
                redirect_uri: altRedirect,
                code_verifier: codeVerifier,
              });
              const retryResp = await fetch(authCreds.token_endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: altBody.toString(),
              });
              data = await retryResp.json().catch(() => ({}));
              if (retryResp.ok) {
                console.log('[Callback] Token exchange succeeded on retry with alt redirect.');
                // Indicate success for the retry below by overwriting data
                data = await retryResp.json().catch(() => ({}));
              } else {
                console.warn('[Callback] Retry failed:', retryResp.status, data);
              }
            }
          } catch (retryErr) {
            console.error('[Callback] Token exchange retry error:', retryErr);
          }
        }
        if (!response.ok && (!data || !data.access_token)) {
          // If we get invalid_grant it is almost always because the code
          // was already consumed or invalid; provide a clearer message and
          // ensure our exchanging guard is cleared so users can reattempt.
          const errMsg = data?.error_description || data?.error || 'Failed to exchange code for token';
          console.error('[Callback] Token exchange failed:', errMsg);
          // Clear exchanging flag so user can try again if needed
          try { sessionStorage.removeItem(exchangeKey); } catch (e) { console.debug('[Callback] clear exchange guard failed', e); }
          if (data?.error === 'invalid_grant') {
            throw new Error('Invalid authorization code. The code may have been used already or expired. Please try logging in again.');
          }
          throw new Error(errMsg);
        }

        const { access_token, refresh_token, expires_in } = data;
        if (!access_token) {
          throw new Error('No access token received');
        }

        // Store tokens in both the store and low-level localStorage
        setToken(access_token);
        setAccessToken(access_token, expires_in, refresh_token);
        localStorage.removeItem('pkce_code_verifier');
        // Mark this code as exchanged so duplicate attempts skip
        try {
          sessionStorage.setItem(exchangedKey, '1');
        } catch (e) {
          console.warn('[Callback] Failed to set exchanged flag in sessionStorage', e);
        }

        // Get and store user data
        const spotifyUser = await getCurrentUser();
        const user = {
          id: spotifyUser.id,
          display_name: spotifyUser.display_name || 'Spotify User',
          images: spotifyUser.images,
          followers: spotifyUser.followers,
          product: spotifyUser.product,
        };
        setUser(user);

  // After user is set, also persist a snapshot for zustand so rehydration
        // will include both token and user (prevents instant redirect back to login)
        try {
          const tokenExpiry = parseInt(localStorage.getItem('spotify_token_expires_at') || '0') || null;
          const persistedState = {
            token: access_token,
            user,
            refreshToken: refresh_token || null,
            tokenExpiry,
            currentTrack: null,
            currentPlaylist: null,
            queue: [],
            isPlaying: false,
            volume: 50,
            error: null,
            progress_ms: null,
            audioFeatures: null,
            audioAnalysis: null,
          };
          localStorage.setItem('spotify-storage', JSON.stringify(persistedState));
        } catch (e) {
          console.warn('Failed to write persisted spotify-storage snapshot:', e);
        }

        // Try to prefetch current playback and queue so the player populates immediately
        try {
          const [playback, queueResp] = await Promise.allSettled([getCurrentTrack(), getQueue()]);
          if (playback.status === 'fulfilled' && playback.value?.item) {
            setCurrentTrack(playback.value.item);
            if (queueResp.status === 'fulfilled') {
              setQueue(queueResp.value?.queue || []);
            } else {
              setQueue([]);
            }
          }
        } catch (e) {
          // non-fatal: just continue to navigation
          console.warn('Prefetch playback/queue failed:', e);
        }

        // Clean up URL
        if (window.location.search) {
          window.history.replaceState({}, document.title, window.location.pathname);
        }

        setTimeout(() => {
          navigate('/');
        }, 100);
      } catch (error) {
        console.error('Auth error:', error);
  localStorage.removeItem('spotify_token');
  localStorage.removeItem('spotify_token_expires_at');
  localStorage.removeItem('spotify_user');
  localStorage.removeItem('pkce_code_verifier');
        // Ensure exchange guard is cleared on fatal failure so the user
        // can retry the flow.
  try { sessionStorage.removeItem(`spotify_exchanging_${new URLSearchParams(window.location.search).get('code')}`); } catch (e) { console.debug('[Callback] clear exchange guard failed', e); }
        setError(error instanceof Error ? error.message : 'Failed to authenticate with Spotify');
        navigate('/');
      }
    };
    initializeSession();
  }, [navigate, setToken, setUser, setError, setCurrentTrack, setQueue]);

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
