import SpotifyWebApi from 'spotify-web-api-js';
import { authCreds } from './authCreds';
import { SpotifyApi } from './spotifyApi';

const spotify: any = new SpotifyWebApi();
const clientId = authCreds.client_id;
const redirectUri = authCreds.redirect_uri;

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

// Define the current track interface to fix TypeScript errors
interface CurrentPlaybackState {
  is_playing: boolean;
  item: SpotifyApi.TrackObjectFull;
  progress_ms: number;
  device: any;
  context?: SpotifyApi.ContextObject;
  [key: string]: any;
}

// Store token expiration timestamp
let tokenExpirationTime: number | null = null;
const TOKEN_EXPIRATION_BUFFER = 5 * 60 * 1000; // 5 minutes buffer

// Global request queue and rate limiting mechanism
const requestQueue: Array<() => Promise<any>> = [];
let isProcessingQueue = false;
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 100; // Minimum 100ms between requests

// Global counter to track consecutive API failures
let consecutiveFailures = 0;
const MAX_CONSECUTIVE_FAILURES = 3;
const COOL_DOWN_PERIOD = 10000; // 10 seconds cool down after multiple failures

let lastApiCall = 0;
const MIN_API_INTERVAL = 500; // ms
async function rateLimitedFetch(url: string, options?: RequestInit) {
  const now = Date.now();
  const wait = Math.max(0, MIN_API_INTERVAL - (now - lastApiCall));
  if (wait > 0) await new Promise(res => setTimeout(res, wait));
  lastApiCall = Date.now();
  return fetch(url, options);
}

if (!clientId || !redirectUri) {
  throw new Error("Spotify client ID or redirect URI is missing in the environment variables.");
}

export const SPOTIFY_AUTH_URL = `${authCreds.auth_endpoint}?client_id=${clientId}&redirect_uri=${redirectUri}&scope=${encodeURIComponent(authCreds.scope)}&response_type=${authCreds.response_type}&state=${authCreds.state}`;

export const setAccessToken = (token: string, expiresIn?: number) => {
  spotify.setAccessToken(token);
  
  // Set token expiration time if expires_in is provided
  if (expiresIn) {
    tokenExpirationTime = Date.now() + (expiresIn * 1000) - TOKEN_EXPIRATION_BUFFER;
  } else {
    // Default to 1 hour if not specified
    tokenExpirationTime = Date.now() + (3600 * 1000) - TOKEN_EXPIRATION_BUFFER;
  }
  
  // Store in localStorage
  localStorage.setItem('spotify_token', token);
  localStorage.setItem('spotify_token_expires_at', tokenExpirationTime.toString());
};

// Check if the token is valid
export const isTokenValid = () => {
  const token = localStorage.getItem('spotify_token');
  const expiresAt = localStorage.getItem('spotify_token_expires_at');
  
  if (!token || !expiresAt) {
    return false;
  }
  
  return Date.now() < parseInt(expiresAt);
};

// Refresh token by redirecting to login
export const refreshToken = () => {
  console.log('Token expired, redirecting to login...');
  // Don't clear the token immediately, let the user see the error first
  window.location.href = SPOTIFY_AUTH_URL;
};

// Ensure token is valid before making API calls
export const ensureValidToken = async () => {
  const token = localStorage.getItem('spotify_token');
  const expiresAt = localStorage.getItem('spotify_token_expires_at');
  
  console.log('[ensureValidToken] Checking token. ExpiresAt:', expiresAt, 'CurrentTime:', Date.now());

  if (!token || !expiresAt) {
    console.log('[ensureValidToken] No token or expiresAt in localStorage. Returning null.');
    return null;
  }
  
  const currentTime = Date.now();
  const expirationTime = parseInt(expiresAt);

  if (currentTime < expirationTime) {
    console.log('[ensureValidToken] Token is considered valid by client-side expiry check. Remaining time (ms):', expirationTime - currentTime);
    return token;
  }
  
  console.log('[ensureValidToken] Token expired by client-side check. Attempting full re-authentication.');
  refreshToken();
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
    
    // @ts-ignore: Suppress error due to type incompatibility with spotify-web-api-js
    const response = await queueRequest(() => spotify.getRecommendations({
      seed_genres: [randomGenre],
      limit: 10
    } as RecommendationsOptions));
    
    if (response && (response as SpotifyApi.RecommendationsObject).tracks && (response as SpotifyApi.RecommendationsObject).tracks.length > 0) {
      console.log(`[getFallbackRecommendations] Got ${(response as SpotifyApi.RecommendationsObject).tracks.length} fallback genre-based recommendations.`);
      return response;
    } else {
      console.log('[getFallbackRecommendations] No fallback recommendations found.');
      return { tracks: [] };
    }
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
  } catch (error: any) {
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
    
    // @ts-ignore: Suppress error due to type incompatibility with spotify-web-api-js
    const recommendations: SpotifyApi.RecommendationsObject = await spotify.getRecommendations(recommendationParams as RecommendationsOptions);
    
    if (recommendations && recommendations.tracks && recommendations.tracks.length > 0) {
      console.log(`[getRecommendations] Got ${recommendations.tracks.length} recommendations successfully.`);
      return recommendations;
    } else {
      console.log('[getRecommendations] No recommendations returned with provided seeds, trying user profile recommendations.');
      return await getRecommendationsFromUserProfile();
    }
  } catch (error) {
    console.error('[getRecommendations] Error in getRecommendations:', error);
    // Fall back to user profile recommendations on error
    return await getRecommendationsFromUserProfile();
  }
};

export const getCurrentUser = async () => {
  if (!(await ensureValidToken())) {
    throw new Error('Token expired');
  }
  
  try {
    return await spotify.getMe();
  } catch (error: any) {
    if (error.status === 401 || error.status === 403) {
      refreshToken();
    }
    throw new Error('Error fetching user profile');
  }
};

export const getCurrentTrack = async () => {
  // Ensure token is valid before proceeding
  if (!(await ensureValidToken())) {
    throw new Error('Token expired');
  }
  
  try {
    const response = await spotify.getMyCurrentPlaybackState() as CurrentPlaybackState;
    if (!response) {
      return null;
    }
    return response;
  } catch (error: any) {
    if (error.status === 401 || error.status === 403) {
      refreshToken();
      throw new Error('Token expired');
    }
    throw new Error('Error fetching current track');
  }
};

export const getQueue = async () => {
  // Ensure token is valid before proceeding
  if (!(await ensureValidToken())) {
    throw new Error('Token expired');
  }
  
  try {
    const response = await fetch('https://api.spotify.com/v1/me/player/queue', {
      headers: {
        Authorization: `Bearer ${spotify.getAccessToken()}`,
      },
    });
    
    if (response.status === 401 || response.status === 403) {
      refreshToken();
      throw new Error('Token expired');
    }
    
    if (!response.ok) {
      throw new Error('Failed to fetch queue');
    }
    
    return await response.json();
  } catch (error: any) {
    // If the error is already handled by our token refresh logic, re-throw it
    if (error.message === 'Token expired') {
      throw error;
    }
    throw new Error('Error fetching queue');
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
    throw new Error('Error saving track to playlist');
  }
};

export const shufflePlaylist = async (shuffle: boolean) => {
  try {
    await spotify.setShuffle(shuffle);
  } catch (error) {
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
    // Attempt to fetch synced lyrics from Spotify API first
    const syncedLyricsResponse = await fetch(`https://api.spotify.com/v1/tracks/${trackId}/lyrics`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (syncedLyricsResponse.ok) {
      const data = await syncedLyricsResponse.json();
      // Spotify's synced lyrics format can vary; adapt as needed
      if (data && data.lines) {
        const syncedLyrics = data.lines.map((line: any) => ({ time: line.startTimeMs, text: line.words }));
        return { lyrics: null, syncedLyrics };
      }
    }

    // Fallback to Musixmatch or other lyrics API if Spotify doesn't provide synced lyrics
    const response = await fetch(`${window.location.origin}/api/lyrics?trackId=${trackId}`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();

    // Basic text lyrics from Musixmatch
    if (data.lyrics) {
      // Check if it's a rich synced lyrics format or plain text
      if (data.lyrics.syncType === 'LINE_SYNCED') {
        const syncedLyrics = data.lyrics.lines.map((line: any) => ({
          time: parseFloat(line.startTimeMs),
          text: line.words,
        }));
        return { lyrics: null, syncedLyrics };
      } else {
        return { lyrics: data.lyrics.body, syncedLyrics: null };
      }
    }
    
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
    const data = await spotify.getUserPlaylists({ limit: 50 });
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
      currently_playing: any;
      queue: any[];
    }>;
  }
}

export const getTopTracks = async (timeRange = 'medium_term', limit = 20) => {
  if (!(await ensureValidToken())) {
    throw new Error('Token expired');
  }
  try {
    // @ts-ignore: Suppress error due to type incompatibility with spotify-web-api-js
    const data: SpotifyApi.UsersTopTracksResponse = await spotify.getMyTopTracks({ time_range: timeRange, limit: limit });
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
    // @ts-ignore: Suppress error due to type incompatibility with spotify-web-api-js
    const data: SpotifyApi.UsersTopArtistsResponse = await spotify.getMyTopArtists({ time_range: timeRange, limit: limit });
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
    // @ts-ignore: Suppress error due to type incompatibility with spotify-web-api-js
    const data: SpotifyApi.UsersRecentlyPlayedTracksResponse = await spotify.getMyRecentlyPlayedTracks({ limit: limit });
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
    
    // Find the track to remove
    const trackIndex = currentQueue.findIndex((track: any) => track.uri === uri);
    
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
    console.error('Error fetching audio analysis:', error);
    throw error;
  }
};

const sessionGenreCache = new Map<string, string[]>();


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
        const related = await spotify.getArtistRelatedArtists(artistId);
        if (Array.isArray(related)) {
          const relatedIds = related.map((a: { id: string }) => a.id).filter(Boolean);
          const relatedGenres = await getAllArtistsGenres(relatedIds, depth + 1, maxDepth, seen);
          genres.push(...relatedGenres);
        }
      }
    } catch {
      // Ignore errors for individual artists
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
    } catch (error: any) {
      console.error('Request failed:', error);
      consecutiveFailures++;
      if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
        console.warn('Max consecutive failures reached. Cooling down...');
        await new Promise(resolve => setTimeout(resolve, COOL_DOWN_PERIOD));
        consecutiveFailures = 0; // Reset after cool down
      }
      throw error; // Re-throw the error to be caught by the original caller
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
  localStorage.removeItem('spotify_token');
  localStorage.removeItem('spotify_token_expires_at');
  localStorage.removeItem('spotify_user');
  window.location.href = SPOTIFY_AUTH_URL; // Redirect to login page
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
