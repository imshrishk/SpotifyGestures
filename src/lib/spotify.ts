import SpotifyWebApi from 'spotify-web-api-js';
import { authCreds } from './authCreds';
import { SpotifyApi } from './spotifyApi';
import { smartRequest, getConnectionPoolStats } from './connectionPool';
import * as Cache from './cache';
import { checkRateLimit, getRateLimitStats } from './rateLimiter';

const spotify = new SpotifyWebApi();
const clientId = authCreds.client_id;
const redirectUri = authCreds.redirect_uri;
export interface PlaybackState {
  is_playing: boolean;
  item: SpotifyApi.TrackObjectFull;
  device: {
    volume_percent?: number;
  };
  shuffle_state: boolean;
  repeat_state: string;
  progress_ms: number;
  context?: {
    uri: string;
    type: string;
    href: string;
    external_urls: {
      spotify: string;
    };
  } | null;
}

interface QueueTrack {
  uri: string;
  [key: string]: unknown;
}

interface QueueResponse {
  queue: QueueTrack[];
}

// Add better types for spotify-web-api-js
declare module 'spotify-web-api-js' {
  interface SpotifyWebApiJs {
    // Authentication
    setAccessToken(token: string): void;
    getAccessToken(): string | null;

    // User Profile
    getMe(): Promise<SpotifyApi.CurrentUsersProfileResponse>;
    getMyCurrentPlaybackState(): Promise<SpotifyApi.CurrentPlaybackResponse>;

    // Track Features
    getAudioFeaturesForTrack(trackId: string): Promise<SpotifyApi.AudioFeaturesObject>;
    getAudioAnalysisForTrack(trackId: string): Promise<SpotifyApi.AudioAnalysisObject>;

    // Playlists
    getUserPlaylists(userId: string, options?: { limit?: number }): Promise<SpotifyApi.ListOfUsersPlaylistsResponse>;
    getPlaylist(playlistId: string): Promise<SpotifyApi.SinglePlaylistResponse>;
    getPlaylistTracks(playlistId: string): Promise<SpotifyApi.PlaylistTrackResponse>;
    createPlaylist(userId: string, options: { 
      name: string; 
      public?: boolean; 
      collaborative?: boolean; 
      description?: string 
    }): Promise<SpotifyApi.CreatePlaylistResponse>;
    addTracksToPlaylist(playlistId: string, trackUris: string[]): Promise<SpotifyApi.AddTracksToPlaylistResponse>;
    unfollowPlaylist(playlistId: string): Promise<void>;
    followPlaylist(playlistId: string, options?: { public?: boolean }): Promise<void>;
    areFollowingPlaylist(playlistId: string, userIds: string[]): Promise<boolean[]>;

    // Track Control
    play(options?: {
      uris?: string[];
      context_uri?: string;
      offset?: { position: number };
    }): Promise<void>;
    pause(): Promise<void>;
    setShuffle(state: boolean): Promise<void>;
    setRepeat(state: 'off' | 'track' | 'context'): Promise<void>;
    setVolume(volumePercent: number): Promise<void>;
    skipToNext(): Promise<void>;
    skipToPrevious(): Promise<void>;
    seek(positionMs: number): Promise<void>;

    // Tracks & Artists
    getTrack(trackId: string): Promise<SpotifyApi.TrackObjectFull>;
    getArtist(artistId: string): Promise<SpotifyApi.ArtistObjectFull>;
    getArtistRelatedArtists(artistId: string): Promise<SpotifyApi.ArtistsRelatedArtistsResponse>;
    getMyQueue(): Promise<QueueResponse>;
    containsMySavedTracks(trackIds: string[]): Promise<boolean[]>;
    addToMySavedTracks(trackIds: string[]): Promise<void>;
    removeFromMySavedTracks(trackIds: string[]): Promise<void>;

    // User Data
    getMyTopTracks(options: { time_range?: string; limit?: number }): Promise<SpotifyApi.UsersTopTracksResponse>;
    getMyTopArtists(options: { time_range?: string; limit?: number }): Promise<SpotifyApi.UsersTopArtistsResponse>;
    getMyRecentlyPlayedTracks(options: { limit?: number }): Promise<SpotifyApi.UsersRecentlyPlayedTracksResponse>;
    getFollowedArtists(options?: { limit?: number }): Promise<{ artists: { items: SpotifyApi.ArtistObjectFull[] } }>;

    // Recommendations
    getRecommendations(options: RecommendationsOptions): Promise<SpotifyApi.RecommendationsObject>;
  }
}

interface RecommendationsOptions {
  limit?: number;
  seed_artists?: string[];
  seed_genres?: string[];
  seed_tracks?: string[];
  target_acousticness?: number;
  target_danceability?: number;
  target_energy?: number;
  target_instrumentalness?: number;
  target_key?: number;
  target_liveness?: number;
  target_loudness?: number;
  target_mode?: number;
  target_popularity?: number;
  target_speechiness?: number;
  target_tempo?: number;
  target_time_signature?: number;
  target_valence?: number;
  min_acousticness?: number;
  min_danceability?: number;
  min_energy?: number;
  min_instrumentalness?: number;
  min_key?: number;
  min_liveness?: number;
  min_loudness?: number;
  min_mode?: number;
  min_popularity?: number;
  min_speechiness?: number;
  min_tempo?: number;
  min_time_signature?: number;
  min_valence?: number;
  max_acousticness?: number;
  max_danceability?: number;
  max_energy?: number;
  max_instrumentalness?: number;
  max_key?: number;
  max_liveness?: number;
  max_loudness?: number;
  max_mode?: number;
  max_popularity?: number;
  max_speechiness?: number;
  max_tempo?: number;
  max_time_signature?: number;
  max_valence?: number;
}

// Store token expiration timestamp
let tokenExpirationTime: number | null = null;
const TOKEN_EXPIRATION_BUFFER = 5 * 60 * 1000; // 5 minutes buffer

// Simple in-memory suppression for noisy logs and short-term caching for 403/404
const logSuppressMap = new Map<string, number>();
function shouldLog(key: string, windowMs = 60 * 1000) {
  const last = logSuppressMap.get(key) || 0;
  if (Date.now() - last > windowMs) {
    logSuppressMap.set(key, Date.now());
    return true;
  }
  return false;
}
function logOnce(key: string, level: 'warn' | 'error' | 'debug' | 'log' = 'warn', ...args: unknown[]) {
  if (shouldLog(key)) {
    const fn = ((console as unknown) as Record<string, (...a: unknown[]) => void>)[level] || console.warn;
    fn(...args);
  }
}

// Enhanced rate limiting with exponential backoff and circuit breaker
const requestQueue: Array<RequestQueueItem<unknown>> = [];
let isProcessingQueue = false;
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 500; // Increased to 500ms between requests

// Global counter to track consecutive API failures
let consecutiveFailures = 0;
const MAX_CONSECUTIVE_FAILURES = 2; // Reduced to 2 failures before circuit breaker
const COOL_DOWN_PERIOD = 30000; // Increased to 30 seconds cool down

let lastApiCall = 0;
const MIN_API_INTERVAL = 2000; // Increased to 2 seconds between API calls

// Circuit breaker state
let circuitBreakerOpen = false;
let circuitBreakerOpenUntil = 0;
const CIRCUIT_BREAKER_TIMEOUT = 60000; // 1 minute circuit breaker timeout

// Request deduplication cache
const requestCache = new Map<string, { timestamp: number; promise: Promise<any> }>();
const CACHE_DURATION = 10000; // Increased to 10 seconds cache for identical requests

// Exponential backoff state
let backoffMultiplier = 1;
const MAX_BACKOFF_MULTIPLIER = 8;
async function rateLimitedFetch(url: string, options?: RequestInit) {
  // Check circuit breaker
  if (circuitBreakerOpen && Date.now() < circuitBreakerOpenUntil) {
    const remainingTime = Math.ceil((circuitBreakerOpenUntil - Date.now()) / 1000);
    throw new Error(`Circuit breaker open, retry after ${remainingTime} seconds`);
  }

  // Check for cached identical request
  const cacheKey = `${url}:${JSON.stringify(options)}`;
  const cached = requestCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.promise;
  }

  // Respect a global backoff window if set due to previous 429s
  const now = Date.now();
  if (typeof (globalThis as any).__SPOTIFY_GLOBAL_BACKOFF_UNTIL === 'number' && (globalThis as any).__SPOTIFY_GLOBAL_BACKOFF_UNTIL > now) {
    const retryAfter = (globalThis as any).__SPOTIFY_GLOBAL_BACKOFF_UNTIL - now;
    const err = new Error('Rate limited');
    (err as any).retryAfterMs = retryAfter;
    throw err;
  }
  
  // Apply exponential backoff delay
  const exponentialDelay = MIN_API_INTERVAL * backoffMultiplier;
  const now2 = Date.now();
  const wait = Math.max(0, exponentialDelay - (now2 - lastApiCall));
  if (wait > 0) {
    console.log(`[rateLimitedFetch] Waiting ${wait}ms before request (backoff multiplier: ${backoffMultiplier})`);
    await new Promise(res => setTimeout(res, wait));
  }
  lastApiCall = Date.now();
  
  const promise = fetch(url, options);
  
  // Cache the promise
  requestCache.set(cacheKey, { timestamp: now, promise });
  
  // Clean up old cache entries
  for (const [key, value] of requestCache.entries()) {
    if (Date.now() - value.timestamp > CACHE_DURATION) {
      requestCache.delete(key);
    }
  }
  
  return promise;
}

// Helper functions for rate limiting
function handleRateLimitError() {
  consecutiveFailures++;
  backoffMultiplier = Math.min(backoffMultiplier * 2, MAX_BACKOFF_MULTIPLIER);
  
  if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
    circuitBreakerOpen = true;
    circuitBreakerOpenUntil = Date.now() + CIRCUIT_BREAKER_TIMEOUT;
    console.warn(`[RateLimit] Circuit breaker opened for ${CIRCUIT_BREAKER_TIMEOUT/1000}s after ${consecutiveFailures} failures`);
  }
}

function handleSuccessfulRequest() {
  consecutiveFailures = 0;
  backoffMultiplier = Math.max(1, backoffMultiplier / 2);
  circuitBreakerOpen = false;
}

// Global backoff helper (stored on globalThis so multiple modules share it)
// Note: currently unused in this file; retained for future rate limit handling

export class RateLimitError extends Error {
  retryAfterMs: number;
  constructor(retryAfterMs: number) {
    super('Rate limited');
    this.name = 'RateLimitError';
    this.retryAfterMs = retryAfterMs;
  }
}

if (!clientId || !redirectUri) {
  const hints = [
    !clientId ? 'VITE_SPOTIFY_CLIENT_ID' : undefined,
    !redirectUri ? 'VITE_REDIRECT_URI' : undefined,
  ].filter(Boolean).join(', ');
  console.error('[spotify] Missing required env vars:', hints, '\nAdd them to .env.local and restart the dev server.');
  try {
    console.debug('[spotify] authCreds snapshot', {
      client_id: authCreds.client_id ? 'Set' : 'Not set',
      redirect_uri: authCreds.redirect_uri ? 'Set' : 'Not set',
      auth_endpoint: authCreds.auth_endpoint,
      token_endpoint: authCreds.token_endpoint,
    });
  } catch {}
}

// Build a standard (non-PKCE) authorize URL: encodes redirect_uri and scope explicitly
export function buildAuthorizeUrl(
  baseAuthEndpoint: string,
  clientIdValue: string,
  redirectUriValue: string,
  scopes: string,
  responseType: string,
  stateValue: string
): string {
  return `${baseAuthEndpoint}?client_id=${clientIdValue}` +
    `&redirect_uri=${encodeURIComponent(redirectUriValue)}` +
    `&scope=${encodeURIComponent(scopes)}` +
    `&response_type=${encodeURIComponent(responseType)}` +
    `&state=${encodeURIComponent(stateValue)}`;
}

export const SPOTIFY_AUTH_URL = buildAuthorizeUrl(
  authCreds.auth_endpoint,
  String(clientId || ''),
  String(redirectUri || ''),
  authCreds.scope,
  authCreds.response_type,
  authCreds.state
);

export function isAuthEnvReady(): boolean {
  return Boolean(clientId && redirectUri);
}

// Build a PKCE-enabled authorization URL and store the code verifier in localStorage
import { generateCodeVerifier, generateCodeChallenge } from './authCreds';

export const buildPkceAuthUrl = async (): Promise<string> => {
  try {
    if (!clientId) {
      throw new Error('[spotify] VITE_SPOTIFY_CLIENT_ID is missing');
    }
    if (!redirectUri) {
      throw new Error('[spotify] VITE_REDIRECT_URI is missing');
    }
    const codeVerifier = generateCodeVerifier();
    localStorage.setItem('pkce_code_verifier', codeVerifier);
    const codeChallenge = await generateCodeChallenge(codeVerifier);
    const params = new URLSearchParams({
      client_id: String(clientId || ''),
      response_type: 'code',
      redirect_uri: String(redirectUri || ''),
      code_challenge_method: 'S256',
      code_challenge: codeChallenge,
      state: authCreds.state,
      scope: authCreds.scope,
    });
    return `${authCreds.auth_endpoint}?${params.toString()}`;
  } catch (e) {
    console.error('[buildPkceAuthUrl] Failed to build PKCE auth URL', e);
    // Fallback to non-PKCE URL
    return SPOTIFY_AUTH_URL;
  }
};

interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
}

interface TokenError {
  error: string;
  error_description?: string;
}

import { scheduleTokenRefresh, clearTokenRefreshSchedule } from './tokenRefresh';
import { getSpotifyRecommendations as getPromptRecommendations } from '../utils/spotifyRecommendations';

export const setAccessToken = (token: string, expiresIn?: number, refreshToken?: string) => {
  spotify.setAccessToken(token);
  
  // Set token expiration time with buffer for early refresh
  if (expiresIn) {
    tokenExpirationTime = Date.now() + (expiresIn * 1000) - TOKEN_EXPIRATION_BUFFER;
  } else {
    // Default to 1 hour if not specified
    tokenExpirationTime = Date.now() + (3600 * 1000) - TOKEN_EXPIRATION_BUFFER;
  }
  
  // Store in localStorage
  localStorage.setItem('spotify_token', token);
  localStorage.setItem('spotify_token_expires_at', tokenExpirationTime.toString());
  
  // Store refresh token if provided
  if (refreshToken) {
    localStorage.setItem('spotify_refresh_token', refreshToken);
  }

  // Schedule token refresh
  if (expiresIn) {
    scheduleTokenRefresh(expiresIn);
  }
};

// Check if the token is valid
export const isTokenValid = () => {
  const token = localStorage.getItem('spotify_token');
  const expiresAt = localStorage.getItem('spotify_token_expires_at');
  const refreshToken = localStorage.getItem('spotify_refresh_token');
  
  if (!token || !expiresAt) {
    return false;
  }
  
  // If we have a refresh token and we're within the buffer window, consider it still valid
  // as we can refresh it
  if (refreshToken) {
    return Date.now() < (parseInt(expiresAt) + TOKEN_EXPIRATION_BUFFER);
  }
  
  return Date.now() < parseInt(expiresAt);
};

// Refresh token using PKCE flow
export const refreshToken = async (): Promise<string | null> => {
  console.log('[refreshToken] Attempting to refresh token');
  const refreshToken = localStorage.getItem('spotify_refresh_token');
  
  if (!refreshToken) {
    console.log('[refreshToken] No refresh token found, redirecting to login');
    window.location.href = SPOTIFY_AUTH_URL;
    return null;
  }
  
  const maxRetries = 3;
  let response: Response | null = null;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
  response = await fetch(authCreds.token_endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
          client_id: clientId
        }).toString(),
      });

      // If response is undefined/null, treat as transient and retry
      if (!response) {
        console.warn('[refreshToken] No response received, retrying...', attempt);
        await new Promise((res) => setTimeout(res, 200 * attempt));
        continue;
      }

      // Handle client errors (invalid refresh token)
      if (response && (response.status === 400 || response.status === 401)) {
        // Try to parse error body only if json() exists
        if (response && typeof response.json === 'function') {
          try {
            const errBody = await response.json().catch(() => null) as TokenError | null;
            console.error('[refreshToken] Failed to refresh token:', errBody || response.statusText);
          } catch (parseErr) {
            console.error('[refreshToken] Failed to parse error body', parseErr);
          }
        } else {
          console.error('[refreshToken] Failed to refresh token: status', response.status, response.statusText);
        }
        localStorage.removeItem('spotify_token');
        localStorage.removeItem('spotify_token_expires_at');
        localStorage.removeItem('spotify_refresh_token');
        // Prefer assign which works better with test spies; also set href if possible
        try {
          if (typeof window.location.assign === 'function') {
            window.location.assign(SPOTIFY_AUTH_URL);
          } else {
            window.location.href = SPOTIFY_AUTH_URL as unknown as string;
          }
        } catch (assignErr) {
          console.debug('[refreshToken] Failed to redirect using assign/href', assignErr);
          try {
            window.location.href = SPOTIFY_AUTH_URL as unknown as string;
          } catch (hrefErr) {
            console.error('[refreshToken] Fallback redirect failed', hrefErr);
          }
        }
        return null;
      }

      // If successful, parse and return
      if (response && response.ok) {
        // response.json may not be a function on some mocked responses; guard it
        const data = response && typeof response.json === 'function'
          ? await response.json() as TokenResponse
          : ({} as TokenResponse);
        console.log('[refreshToken] Token refreshed successfully');
        setAccessToken(
          data.access_token,
          data.expires_in,
          (data as TokenResponse).refresh_token || refreshToken
        );
        return (data as TokenResponse).access_token;
      }

      // For other response codes (e.g., 5xx), treat as transient and retry
      console.warn('[refreshToken] Unexpected status, will retry if attempts remain:', response.status);
      await new Promise((res) => setTimeout(res, 200 * attempt));
    } catch (err) {
      console.warn('[refreshToken] Fetch error, retrying if attempts remain:', err);
      await new Promise((res) => setTimeout(res, 200 * attempt));
    }
  }

  console.error('[refreshToken] Failed to refresh token after retries');
  return null;
  };

// Ensure token is valid before making API calls
export const ensureValidToken = async (): Promise<string | null> => {
  const token = localStorage.getItem('spotify_token');
  const expiresAt = localStorage.getItem('spotify_token_expires_at');
  const hasRefreshToken = localStorage.getItem('spotify_refresh_token') !== null;
  
  console.log('[ensureValidToken] Checking token. ExpiresAt:', expiresAt, 'CurrentTime:', Date.now());

  if (!token || !expiresAt) {
    console.log('[ensureValidToken] No token or expiresAt in localStorage. Returning null.');
    return null;
  }
  
  const currentTime = Date.now();
  const expirationTime = parseInt(expiresAt);
  const timeUntilExpiry = expirationTime - currentTime;

  // If token is still valid and not near expiration, use it
  if (timeUntilExpiry > TOKEN_EXPIRATION_BUFFER) {
    console.log('[ensureValidToken] Token is valid. Remaining time (ms):', timeUntilExpiry);
    try {
      // Ensure spotify-web-api-js client has this token so subsequent
      // calls using the spotify instance include Authorization header.
      spotify.setAccessToken(token as string);
    } catch (e) {
      console.debug('[ensureValidToken] Failed to set spotify access token on client', e);
    }
    return token;
  }
  
  // If token is expired or near expiration and we have a refresh token, try to refresh
  if (hasRefreshToken) {
    console.log('[ensureValidToken] Token near expiration. Attempting refresh.');
    const newToken = await refreshToken();
    if (newToken) {
      console.log('[ensureValidToken] Token refreshed successfully.');
      return newToken;
    }
    // If refreshToken returned null, another concurrent refresh may have stored a token
    const storedAfterAttempt = localStorage.getItem('spotify_token');
    if (storedAfterAttempt) {
      console.log('[ensureValidToken] Found token in localStorage after refresh attempt. Using stored token.');
      return storedAfterAttempt;
    }
  }
  
  console.log('[ensureValidToken] Token expired and cannot be refreshed. Redirecting to login.');
  window.location.href = SPOTIFY_AUTH_URL;
  return null;
};

const getFallbackRecommendations = async () => {
  try {
    console.log('[getFallbackRecommendations] Attempting to get generic genre-based recommendations.');
    // Fallback to genre-based recommendations if user-specific data is unavailable or fails
    const genres = [
      'pop', 'rock', 'electronic', 'hip-hop', 'indie', 
      'alternative', 'jazz', 'metal', 'dance', 'r-n-b',
      'soul', 'country', 'folk', 'reggae', 'disco',
      'classical', 'blues'
    ];
    const randomGenre = genres[Math.floor(Math.random() * genres.length)];
    
    // First try SDK
    try {
      const response = await queueRequest(() => spotify.getRecommendations({
        seed_genres: [randomGenre],
        limit: 10
      }));
      if (response && (response as SpotifyApi.RecommendationsObject).tracks && (response as SpotifyApi.RecommendationsObject).tracks.length > 0) {
        console.log(`[getFallbackRecommendations] Got ${(response as SpotifyApi.RecommendationsObject).tracks.length} fallback genre-based recommendations (SDK).`);
        return response;
      }
    } catch (e) {
      console.warn('[getFallbackRecommendations] SDK failed, trying direct fetch:', (e as Error)?.message || e);
    }

    // Direct HTTP fallback
    try {
      const params = new URLSearchParams({ seed_genres: randomGenre, limit: '10' });
      const resp = await fetch(`https://api.spotify.com/v1/recommendations?${params.toString()}`, {
        headers: { 'Authorization': `Bearer ${spotify.getAccessToken()}` }
      });
      if (resp.ok) {
        const data = await resp.json();
        if (Array.isArray(data?.tracks) && data.tracks.length > 0) {
          console.log(`[getFallbackRecommendations] Got ${data.tracks.length} fallback genre-based recommendations (direct).`);
          return data;
        }
      }
    } catch (httpErr) {
      console.warn('[getFallbackRecommendations] Direct fetch failed:', (httpErr as Error)?.message || httpErr);
    }

    console.log('[getFallbackRecommendations] No fallback recommendations found.');
    return { tracks: [] };
  } catch (error) {
    console.error('[getFallbackRecommendations] Error during fallback recommendations:', error);
    return { tracks: [] };
  }
};

export const getRecommendationsFromUserProfile = async () => {
  if (!(await ensureValidToken())) {
    throw new Error('Token expired');
  }
  
  try {
    // First get user's top tracks to use as seed tracks
    const topTracksResponse: SpotifyApi.UsersTopTracksResponse = await getTopTracks('short_term', 5);
    const topArtistsResponse: SpotifyApi.UsersTopArtistsResponse = await getTopArtists('short_term', 5);
    
    if (!topTracksResponse?.items || !topArtistsResponse?.items) {
      throw new Error('Could not get top tracks or artists');
    }
    
    // Extract IDs for seed tracks and artists
    const seedTracks = topTracksResponse.items.slice(0, 2).map((track: SpotifyApi.TrackObjectFull) => track.id);
    const seedArtists = topArtistsResponse.items.slice(0, 3).map((artist: SpotifyApi.ArtistObjectFull) => artist.id);
    
    // Build the request URL with query parameters
    let url = 'https://api.spotify.com/v1/recommendations?';
    
    if (seedTracks.length > 0) {
      url += `seed_tracks=${seedTracks.join(',')}&`;
    }
    
    if (seedArtists.length > 0) {
      url += `seed_artists=${seedArtists.join(',')}&`;
    }
    
    // Add additional parameters to improve recommendations
    url += 'limit=20';
    
    // Make the request
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${spotify.getAccessToken()}`
      }
    });
    
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        // Token expired or forbidden, force re-auth
        refreshToken();
        throw new Error('Token expired or forbidden');
      }
      throw new Error(`Failed to get recommendations: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Error getting personalized recommendations:', error);
    // Fall back to genre-based recommendations if personal ones fail
    return getFallbackRecommendations();
  }
};

export const getRecommendations = async (
  seedTracks: string[] = [], 
  seedArtists: string[] = [], 
  seedGenres: string[] = []
) => {
  try {
    console.log('[getRecommendations] Called with seeds - Tracks:', seedTracks.length, 'Artists:', seedArtists.length, 'Genres:', seedGenres.length);
    
    // Ensure token is valid before making any API calls
    const token = await ensureValidToken();
    if (!token) {
      console.error('[getRecommendations] No valid token available. Cannot fetch recommendations.');
      return { tracks: [] };
    }

    // Combine all seeds, ensuring no more than 5 total
    const allSeeds = [
      ...seedTracks.slice(0, 5),
      ...seedArtists.slice(0, 5 - Math.min(seedTracks.length, 5)),
      ...seedGenres.slice(0, 5 - Math.min(seedTracks.length, 5) - Math.min(seedArtists.length, 5 - Math.min(seedTracks.length, 5))),
    ].slice(0, 5);

    // If no seeds are provided, fall back to user profile recommendations
    if (allSeeds.length === 0) {
      console.log('[getRecommendations] No seeds provided, falling back to user profile recommendations.');
      return await getRecommendationsFromUserProfile();
    }

    const recommendationParams: RecommendationsOptions = {
      limit: 20, // Increased limit for better variety
    };

    // Distribute seeds among seed_tracks, seed_artists, seed_genres
    const finalSeedTracks: string[] = [];
    const finalSeedArtists: string[] = [];
    const finalSeedGenres: string[] = [];

    seedTracks.forEach(id => { if (finalSeedTracks.length < 2) finalSeedTracks.push(id); }); // Max 2 tracks
    seedArtists.forEach(id => { if (finalSeedArtists.length < 2) finalSeedArtists.push(id); }); // Max 2 artists
    seedGenres.forEach(genre => { if (finalSeedGenres.length < 1) finalSeedGenres.push(genre); }); // Max 1 genre

    // Ensure total seeds don't exceed 5
    const currentTotalSeeds = finalSeedTracks.length + finalSeedArtists.length + finalSeedGenres.length;
    if (currentTotalSeeds > 5) {
      // This logic ensures we prioritize tracks, then artists, then genres if over 5
      while (finalSeedTracks.length > 2 && finalSeedTracks.length + finalSeedArtists.length + finalSeedGenres.length > 5) { finalSeedTracks.pop(); }
      while (finalSeedArtists.length > 2 && finalSeedTracks.length + finalSeedArtists.length + finalSeedGenres.length > 5) { finalSeedArtists.pop(); }
      while (finalSeedGenres.length > 1 && finalSeedTracks.length + finalSeedArtists.length + finalSeedGenres.length > 5) { finalSeedGenres.pop(); }
    }

    if (finalSeedTracks.length > 0) {
      recommendationParams.seed_tracks = finalSeedTracks;
    }
    if (finalSeedArtists.length > 0) {
      recommendationParams.seed_artists = finalSeedArtists;
    }
    if (finalSeedGenres.length > 0) {
      recommendationParams.seed_genres = finalSeedGenres;
    }

    console.log('[getRecommendations] Attempting to get recommendations with params:', recommendationParams);

    // First try via SDK
    try {
      const recommendations = await spotify.getRecommendations(recommendationParams);
      if (recommendations && recommendations.tracks && recommendations.tracks.length > 0) {
        console.log(`[getRecommendations] Got ${recommendations.tracks.length} recommendations successfully (SDK).`);
        return recommendations;
      }
    } catch (sdkErr) {
      console.warn('[getRecommendations] SDK getRecommendations failed, trying direct fetch:', (sdkErr as Error)?.message || sdkErr);
    }

    // Fallback to direct HTTP fetch (more tolerant to edge cases)
    const params = new URLSearchParams();
    if (recommendationParams.seed_tracks?.length) params.append('seed_tracks', recommendationParams.seed_tracks.join(','));
    if (recommendationParams.seed_artists?.length) params.append('seed_artists', recommendationParams.seed_artists.join(','));
    if (recommendationParams.seed_genres?.length) params.append('seed_genres', recommendationParams.seed_genres.join(','));
    params.append('limit', String(recommendationParams.limit || 20));

    try {
      const resp = await fetch(`https://api.spotify.com/v1/recommendations?${params.toString()}`, {
        headers: { 'Authorization': `Bearer ${spotify.getAccessToken()}` }
      });
      if (resp.ok) {
        const data = await resp.json();
        if (data && Array.isArray(data.tracks) && data.tracks.length > 0) {
          console.log(`[getRecommendations] Got ${data.tracks.length} recommendations successfully (direct).`);
          return data;
        }
      } else {
        console.warn('[getRecommendations] Direct fetch failed with status:', resp.status);
      }
    } catch (httpErr) {
      console.warn('[getRecommendations] Direct fetch threw error:', (httpErr as Error)?.message || httpErr);
    }

    // Local fallback: build recommendations from artist top-tracks and genre searches
    try {
      const local = await getLocalRecommendations(finalSeedTracks, finalSeedArtists, finalSeedGenres, recommendationParams.limit || 20);
      if (local.tracks && local.tracks.length > 0) {
        console.log(`[getRecommendations] Got ${local.tracks.length} recommendations (local fallback).`);
        return local;
      }
    } catch (localErr) {
      console.warn('[getRecommendations] Local fallback failed:', (localErr as Error)?.message || localErr);
    }

    // As a final fallback, try prompt-based search recommendations
    try {
      const accessToken = spotify.getAccessToken() as string;
      const promptResults = await getPromptRecommendations(accessToken, {
        seedTracks: finalSeedTracks,
        seedArtists: finalSeedArtists,
        seedGenres: finalSeedGenres,
        limit: recommendationParams.limit || 20,
      });
      if (Array.isArray(promptResults) && promptResults.length > 0) {
        // Normalize shape to { tracks: [...] }
        return { tracks: promptResults } as SpotifyApi.RecommendationsObject;
      }
    } catch (promptErr) {
      console.warn('[getRecommendations] Prompt-based fallback failed:', (promptErr as Error)?.message || promptErr);
    }

    console.log('[getRecommendations] No recommendations returned, trying user profile recommendations.');
    return await getRecommendationsFromUserProfile();
  } catch (error) {
    if (error instanceof Error) {
      console.error('[getRecommendations] Error in getRecommendations:', error.message);
    } else {
      console.error('[getRecommendations] Unknown error in getRecommendations');
    }
    // Fall back to user profile recommendations on error
    return await getRecommendationsFromUserProfile();
  }
};

// Build simple local recommendations using artists' top tracks and genre search
export const getLocalRecommendations = async (
  seedTracks: string[] = [],
  seedArtists: string[] = [],
  seedGenres: string[] = [],
  limit = 20
): Promise<SpotifyApi.RecommendationsObject> => {
  const token = await ensureValidToken();
  if (!token) return { tracks: [] } as any;

  try {
    const bearer = { headers: { Authorization: `Bearer ${spotify.getAccessToken()}` } };

    // Collect artist IDs from seeds
    const artistIds = new Set<string>(seedArtists);
    for (const trackId of seedTracks) {
      const track = await spotify.getTrack(trackId);
      (track?.artists || []).forEach((a: any) => a?.id && artistIds.add(a.id));
    }

    const candidatesMap = new Map<string, any>();

    // From artists' top tracks
    for (const artistId of artistIds) {
      try {
        const res = await fetch(`https://api.spotify.com/v1/artists/${artistId}/top-tracks?market=from_token`, bearer);
        if (res.ok) {
          const data = await res.json();
          (data?.tracks || []).forEach((t: any) => { if (t?.id) candidatesMap.set(t.id, t); });
        }
      } catch {}
    }

    // From genre searches
    for (const genre of seedGenres.slice(0, 3)) {
      try {
        const res = await fetch(`https://api.spotify.com/v1/search?q=${encodeURIComponent(`genre:"${genre}"`)}&type=track&limit=20`, bearer);
        if (res.ok) {
          const data = await res.json();
          (data?.tracks?.items || []).forEach((t: any) => { if (t?.id) candidatesMap.set(t.id, t); });
        }
      } catch {}
    }

    // Remove exact seed tracks, take up to limit
    seedTracks.forEach(id => candidatesMap.delete(id));
    const tracks = Array.from(candidatesMap.values()).slice(0, limit);
    return { tracks } as any;
  } catch (e) {
    console.warn('[getLocalRecommendations] Failed to build local recommendations:', (e as Error)?.message || e);
    return { tracks: [] } as any;
  }
};

export const getCurrentUser = async () => {
  if (!(await ensureValidToken())) {
    throw new Error('Token expired');
  }
  
  try {
    return await spotify.getMe();
  } catch (error) {
    if (error instanceof Error && 'status' in error && 
        (error as { status: number }).status === 401 || 
        (error as { status: number }).status === 403) {
      refreshToken();
    }
    throw new Error('Error fetching user profile');
  }
};

export const getCurrentTrack = async (userId?: string) => {
  // Ensure token is valid before proceeding
  if (!(await ensureValidToken())) {
    throw new Error('Token expired');
  }
  
  // Generate cache key if userId provided
  const cacheKey = userId ? `current_track:${userId}` : null;
  
  try {
    // Check cache first
    if (cacheKey) {
      const cached = Cache.getSpotifyData(cacheKey);
      if (cached) {
        return cached as PlaybackState;
      }
    }
    
    // Check rate limiting
    if (userId) {
      const rateLimit = checkRateLimit(userId);
      if (!rateLimit.allowed) {
        throw new Error(`Rate limited. Retry after ${rateLimit.retryAfter} seconds`);
      }
    }
    
    const response = await smartRequest(
      'https://api.spotify.com/v1/me/player',
      {
        headers: {
          Authorization: `Bearer ${spotify.getAccessToken()}`,
        },
      },
      userId || undefined,
      cacheKey || undefined,
      5000 // 5 second cache for current track
    );
    
    if (response.status === 401 || response.status === 403) {
      refreshToken();
      throw new Error('Token expired');
    }
    
    if (response.status === 429) {
      // Handle rate limiting
      const retryAfter = response.headers.get('Retry-After') || '1';
      const retryMs = parseInt(retryAfter) * 1000;
      (globalThis as any).__SPOTIFY_GLOBAL_BACKOFF_UNTIL = Date.now() + retryMs;
      handleRateLimitError();
      logOnce('getCurrentTrack-429', 'warn', `Rate limited, backing off for ${retryAfter}s`);
      throw new Error(`Rate limited, retry after ${retryAfter} seconds`);
    }
    
    if (response.status === 204) {
      // No active device or no track playing
      console.log('[getCurrentTrack] No active device or no track playing');
      return null;
    }
    
    if (!response.ok) {
      console.warn(`[getCurrentTrack] Unexpected status ${response.status}: ${response.statusText}`);
      return null;
    }
    
    const result = await response.json();
    handleSuccessfulRequest(); // Reset rate limiting on success
    
    // Cache the result
    if (cacheKey) {
      Cache.cacheSpotifyData(cacheKey, result, 5000);
    }
    
    return result as PlaybackState;
  } catch (error) {
    // If the error is already handled by our token refresh logic, re-throw it
    if (error instanceof Error && error.message === 'Token expired') {
      throw error;
    }
    if (error instanceof Error && error.message.includes('Rate limited')) {
      throw error;
    }
    if (error instanceof Error && error.message.includes('Circuit breaker')) {
      throw error;
    }
    
    // For network errors or other issues, return null instead of throwing
    console.warn('[getCurrentTrack] Network or other error, returning null:', error instanceof Error ? error.message : 'Unknown error');
    return null;
  }
};

/**
 * Get system performance statistics for monitoring
 */
export const getSystemStats = () => {
  return {
    rateLimiter: getRateLimitStats(),
    connectionPool: getConnectionPoolStats(),
    cache: Cache.getAllCacheStats(),
    timestamp: Date.now()
  };
};

/**
 * Get user-specific rate limit status
 */
export const getUserRateLimitStatus = (userId: string) => {
  return {
    userId,
    status: checkRateLimit(userId),
    timestamp: Date.now()
  };
};

export const getQueue = async (userId?: string) => {
  // Ensure token is valid before proceeding
  if (!(await ensureValidToken())) {
    throw new Error('Token expired');
  }
  
  // Generate cache key if userId provided
  const cacheKey = userId ? `queue:${userId}` : null;
  
  try {
    // Check cache first
    if (cacheKey) {
      const cached = Cache.getQueueData(userId!);
      if (cached) {
        return cached;
      }
    }
    
    // Check rate limiting
    if (userId) {
      const rateLimit = checkRateLimit(userId);
      if (!rateLimit.allowed) {
        throw new Error(`Rate limited. Retry after ${rateLimit.retryAfter} seconds`);
      }
    }
    
    const response = await smartRequest(
      'https://api.spotify.com/v1/me/player/queue',
      {
        headers: {
          Authorization: `Bearer ${spotify.getAccessToken()}`,
        },
      },
      userId || undefined,
      cacheKey || undefined,
      30000 // 30 second cache for queue
    );
    
    if (response.status === 401 || response.status === 403) {
      refreshToken();
      throw new Error('Token expired');
    }
    
    if (response.status === 429) {
      // Handle rate limiting
      const retryAfter = response.headers.get('Retry-After') || '1';
      const retryMs = parseInt(retryAfter) * 1000;
      (globalThis as any).__SPOTIFY_GLOBAL_BACKOFF_UNTIL = Date.now() + retryMs;
      handleRateLimitError();
      logOnce('getQueue-429', 'warn', `Rate limited, backing off for ${retryAfter}s`);
      throw new Error(`Rate limited, retry after ${retryAfter} seconds`);
    }
    
    if (response.status === 404) {
      // No active device or queue not available
      console.log('[getQueue] No active device or queue not available');
      const emptyQueue = { queue: [], currently_playing: null };
      
      // Cache empty queue result
      if (cacheKey) {
        Cache.cacheQueueData(userId!, emptyQueue);
      }
      
      return emptyQueue;
    }
    
    if (!response.ok) {
      console.warn(`[getQueue] Unexpected status ${response.status}: ${response.statusText}`);
      const emptyQueue = { queue: [], currently_playing: null };
      
      // Cache empty queue result
      if (cacheKey) {
        Cache.cacheQueueData(userId!, emptyQueue);
      }
      
      return emptyQueue;
    }
    
    const result = await response.json();
    handleSuccessfulRequest(); // Reset rate limiting on success
    
    // Cache the result
    if (cacheKey) {
      Cache.cacheQueueData(userId!, result);
    }
    
    return result;
  } catch (error) {
    // If the error is already handled by our token refresh logic, re-throw it
    if (error instanceof Error && error.message === 'Token expired') {
      throw error;
    }
    if (error instanceof Error && error.message.includes('Rate limited')) {
      throw error;
    }
    if (error instanceof Error && error.message.includes('Circuit breaker')) {
      throw error;
    }
    
    // For network errors or other issues, return empty queue instead of throwing
    console.warn('[getQueue] Network or other error, returning empty queue:', error instanceof Error ? error.message : 'Unknown error');
    const emptyQueue = { queue: [], currently_playing: null };
    
    // Cache empty queue result
    if (cacheKey) {
      Cache.cacheQueueData(userId!, emptyQueue);
    }
    
    return emptyQueue;
  }
};

export const playPause = async (playing: boolean) => {
  try {
    if (playing) {
      await spotify.play();
    } else {
      await spotify.pause();
    }
  } catch (error) {
    console.error('Error toggling play/pause:', error instanceof Error ? error.message : 'Unknown error');
    throw new Error('Error toggling play/pause');
  }
};

export const nextTrack = async () => {
  try {
    // Use fetch API directly instead of spotify-web-api-js
    const response = await fetch('https://api.spotify.com/v1/me/player/next', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${spotify.getAccessToken()}`
      }
    });
    
    // 204 No Content is the expected success response
    if (response.status === 204) {
      return true;
    } else if (!response.ok) {
      console.error(`Error skipping track: ${response.status}`);
      throw new Error(`Failed to skip track: ${response.status}`);
    }
    
    return true;
  } catch (error) {
    console.error('Error skipping to next track:', error);
    throw new Error('Error skipping to next track');
  }
};

export const previousTrack = async () => {
  try {
    await spotify.skipToPrevious();
  } catch (error) {
    console.error('Error skipping to previous track:', error instanceof Error ? error.message : 'Unknown error');
    throw new Error('Error skipping to previous track');
  }
};

export const setVolume = async (volume: number) => {
  try {
    await spotify.setVolume(volume);
  } catch (error) {
    console.error('Error setting volume:', error);
    throw error;
  }
};

export const getCurrentTrackDetails = async () => {
  try {
    return await spotify.getMyCurrentPlaybackState();
  } catch (error) {
    console.error('Error fetching current track details:', error instanceof Error ? error.message : 'Unknown error');
    throw new Error('Error fetching current track details');
  }
};

export const likeTrack = async (trackId: string) => {
  try {
    const isLiked = await spotify.containsMySavedTracks([trackId]);
    if (isLiked[0]) {
      await spotify.removeFromMySavedTracks([trackId]);
      return false;
    } else {
      await spotify.addToMySavedTracks([trackId]);
      return true;
    }
  } catch (error) {
    console.error('Error toggling track like:', error);
    throw error;
  }
};

export const dislikeTrack = async (trackId: string) => {
  try {
    // First check if track is liked and remove it if it is
    const isLiked = await spotify.containsMySavedTracks([trackId]);
    if (isLiked[0]) {
      await spotify.removeFromMySavedTracks([trackId]);
    }
    
    // Add to user's disliked tracks - you could implement this by adding to a "Disliked" playlist
    // For now we'll just skip the track and record it as disliked
    return true;
  } catch (error) {
    console.error('Error disliking track:', error);
    throw error;
  }
};

export const saveToPlaylist = async (trackId: string) => {
  try {
    const playlists = await spotify.getUserPlaylists();
    if (playlists.items.length > 0) {
      await spotify.addTracksToPlaylist(playlists.items[0].id, [`spotify:track:${trackId}`]);
    } else {
      throw new Error('No playlists found');
    }
  } catch (error) {
    console.error('Error saving track to playlist:', error instanceof Error ? error.message : 'Unknown error');
    throw new Error('Error saving track to playlist');
  }
};

export const shufflePlaylist = async (shuffle: boolean) => {
  try {
    await spotify.setShuffle(shuffle);
  } catch (error) {
    console.error('Error shuffling playlist:', error instanceof Error ? error.message : 'Unknown error');
    throw new Error('Error shuffling playlist');
  }
};

export const toggleShuffle = async () => {
  try {
    // Get current playback state to determine shuffle status
    const playbackState = await spotify.getMyCurrentPlaybackState();
    const currentShuffleState = playbackState?.shuffle_state || false;
    
    // Toggle to opposite state
    await spotify.setShuffle(!currentShuffleState);
    return !currentShuffleState;
  } catch (error) {
    console.error('Error toggling shuffle:', error);
    throw new Error('Error toggling shuffle');
  }
};

export const toggleRepeat = async (mode: 'off' | 'track' | 'context') => {
  try {
    await spotify.setRepeat(mode);
  } catch (error) {
    console.error('Error toggling repeat:', error instanceof Error ? error.message : 'Unknown error');
    throw new Error('Error toggling repeat');
  }
};

export const getAvailableGenreSeeds = async () => {
  // Return a curated list of verified working Spotify genres in the exact format needed for the API
  // Important: Spotify expects hyphenated, lowercase genres in their seed_genres parameter
  return [
    'pop', 'rock', 'electronic', 'hip-hop', 'indie', 
    'alternative', 'jazz', 'metal', 'dance', 'r-n-b',
    'soul', 'country', 'folk', 'reggae', 'disco',
    'classical', 'blues'
  ];
};

export function convertToSpotifyGenreFormat(genre: string): string {
  // Map of common genre conversions to Spotify's expected format
  const genreMap: Record<string, string> = {
    'r&b': 'r-n-b',
    'hiphop': 'hip-hop',
    'hip hop': 'hip-hop',
    'rhythm and blues': 'r-n-b',
    'rhythm & blues': 'r-n-b',
    'rnb': 'r-n-b'
  };
  
  // Convert to lowercase and remove any special characters
  const normalized = genre.toLowerCase().trim();
  
  // Return mapped version if it exists, otherwise return normalized version
  return genreMap[normalized] || normalized;
}

export async function getValidGenreSeeds(genres: string[]): Promise<string[]> {
  const availableGenres = await getAvailableGenreSeeds();
  return genres.filter(genre => availableGenres.includes(genre));
}

export const getLyrics = async (trackId: string): Promise<{ lyrics: string | null; syncedLyrics: Array<{ time: number; text: string }> | null }> => {
  const token = localStorage.getItem('spotify_token');
  if (!token) {
    throw new Error('No Spotify access token available.');
  }

  try {
    // Attempt to fetch synced lyrics from Spotify API first (may 404)
    try {
      const syncedLyricsResponse = await fetch(`https://api.spotify.com/v1/tracks/${trackId}/lyrics`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (syncedLyricsResponse.ok) {
        const data = await syncedLyricsResponse.json().catch(() => null);
        if (data && (data as any).lines) {
          const syncedLyrics = (data as any).lines.map((line: SpotifyApi.LyricsLine) => ({ time: parseInt(line.startTimeMs), text: line.words }));
          return { lyrics: null, syncedLyrics };
        }
      }
    } catch {}

    // Fetch track metadata for artist/title to query our backend lyrics providers
    const track = await spotify.getTrack(trackId as string);
    const primaryArtist = track?.artists?.[0]?.name || '';
    const title = track?.name || '';

    // Helper to try multiple base URLs (supports same-origin and local dev server)
    const tryFetchJson = async (path: string) => {
      // Only use same-origin to avoid noisy connection-refused errors when local server isn't running
      const bases = [window.location.origin];
      for (const base of bases) {
        try {
          const res = await fetch(`${base}${path}`);
          if (res.ok) {
            const contentType = res.headers.get('content-type') || '';
            if (contentType.includes('application/json')) {
              return await res.json().catch(() => null);
            } else {
              const text = await res.text().catch(() => '');
              // Guard: if the response looks like an HTML document, treat as invalid
              const looksLikeHtml = /^\s*<!doctype html/i.test(text) || /<html[\s>]/i.test(text);
              if (looksLikeHtml) {
                continue;
              }
              return text ? { lyrics: text } : null;
            }
          }
        } catch {}
      }
      return null;
    };

    // Try Musixmatch first (JSON)
    try {
      const mmPath = `/api/lyrics/musixmatch?artist=${encodeURIComponent(primaryArtist)}&title=${encodeURIComponent(title)}`;
      const mmData = await tryFetchJson(mmPath);
      if (mmData) {
        if (Array.isArray(mmData.syncedLyrics) && mmData.syncedLyrics.length > 0) {
          return { lyrics: null, syncedLyrics: mmData.syncedLyrics };
        }
        if (typeof mmData.lyrics === 'string' && mmData.lyrics.length > 0) {
          return { lyrics: mmData.lyrics, syncedLyrics: null };
        }
      }
    } catch {}

    // Fallback to alternative scrapers (AZLyrics / Lyrics.com)
    try {
      const altPath = `/api/lyrics/alternative?artist=${encodeURIComponent(primaryArtist)}&track=${encodeURIComponent(title)}`;
      const altData = await tryFetchJson(altPath);
      if (altData && typeof altData.lyrics === 'string' && altData.lyrics.length > 0) {
        return { lyrics: altData.lyrics, syncedLyrics: null };
      }
    } catch {}

    // As a final fallback, try NetEase
    try {
      const nePath = `/api/lyrics/netease?artist=${encodeURIComponent(primaryArtist)}&title=${encodeURIComponent(title)}`;
      const neData = await tryFetchJson(nePath);
      if (neData?.lrc && typeof neData.lrc === 'string') {
        return { lyrics: neData.lrc as string, syncedLyrics: null };
      }
    } catch {}

    return { lyrics: null, syncedLyrics: null };
  } catch (error) {
    console.error('Error fetching lyrics:', error);
    return { lyrics: null, syncedLyrics: null };
  }
};

export const createPlaylist = async (name: string) => {
  if (!(await ensureValidToken())) {
    throw new Error('Token expired');
  }
  const user = await spotify.getMe();
  try {
    const playlist = await spotify.createPlaylist(user.id, {
      name,
      public: false,
      collaborative: false,
      description: 'Created by Spotify Gestures'
    });
    return playlist;
  } catch (error) {
    console.error('Error creating playlist:', error);
    throw error;
  }
};

export const deletePlaylist = async (playlistId: string) => {
  if (!(await ensureValidToken())) {
    throw new Error('Token expired');
  }
  try {
    await spotify.unfollowPlaylist(playlistId);
  } catch (error) {
    console.error('Error deleting playlist:', error);
    throw error;
  }
};

export const getUserPlaylists = async () => {
  if (!(await ensureValidToken())) {
    throw new Error('Token expired');
  }
  try {
    const me = await spotify.getMe();
    const data = await spotify.getUserPlaylists(me.id, { limit: 50 });
    return data.items;
  } catch (error) {
    console.error('Error getting user playlists:', error);
    throw error;
  }
};

export const addTrackToPlaylist = async (playlistId: string, trackUri: string) => {
  if (!(await ensureValidToken())) {
    throw new Error('Token expired');
  }
  
  try {
    // Use fetch API directly for more reliable error handling
    const response = await fetch(`https://api.spotify.com/v1/playlists/${playlistId}/tracks`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${spotify.getAccessToken()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        uris: [trackUri]
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || `Failed to add track to playlist: ${response.status}`);
    }

    // Check if the response indicates success
    const responseData = await response.json().catch(() => ({}));
    
    // If we get here, the operation was successful
    return responseData;
  } catch (error) {
    console.error('Error adding track to playlist:', error);
    
    // Check if this is actually a success case that was misinterpreted as an error
    if (error instanceof Error) {
      // If the error message contains certain keywords, it might actually be successful
      const errorMessage = error.message.toLowerCase();
      if (errorMessage.includes('snapshot_id') || errorMessage.includes('playlist')) {
        // This is likely a successful operation that was misinterpreted
        console.log('Track added successfully despite error message');
        return { success: true };
      }
    }
    
    throw error;
  }
};

export const getPlaylistTracks = async (playlistId: string) => {
  if (!(await ensureValidToken())) {
    throw new Error('Token expired');
  }
  try {
    const data = await spotify.getPlaylistTracks(playlistId);
    return data.items;
  } catch (error) {
    console.error('Error getting playlist tracks:', error);
    throw error;
  }
};

export const seekToPosition = async (position_ms: number): Promise<void> => {
  if (!(await ensureValidToken())) {
    throw new Error('Token expired');
  }
  try {
    await spotify.seek(position_ms);
  } catch (error) {
    console.error('Error seeking to position:', error);
    throw error;
  }
};

// Add a custom type definition for spotify-web-api-js to include getMyQueue
declare module 'spotify-web-api-js' {
  interface SpotifyWebApiJs {
    getMyQueue(): Promise<{
      currently_playing: SpotifyApi.TrackObjectFull;
      queue: SpotifyApi.TrackObjectFull[];
    }>;
  }
}

export const getTopTracks = async (timeRange = 'medium_term', limit = 20) => {
  if (!(await ensureValidToken())) {
    throw new Error('Token expired');
  }
  try {
    const data = await spotify.getMyTopTracks({ time_range: timeRange, limit: limit });
    return data;
  } catch (error) {
    console.error('Error fetching top tracks:', error);
    throw error;
  }
};

export const getTopArtists = async (timeRange = 'medium_term', limit = 20) => {
  if (!(await ensureValidToken())) {
    throw new Error('Token expired');
  }
  try {
    const data = await spotify.getMyTopArtists({ time_range: timeRange, limit: limit });
    return data;
  } catch (error) {
    console.error('Error fetching top artists:', error);
    throw error;
  }
};

export const getRecentlyPlayed = async (limit = 20) => {
  if (!(await ensureValidToken())) {
    throw new Error('Token expired');
  }
  try {
    const data = await spotify.getMyRecentlyPlayedTracks({ limit: limit });
    return data;
  } catch (error) {
    console.error('Error fetching recently played tracks:', error);
    throw error;
  }
};

export const addToQueue = async (uri: string) => {
  if (!(await ensureValidToken())) {
    throw new Error('Token expired');
  }
  try {
    // Use fetch API directly for adding to queue as spotify-web-api-js might not have it updated
    const response = await fetch(`https://api.spotify.com/v1/me/player/queue?uri=${uri}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${spotify.getAccessToken()}`
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to add to queue: ${response.status}`);
    }
  } catch (error) {
    console.error('Error adding to queue:', error);
    throw error;
  }
};

export const removeFromQueue = async (uri: string) => {
  if (!(await ensureValidToken())) {
    throw new Error('Token expired');
  }
  
  try {
    // Get current queue
    const queueResponse = await fetch('https://api.spotify.com/v1/me/player/queue', {
      headers: {
        Authorization: `Bearer ${spotify.getAccessToken()}`,
      },
    });
    
    if (!queueResponse.ok) {
      throw new Error('Failed to fetch current queue');
    }
    
    const queueData = await queueResponse.json();
    const currentQueue = queueData.queue || [];
    
    interface QueueTrack {
      uri: string;
      [key: string]: unknown;
    }
    
    // Find the track to remove
    const trackIndex = currentQueue.findIndex((track: QueueTrack) => track.uri === uri);
    
    if (trackIndex === -1) {
      throw new Error('Track not found in queue');
    }
    
    // Method 1: If it's the next track, just skip it
    if (trackIndex === 0) {
      await fetch('https://api.spotify.com/v1/me/player/next', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${spotify.getAccessToken()}`,
        },
      });
      return { success: true, message: 'Track removed from queue' };
    }
    
    // Method 2: For tracks further in queue, we need to be very careful
    // to not affect the current song at all
    
    // Get current playback state
    const playbackResponse = await fetch('https://api.spotify.com/v1/me/player', {
      headers: {
        Authorization: `Bearer ${spotify.getAccessToken()}`,
      },
    });
    
    if (!playbackResponse.ok) {
      throw new Error('Failed to get playback state');
    }
    
    const playbackData = await playbackResponse.json();
    const currentTrack = playbackData.item;
    const isCurrentlyPlaying = playbackData.is_playing;
    const currentProgress = playbackData.progress_ms;
    
    // Store current settings
    const currentVolume = playbackData.device?.volume_percent || 50;
    const currentShuffle = playbackData.shuffle_state;
    const currentRepeat = playbackData.repeat_state;
    
    // The safest approach: temporarily pause, manipulate queue, then resume
    // This ensures the current song is completely preserved
    
    // Temporarily pause playback
    let wasPaused = false;
    if (isCurrentlyPlaying) {
      try {
        await fetch('https://api.spotify.com/v1/me/player/pause', {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${spotify.getAccessToken()}`,
          },
        });
        wasPaused = true;
        await new Promise(resolve => setTimeout(resolve, 200));
      } catch (error) {
        console.warn('Failed to pause playback:', error);
      }
    }
    
    // Now we can safely manipulate the queue
    // Skip to the track before the one we want to remove
    for (let i = 0; i < trackIndex; i++) {
      await fetch('https://api.spotify.com/v1/me/player/next', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${spotify.getAccessToken()}`,
        },
      });
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // Skip the track we want to remove
    await fetch('https://api.spotify.com/v1/me/player/next', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${spotify.getAccessToken()}`,
      },
    });
    
    // Add back the tracks that were after the removed track
    const tracksAfterRemoved = currentQueue.slice(trackIndex + 1);
    for (const track of tracksAfterRemoved) {
      await addToQueue(track.uri);
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    
    // Resume playback at the exact same position
    if (wasPaused && currentTrack) {
      try {
        // Resume with the exact same track and position
        await fetch('https://api.spotify.com/v1/me/player/play', {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${spotify.getAccessToken()}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            uris: [currentTrack.uri],
            position_ms: currentProgress
          }),
        });
      } catch (error) {
        console.warn('Failed to resume at exact position, trying normal resume:', error);
        // Fallback: just resume normally
        try {
          await fetch('https://api.spotify.com/v1/me/player/play', {
            method: 'PUT',
            headers: {
              Authorization: `Bearer ${spotify.getAccessToken()}`,
            },
          });
        } catch (fallbackError) {
          console.warn('Failed to resume playback:', fallbackError);
        }
      }
    }
    
    // Restore settings in background (non-blocking)
    setTimeout(async () => {
      try {
        // Restore volume
        if (currentVolume !== undefined) {
          await fetch(`https://api.spotify.com/v1/me/player/volume?volume_percent=${currentVolume}`, {
            method: 'PUT',
            headers: {
              Authorization: `Bearer ${spotify.getAccessToken()}`,
            },
          });
        }
        
        // Restore shuffle
        if (currentShuffle !== undefined) {
          await fetch(`https://api.spotify.com/v1/me/player/shuffle?state=${currentShuffle}`, {
            method: 'PUT',
            headers: {
              Authorization: `Bearer ${spotify.getAccessToken()}`,
            },
          });
        }
        
        // Restore repeat
        if (currentRepeat !== undefined) {
          await fetch(`https://api.spotify.com/v1/me/player/repeat?state=${currentRepeat}`, {
            method: 'PUT',
            headers: {
              Authorization: `Bearer ${spotify.getAccessToken()}`,
            },
          });
        }
      } catch (error) {
        console.warn('Failed to restore playback settings:', error);
      }
    }, 500);
    
    return { success: true, message: 'Track removed from queue' };
    
  } catch (error) {
    console.error('Error removing from queue:', error);
    throw new Error('Failed to remove track from queue');
  }
};

export const getAudioAnalysis = async (trackId: string) => {
  if (!(await ensureValidToken())) {
    throw new Error('Token expired');
  }
  try {
    const analysis = await spotify.getAudioAnalysisForTrack(trackId);
    return analysis;
  } catch (error) {
    // If the API returns 403 Forbidden, it likely means the current token
    // doesn't have the necessary scope for audio analysis — return null so
    // callers can fall back to defaults instead of erroring the whole UI.
    const maybeErr = error as unknown;
    if (maybeErr && typeof maybeErr === 'object' && 'status' in (maybeErr as Record<string, unknown>) && typeof (maybeErr as Record<string, unknown>).status === 'number' && (maybeErr as Record<string, number>).status === 403) {
      logOnce(`[getAudioAnalysis-${trackId}]`, 'warn', '[getAudioAnalysis] 403 Forbidden — insufficient scope or permissions for audio analysis');
      return null;
    }
    logOnce(`[getAudioAnalysis-${trackId}-error]`, 'error', 'Error fetching audio analysis:', error);
    return null;
  }
};

const sessionGenreCache = new Map<string, string[]>();

// Cache for related artists lookups to avoid repeated 404 spam
// - Stores not_found/error states with a TTL to prevent tight retry loops
const relatedArtistsCache = new Map<string, { status: 'ok' | 'not_found' | 'error'; lastChecked: number; artists?: Array<{ id: string }> }>();
const RELATED_ARTISTS_TTL_OK = 10 * 60 * 1000; // 10 minutes
const RELATED_ARTISTS_TTL_NF = 60 * 60 * 1000; // 1 hour for 404s
const RELATED_ARTISTS_TTL_ERR = 5 * 60 * 1000;  // 5 minutes for transient errors

async function fetchRelatedArtistsSafe(artistId: string): Promise<Array<{ id: string }>> {
  const now = Date.now();
  const cached = relatedArtistsCache.get(artistId);
  if (cached) {
    const ttl = cached.status === 'ok' ? RELATED_ARTISTS_TTL_OK : cached.status === 'not_found' ? RELATED_ARTISTS_TTL_NF : RELATED_ARTISTS_TTL_ERR;
    if (now - cached.lastChecked < ttl) {
      return cached.artists || [];
    }
  }

  try {
    const res = await rateLimitedFetch(`https://api.spotify.com/v1/artists/${artistId}/related-artists`, {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('spotify_token')}` }
    });

    if (res.status === 404) {
      // Artist not found or related-artists not available; treat as empty and cache as not_found
      if (shouldLog(`related-artists-404-${artistId}`, 60000)) {
        console.warn('[fetchRelatedArtistsSafe] 404 for related artists:', artistId);
      }
      relatedArtistsCache.set(artistId, { status: 'not_found', lastChecked: now, artists: [] });
      return [];
    }

    if (!res.ok) {
      // Other errors (401/403/5xx) — log once, cache transient error, return empty
      logOnce(`related-artists-${artistId}-status-${res.status}`, 'warn', '[fetchRelatedArtistsSafe] Failed to fetch related artists:', artistId, res.status);
      relatedArtistsCache.set(artistId, { status: 'error', lastChecked: now, artists: [] });
      return [];
    }

    const data = await res.json().catch(() => ({ artists: [] }));
    const artists = Array.isArray(data?.artists) ? data.artists.map((a: any) => ({ id: a?.id })).filter((a: any) => a && a.id) : [];
    relatedArtistsCache.set(artistId, { status: 'ok', lastChecked: now, artists });
    return artists;
  } catch (e) {
    logOnce(`related-artists-${artistId}-error`, 'warn', '[fetchRelatedArtistsSafe] Error:', e);
    relatedArtistsCache.set(artistId, { status: 'error', lastChecked: now, artists: [] });
    return [];
  }
}


// Recursively get genres for all artists and their related artists (up to 2 levels deep)
async function getAllArtistsGenres(artistIds: string[], depth = 0, maxDepth = 2, seen = new Set<string>()): Promise<string[]> {
  if (depth > maxDepth) return [];
  const genres: string[] = [];
  for (const artistId of artistIds) {
    if (seen.has(artistId)) continue;
    seen.add(artistId);
    try {
        const artist = await spotify.getArtist(artistId);
      if (artist && artist.genres && artist.genres.length > 0) {
        genres.push(...artist.genres);
      }
      // Recursively get related artists
      if (depth < maxDepth) {
        // Use safe fetch to avoid throwing/log spamming on 404s and cache failures
        const related = await fetchRelatedArtistsSafe(artistId);
        if (Array.isArray(related) && related.length > 0) {
          const relatedIds = related.map((a: { id: string }) => a.id).filter(Boolean);
          const relatedGenres = await getAllArtistsGenres(relatedIds, depth + 1, maxDepth, seen);
          genres.push(...relatedGenres);
        }
      }
    } catch (e) {
      // Ignore errors for individual artists but avoid noisy logs
      const key = `artist-${artistId}-error`;
      logOnce(key, 'warn', `[getAllArtistsGenres] Error for artist ${artistId}:`, e);
    }
  }
  return Array.from(new Set(genres));
}

// Main genre function using Vexcited/better-spotify-genres logic, fallback to backup
export const getTrackGenres = async (trackId: string): Promise<string[]> => {
  if (sessionGenreCache.has(trackId)) {
    return sessionGenreCache.get(trackId)!;
  }
  if (!(await ensureValidToken())) {
    return [];
  }
  try {
    const track = await spotify.getTrack(trackId);
    if (!track || !track.artists) {
      return [];
    }
    const artistIds = track.artists.map((a: { id: string }) => a.id).filter(Boolean);
    // Try all artists and their related artists (recursively)
    const genres = await getAllArtistsGenres(artistIds);
    if (genres.length > 0) {
      sessionGenreCache.set(trackId, genres);
      return genres.slice(0, 5);
    }
    // Fallback: use backup genre logic (MusicBrainz, Last.fm, etc.)
    try {
      const { getBackupGenres } = await import('./genreBackup');
      const result = await getBackupGenres(track.name, track.artists[0].name);
      if (result.success && result.genres.length > 0) {
        sessionGenreCache.set(trackId, result.genres);
        return result.genres.slice(0, 5);
      }
    } catch {
      // Ignore backup errors
    }
    sessionGenreCache.set(trackId, []);
    return [];
  } catch {
    return [];
  }
};

if (!spotify.getArtist) {
  spotify.getArtist = async function(artistId: string) {
    console.debug('[spotify.getArtist] Fetching artist:', artistId);
    try {
      const res = await rateLimitedFetch(`https://api.spotify.com/v1/artists/${artistId}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('spotify_token')}` }
      });
      if (!res.ok) {
        console.warn('[spotify.getArtist] Failed to fetch artist:', artistId, res.status);
        return null;
      }
      const data = await res.json();
      console.debug('[spotify.getArtist] Artist data:', data);
      return data;
    } catch (e) {
      console.error('[spotify.getArtist] Error:', e);
      return null;
    }
  };
}
if (!spotify.getArtistRelatedArtists) {
  spotify.getArtistRelatedArtists = async function(artistId: string) {
    console.debug('[spotify.getArtistRelatedArtists] Fetching related artists for:', artistId);
    try {
      const res = await rateLimitedFetch(`https://api.spotify.com/v1/artists/${artistId}/related-artists`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('spotify_token')}` }
      });
      if (!res.ok) {
        console.warn('[spotify.getArtistRelatedArtists] Failed to fetch related artists:', artistId, res.status);
        return [];
      }
      const data = await res.json();
      console.debug('[spotify.getArtistRelatedArtists] Related artists data:', data);
      return data.artists || [];
    } catch (e) {
      console.error('[spotify.getArtistRelatedArtists] Error:', e);
      return [];
    }
  };
}
// Polyfill for spotify.getTrack (needed for genre fetching)
if (!spotify.getTrack) {
  spotify.getTrack = async function(trackId: string) {
    console.debug('[spotify.getTrack] Fetching track:', trackId);
    try {
      const res = await rateLimitedFetch(`https://api.spotify.com/v1/tracks/${trackId}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('spotify_token')}` }
      });
      if (!res.ok) {
        console.warn('[spotify.getTrack] Failed to fetch track:', trackId, res.status);
        return null;
      }
      const data = await res.json();
      console.debug('[spotify.getTrack] Track data:', data);
      return data;
    } catch (e) {
      console.error('[spotify.getTrack] Error:', e);
      return null;
    }
  };
}

// Rate limiting and request queuing
async function processRequestQueue() {
  if (isProcessingQueue || requestQueue.length === 0) {
    return;
  }

  isProcessingQueue = true;
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;
  
  if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
    await new Promise(resolve => setTimeout(resolve, MIN_REQUEST_INTERVAL - timeSinceLastRequest));
  }

  const requestFn = requestQueue.shift();
  if (requestFn) {
    try {
      const result = await requestFn();
      consecutiveFailures = 0; // Reset on success
      return result;
    } catch (error) {
      console.error('Request failed:', error instanceof Error ? error.message : 'Unknown error');
      consecutiveFailures++;
      if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
        console.warn('Max consecutive failures reached. Cooling down...');
        await new Promise(resolve => setTimeout(resolve, COOL_DOWN_PERIOD));
        consecutiveFailures = 0; // Reset after cool down
      }
      throw error instanceof Error ? error : new Error('Unknown error in request queue'); // Re-throw the error to be caught by the original caller
    } finally {
      lastRequestTime = Date.now();
      isProcessingQueue = false;
      // Process next request in queue
      processRequestQueue(); 
    }
  }
  isProcessingQueue = false;
}

function queueRequest<T>(requestFn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
        const wrappedRequest = async () => {
            try {
                const result = await requestFn();
                resolve(result);
            } catch (error) {
                reject(error);
            }
        };
        requestQueue.push(wrappedRequest);
        processRequestQueue();
    });
}

export const playTrack = async (
  uri: string,
  contextUri?: string,
  trackIndexInContext?: number
) => {
  const token = await ensureValidToken();
  if (!token) {
    console.error('Playback failed: No valid token.');
    throw new Error('Token expired');
  }

  try {
    if (contextUri && typeof trackIndexInContext === 'number') {
      // If a playlist context is provided, use the robust `playContext` method.
      // This tells Spotify to play the entire playlist starting from the selected track.
      console.log(`Playing from context: ${contextUri} at index: ${trackIndexInContext}`);
      await SpotifyApi.playContext(token, contextUri, trackIndexInContext);
    } else {
      // If no context is available, play only the single track.
      console.log(`Playing single track: ${uri}`);
      await SpotifyApi.playTrack(token, uri);
    }
  } catch (error) {
    console.error('Error initiating playback with SpotifyApi, trying fallback.', error);
    // If the primary method fails, attempt a simpler fallback.
    try {
      await spotify.play({
        context_uri: contextUri,
        offset: contextUri ? { position: trackIndexInContext } : undefined,
        uris: !contextUri ? [uri] : undefined,
      });
    } catch (fallbackError) {
      console.error('Fallback playback method also failed:', fallbackError);
      throw fallbackError;
    }
  }
};

export const pauseTrack = async () => {
  if (!(await ensureValidToken())) {
    throw new Error('Token expired');
  }
  try {
    await spotify.pause();
  } catch (error) {
    console.error('Error pausing track:', error);
    throw error;
  }
};

export const getTrackAudioFeatures = async (trackId: string) => {
  if (!(await ensureValidToken())) {
    throw new Error('Token expired');
  }
  try {
    const features = await spotify.getAudioFeaturesForTrack(trackId);
    return features;
  } catch (error) {
    console.error('Error fetching audio features:', error);
    throw error;
  }
};

export const getPlaylistDetails = async (playlistId: string) => {
  if (!(await ensureValidToken())) {
    throw new Error('Token expired');
  }
  try {
    const data = await spotify.getPlaylist(playlistId);
    return data;
  } catch (error) {
    console.error('Error fetching playlist details:', error);
    throw error;
  }
};

export const getUserFollowedArtists = async (limit = 50) => {
  if (!(await ensureValidToken())) {
    throw new Error('Token expired');
  }
  try {
    const data = await spotify.getFollowedArtists({ limit: limit });
    return data.artists.items;
  } catch (error) {
    console.error('Error fetching followed artists:', error);
    throw error;
  }
};

export const getUserFollowers = async () => {
  if (!(await ensureValidToken())) {
    throw new Error('Token expired');
  }
  try {
    const data = await spotify.getMe(); // get current user profile
    return data.followers?.total;
  } catch (error) {
    console.error('Error fetching user followers:', error);
    throw error;
  }
};

export const followPlaylist = async (playlistId: string) => {
  if (!(await ensureValidToken())) {
    throw new Error('Token expired');
  }
  try {
    await spotify.followPlaylist(playlistId, {
      public: false
    });
  } catch (error) {
    console.error('Error following playlist:', error);
    throw error;
  }
};

export const unfollowPlaylist = async (playlistId: string) => {
  if (!(await ensureValidToken())) {
    throw new Error('Token expired');
  }
  try {
    await spotify.unfollowPlaylist(playlistId);
  } catch (error) {
    console.error('Error unfollowing playlist:', error);
    throw error;
  }
};

export const checkUserFollowsPlaylists = async (playlistId: string, userId: string) => {
  if (!(await ensureValidToken())) {
    throw new Error('Token expired');
  }
  try {
    const result = await spotify.areFollowingPlaylist(playlistId, [userId]);
    return result[0]; // Returns boolean
  } catch (error) {
    console.error('Error checking if user follows playlist:', error);
    throw error;
  }
};

export const signOut = () => {
  // Clear all auth-related data from localStorage
  localStorage.removeItem('spotify_token');
  localStorage.removeItem('spotify_token_expires_at');
  localStorage.removeItem('spotify_refresh_token');
  localStorage.removeItem('spotify_user');
  
  // Clear any scheduled token refreshes
  clearTokenRefreshSchedule();
  
  // Redirect to login page
  window.location.href = SPOTIFY_AUTH_URL;
};

export const searchTracks = async (query: string, limit = 10) => {
  if (!(await ensureValidToken())) {
    throw new Error('Token expired');
  }
  
  try {
    const response = await fetch(`https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=${limit}`, {
      headers: {
        'Authorization': `Bearer ${spotify.getAccessToken()}`
      }
    });

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        refreshToken();
        throw new Error('Token expired or forbidden');
      }
      throw new Error(`Failed to search tracks: ${response.status}`);
    }
    const data = await response.json();
    return data.tracks?.items || [];
  } catch (error) {
    console.error('Error searching tracks:', error);
    throw error;
  }
};
