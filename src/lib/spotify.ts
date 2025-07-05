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
const RATE_LIMIT_RESET_TIME = 60 * 1000; // Default 1 minute for rate limit reset

// Global counter to track consecutive API failures
let consecutiveFailures = 0;
const MAX_CONSECUTIVE_FAILURES = 3;
const COOL_DOWN_PERIOD = 10000; // 10 seconds cool down after multiple failures

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
      throw new Error(`Failed to get recommendations: ${response.status}`);
    }
    
    return await response.json();
  } catch (error: any) {
    console.error('Error getting personalized recommendations:', error);
    // Fall back to genre-based recommendations if personal ones fail
    return getFallbackRecommendations();
  }
};

const getGenreBasedRecommendations = async () => {
  try {
    // Use only verified working genres in the correct format
    const verifiedGenres = [
      'pop', 'rock', 'electronic', 'hip-hop', 'indie', 
      'alternative', 'jazz', 'metal', 'dance', 'r-n-b',
      'soul', 'country', 'folk', 'reggae', 'disco',
      'classical', 'blues'
    ];
    const randomGenres: string[] = [];
    
    // Pick 2 random genres from the verified list
    for (let i = 0; i < 2; i++) {
      const randomIndex = Math.floor(Math.random() * verifiedGenres.length);
      randomGenres.push(verifiedGenres[randomIndex]);
      verifiedGenres.splice(randomIndex, 1); // Remove to avoid duplicates
    }
    
    console.log('Using genres for recommendations:', randomGenres.join(', '));
    
    // Use queueRequest to throttle API calls
    return await queueRequest(() => spotify.getRecommendations({
      seed_genres: randomGenres,
      limit: 10 // Limit the number of recommendations
    } as RecommendationsOptions));
  } catch (error) {
    console.error('Error getting genre-based recommendations:', error);
    // Fall back to generic recommendations or an empty array if genre-based also fails
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
    await spotify.addTracksToPlaylist(playlistId, [trackUri]);
  } catch (error) {
    console.error('Error adding track to playlist:', error);
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
  // Spotify API does not have a direct endpoint to remove from queue
  // This would typically involve recreating the queue without the track
  // For now, we will just log and not throw an error
  console.warn('Spotify API does not support direct removal from queue.');
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

// Helper function to provide default audio data
const getDefaultAudioData = () => ({
  beats: [],
  bars: [],
  tatums: [],
  sections: [],
  segments: []
});

// Helper function to provide default audio analysis
const getDefaultAnalysis = () => ({
  track: {
    duration: 0,
    start_of_fade_out: 0,
    end_of_fade_in: 0,
    loudness: 0,
    tempo: 0,
    tempo_confidence: 0,
    time_signature: 0,
    time_signature_confidence: 0,
    key: 0,
    key_confidence: 0,
    mode: 0,
    mode_confidence: 0
  },
  bars: [],
  beats: [],
  sections: [],
  segments: [],
  tatums: []
});

export const getTrackGenres = async (trackId: string): Promise<string[]> => {
  if (!(await ensureValidToken())) {
    console.warn('Token not valid for getTrackGenres.');
    return [];
  }
  
  try {
    const track = await spotify.getTrack(trackId);
    if (track && track.artists && track.artists.length > 0) {
      const artistIds = track.artists.map((artist: SpotifyApi.ArtistObjectSimplified) => artist.id).filter(Boolean) as string[];
      if (artistIds.length > 0) {
        return await getGenresFromArtists(artistIds);
      }
    }
    // Fallback to default genres if no artists or no genres found for artists
    return getDefaultGenresByArtistName(track.artists.map((a: SpotifyApi.ArtistObjectSimplified) => a.name));
  } catch (error) {
    console.error('Error getting track genres:', error);
    // Fallback to default genres on error
    return [];
  }
};

// Utility to get genres from artists, with caching and fallback
async function getGenresFromArtists(artistIds: string[]): Promise<string[]> {
  const allGenres = new Set<string>();
  const token = await ensureValidToken();
  if (!token) return [];

  // Fetch artist details in batches to get genres
  const batchSize = 50; // Spotify API allows up to 50 artists per request
  for (let i = 0; i < artistIds.length; i += batchSize) {
    const batch = artistIds.slice(i, i + batchSize);
    try {
      const response = await queueRequest(() => spotify.getArtists(batch));
      if (response && (response as SpotifyApi.MultipleArtistsResponse).artists) {
        (response as SpotifyApi.MultipleArtistsResponse).artists.forEach((artist: SpotifyApi.ArtistObjectFull) => {
          if (artist && artist.genres) {
            artist.genres.forEach(genre => allGenres.add(genre));
          }
        });
      }
    } catch (error) {
      console.error('Error fetching artist batch for genres:', error);
    }
  }
  return Array.from(allGenres);
}

// Fallback for getting genres by artist name if Spotify API fails or no genres found
function getDefaultGenresByArtistName(artistNames: string[]): string[] {
  const genresMap: { [key: string]: string[] } = {
    // A mapping of artist names (or keywords) to typical genres
    // This is a simplified fallback and won't be comprehensive
    'Pop': ['pop'],
    'Rock': ['rock', 'alternative'],
    'Hip Hop': ['hip-hop', 'rap'],
    'Electronic': ['electronic', 'dance'],
    'Jazz': ['jazz'],
    'Classical': ['classical'],
    'Country': ['country'],
    'R&B': ['r-n-b', 'soul'],
    'Blues': ['blues'],
    'Folk': ['folk'],
    'Reggae': ['reggae'],
    'Metal': ['metal'],
    'Indie': ['indie'],
    'Alternative': ['alternative'],
    'Dance': ['dance'],
    'Soul': ['soul'],
    'Disco': ['disco'],
  };

  const defaultGenres: string[] = [];
  artistNames.forEach(name => {
    for (const keyword in genresMap) {
      if (name.toLowerCase().includes(keyword.toLowerCase())) {
        defaultGenres.push(...genresMap[keyword]);
        break;
      }
    }
  });
  return [...new Set(defaultGenres)]; // Return unique genres
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

async function fetchWithRetry(
  url: string, 
  options: RequestInit, 
  maxRetries = 5, 
  initialDelayMs = 2000
): Promise<Response> {
  let retries = 0;
  let delay = initialDelayMs;

  while (retries < maxRetries) {
    try {
      const response = await fetch(url, options);
      if (response.ok) {
        return response;
      } else if (response.status === 429) { // Rate limit exceeded
        const retryAfter = response.headers.get('Retry-After');
        const retryDelay = retryAfter ? parseInt(retryAfter) * 1000 : delay; // Use Retry-After header if available
        console.warn(`Rate limit exceeded. Retrying after ${retryDelay / 1000} seconds.`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
        delay *= 2; // Exponential backoff
      } else if (response.status >= 500) { // Server error
        console.warn(`Server error ${response.status}. Retrying in ${delay / 1000} seconds.`);
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= 2; // Exponential backoff
      } else {
        // For other client errors (4xx), don't retry
        throw new Error(`API error: ${response.status} - ${response.statusText}`);
      }
    } catch (error: any) {
      console.error('Fetch error:', error);
      if (error.message.startsWith('API error')) {
        throw error; // Don't retry for specific API errors
      }
      console.warn(`Network error. Retrying in ${delay / 1000} seconds.`);
      await new Promise(resolve => setTimeout(resolve, delay));
      delay *= 2; // Exponential backoff
    }
    retries++;
  }
  throw new Error(`Failed to fetch ${url} after ${maxRetries} retries.`);
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
      throw new Error(`Failed to search tracks: ${response.status}`);
    }

    const data = await response.json();
    return data.tracks?.items || [];
  } catch (error) {
    console.error('Error searching tracks:', error);
    throw error;
  }
};
