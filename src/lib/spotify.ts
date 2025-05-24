import SpotifyWebApi from 'spotify-web-api-js';
import { authCreds } from './authCreds';

const spotify = new SpotifyWebApi();
const clientId = authCreds.client_id;
const redirectUri = authCreds.redirect_uri;

// Define the current track interface to fix TypeScript errors
interface CurrentPlaybackState {
  is_playing: boolean;
  item: {
    id: string;
    uri: string;
    name: string;
    artists: any[];
    album: any;
    [key: string]: any;
  };
  progress_ms: number;
  device: any;
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
    console.log('[ensureValidToken] No token or expiresAt in localStorage.');
    // If no token, and a function needs one, it should ideally trigger login.
    // For now, returning null, callers must handle this by initiating login if needed.
    // Consider if refreshToken() should be called here if a route requiring auth is accessed.
    return null;
  }
  
  // If token is still valid by our client-side check, return it
  if (Date.now() < parseInt(expiresAt)) {
    console.log('[ensureValidToken] Token is considered valid by client-side expiry check.');
    return token;
  }
  
  // Token is expired according to client-side check
  console.log('[ensureValidToken] Token expired by client-side check. Attempting full re-authentication.');
  refreshToken(); // This function already navigates to SPOTIFY_AUTH_URL
  return null; // Return null as the page will redirect for re-authentication
};

// Original getCurrentUser function with token validation
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

export const getRecommendations = async (trackId?: string) => {
  try {
    console.log('getRecommendations called with trackId:', trackId);
    
    // If no trackId is provided, use the current track
    if (!trackId) {
      console.log('No track ID provided, fetching current playback state');
      const currentPlayback = await spotify.getMyCurrentPlaybackState();
      if (currentPlayback && currentPlayback.item) {
        trackId = currentPlayback.item.id;
        console.log('Using current track ID:', trackId);
      } else {
        console.log('No current track playing, falling back to user profile recommendations');
        // If no current track is playing, use user's top tracks and artists
        return await getRecommendationsFromUserProfile();
      }
    }
    
    // Set up basic recommendation parameters that don't rely on potentially failing API calls
    const recommendationParams: any = {
      limit: 10,
    };

    try {
      // Add seed track
      recommendationParams.seed_tracks = [trackId];
      
      // Use minimum popularity to get more well-known songs
      recommendationParams.min_popularity = 30; // Lower minimum popularity to get more results
      
      console.log('Getting recommendations with params:', recommendationParams);
      
      // Get recommendations using these parameters
      const recommendations = await spotify.getRecommendations(recommendationParams);
      
      if (recommendations && recommendations.tracks && recommendations.tracks.length > 0) {
        console.log(`Got ${recommendations.tracks.length} recommendations successfully`);
        return recommendations;
      } else {
        console.log('No recommendations returned with seed track, trying simpler params');
        
        // Try with just the seed track if the above parameters don't work
        const simpleRecommendations = await spotify.getRecommendations({
          seed_tracks: [trackId],
          limit: 10
        });
        
        if (simpleRecommendations && simpleRecommendations.tracks && simpleRecommendations.tracks.length > 0) {
          console.log(`Got ${simpleRecommendations.tracks.length} recommendations with simple params`);
          return simpleRecommendations;
        } else {
          console.log('No recommendations with simple params either, trying genre-based');
        }
      }
    } catch (error) {
      console.warn('Failed to get recommendations with seed track:', error);
      
      // Try with just genres if seed track approach fails
      console.log('Attempting genre-based recommendations');
      const genreRecommendations = await getGenreBasedRecommendations();
      if (genreRecommendations && genreRecommendations.tracks && genreRecommendations.tracks.length > 0) {
        console.log(`Got ${genreRecommendations.tracks.length} genre-based recommendations`);
        return genreRecommendations;
      }
    }
    
    // Fall back to recommendations based on user profile
    console.log('Falling back to user profile recommendations');
    return await getRecommendationsFromUserProfile();
  } catch (error) {
    console.error('Error in getRecommendations:', error);
    
    // Return empty recommendations as a fallback
    return {
      tracks: []
    };
  }
};

// Get personalized recommendations based on user's top tracks and artists
export const getRecommendationsFromUserProfile = async () => {
  if (!(await ensureValidToken())) {
    throw new Error('Token expired');
  }
  
  try {
    // First get user's top tracks to use as seed tracks
    const topTracksResponse = await getTopTracks('short_term', 5);
    const topArtistsResponse = await getTopArtists('short_term', 5);
    
    if (!topTracksResponse?.items || !topArtistsResponse?.items) {
      throw new Error('Could not get top tracks or artists');
    }
    
    // Extract IDs for seed tracks and artists
    const seedTracks = topTracksResponse.items.slice(0, 2).map(track => track.id);
    const seedArtists = topArtistsResponse.items.slice(0, 3).map(artist => artist.id);
    
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

// Update the getAvailableGenreSeeds function with the exact format Spotify expects
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

// Convert generic genre names to their required Spotify API formats
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

// Update getGenreBasedRecommendations to use verified genres in correct format
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
      limit: 10,
      min_popularity: 70
    }));
  } catch (error) {
    console.error('Error getting genre-based recommendations:', error);
    return {
      tracks: []
    };
  }
};

// Fallback to genre-based recommendations if user data is not available
const getFallbackRecommendations = async () => {
  if (!(await ensureValidToken())) {
    throw new Error('Token expired');
  }
  
  try {
    // Get available genres
    const genres = await getAvailableGenreSeeds();
    
    if (!genres || genres.length === 0) {
      throw new Error('No genre seeds available');
    }
    
    // Select 3 random genres from the available list
    const randomGenres = [];
    const availableGenres = [...genres]; // Create a copy to avoid modifying the original
    
    for (let i = 0; i < Math.min(3, availableGenres.length); i++) {
      const randomIndex = Math.floor(Math.random() * availableGenres.length);
      randomGenres.push(availableGenres[randomIndex]);
      // Remove selected genre to avoid duplicates
      availableGenres.splice(randomIndex, 1);
    }
    
    console.log('Using fallback genres for recommendations:', randomGenres.join(', '));
    
    // Build the request URL with query parameters
    const url = `https://api.spotify.com/v1/recommendations?seed_genres=${randomGenres.join(',')}&limit=20`;
    console.log('Fallback recommendation URL:', url);
    
    // Make the request
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${spotify.getAccessToken()}`
      }
    });
    
    if (!response.ok) {
      console.error(`Failed to get fallback recommendations: ${response.status}`, await response.text());
      throw new Error(`Failed to get fallback recommendations: ${response.status}`);
    }
    
    return await response.json();
  } catch (error: any) {
    console.error('Error getting fallback recommendations:', error);
    throw error;
  }
};

// Helper function to get valid genre seeds for recommendations
export async function getValidGenreSeeds(genres: string[]): Promise<string[]> {
  const validGenres = await getAvailableGenreSeeds();
  return genres.filter(genre => 
    validGenres.includes(genre.toLowerCase())
  );
}

export const getLyrics = async (trackId: string): Promise<{ lyrics: string | null; syncedLyrics: Array<{ time: number; text: string }> | null }> => {
  try {
    const track = await spotify.getTrack(trackId);
    const artist = track.artists[0].name;
    const title = track.name;

    // First try: Spotify's lyrics API 
    try {
      const response = await fetch(`https://api.spotify.com/v1/tracks/${trackId}/lyrics`, {
        headers: {
          'Authorization': `Bearer ${spotify.getAccessToken()}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        
        if (data && data.lyrics && data.lyrics.lines) {
          // Process synchronized lyrics
          if (data.lyrics.syncType === 'LINE_SYNCED') {
            const syncedLyrics = data.lyrics.lines.map((line: any) => ({
              time: parseInt(line.startTimeMs),
              text: line.words
            }));
            
            const plainLyrics = data.lyrics.lines.map((line: any) => line.words).join('\n');
            
            return { lyrics: plainLyrics, syncedLyrics };
          } else {
            // Just return the unsynced lyrics
            const plainLyrics = data.lyrics.lines.map((line: any) => line.words).join('\n');
            return { lyrics: plainLyrics, syncedLyrics: null };
          }
        }
      }
    } catch (spotifyError) {
      console.log('Spotify lyrics API failed:', spotifyError);
    }

    // Second try: External API (lyricstify)
    try {
      const lyricsResponse = await fetch(`https://lyricstify.vercel.app/api/v1/lyrics/${trackId}`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        }
      });
      
      if (lyricsResponse.ok) {
        const lyricsData = await lyricsResponse.json();
        
        if (lyricsData && lyricsData.data && lyricsData.data.lyrics && lyricsData.data.lyrics.lines) {
          const syncedLyrics = lyricsData.data.lyrics.lines.map((line: any) => ({
            time: line.startTimeMs,
            text: line.words
          }));
          
          const plainLyrics = lyricsData.data.lyrics.lines.map((line: any) => line.words).join('\n');
          
          return { lyrics: plainLyrics, syncedLyrics };
        }
      }
    } catch (externalError) {
      console.log('External lyrics API failed:', externalError);
    }
    
    // Third try: Fallback to musixmatch using track details instead of ID
    try {
      // Search by artist and title
      const cleanTitle = title.replace(/\(.*?\)/g, '').trim(); // Remove text in parentheses
      const url = `https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(cleanTitle)}`;
      
      const response = await fetch(url);
      
      if (response.ok) {
        const data = await response.json();
        
        if (data && data.lyrics) {
          return { lyrics: data.lyrics, syncedLyrics: null };
        }
      }
    } catch (musixmatchError) {
      console.log('Musixmatch lyrics failed:', musixmatchError);
    }

    return { lyrics: null, syncedLyrics: null };
  } catch (error) {
    console.error('Error fetching lyrics:', error);
    return { lyrics: null, syncedLyrics: null };
  }
};

export const createPlaylist = async (name: string) => {
  try {
    const user = await getCurrentUser();
    await spotify.createPlaylist(user.id, { name });
  } catch (error) {
    throw new Error('Error creating playlist');
  }
};

export const deletePlaylist = async (playlistId: string) => {
  try {
    await spotify.unfollowPlaylist(playlistId);
  } catch (error) {
    throw new Error('Error deleting playlist');
  }
};

export const getUserPlaylists = async () => {
  try {
    const response = await spotify.getUserPlaylists();
    return response; // Return the full response which includes the items property
  } catch (error) {
    console.error('Error fetching user playlists:', error);
    throw error;
  }
};

export const addTrackToPlaylist = async (playlistId: string, trackUri: string) => {
  try {
    await spotify.addTracksToPlaylist(playlistId, [trackUri]);
    return true;
  } catch (error) {
    console.error('Error adding track to playlist:', error);
    return false;
  }
};

export const getPlaylistTracks = async (playlistId: string) => {
  try {
    const response = await spotify.getPlaylistTracks(playlistId);
    return response.items;
  } catch (error) {
    console.error('Error fetching playlist tracks:', error);
    throw error;
  }
};

export const seekToPosition = async (position_ms: number): Promise<void> => {
  try {
    await spotify.seek(position_ms);
  } catch (error) {
    console.error('Error seeking to position:', error);
    throw error;
  }
};

declare module 'spotify-web-api-js' {
  interface SpotifyWebApiJs {
    getMyQueue(): Promise<{
      currently_playing: any;
      queue: any[];
    }>;
  }
}

export const getTopTracks = async (timeRange = 'medium_term', limit = 20) => {
  try {
    return await spotify.getMyTopTracks({ 
      time_range: timeRange, 
      limit 
    });
  } catch (error) {
    console.error('Error fetching top tracks:', error);
    throw new Error('Failed to fetch top tracks');
  }
};

export const getTopArtists = async (timeRange = 'medium_term', limit = 20) => {
  try {
    return await spotify.getMyTopArtists({ 
      time_range: timeRange, 
      limit 
    });
  } catch (error) {
    console.error('Error fetching top artists:', error);
    throw new Error('Failed to fetch top artists');
  }
};

export const getRecentlyPlayed = async (limit = 20) => {
  try {
    return await spotify.getMyRecentlyPlayedTracks({ limit });
  } catch (error) {
    console.error('Error fetching recently played tracks:', error);
    throw error;
  }
};

// Add a new function to get audio analysis for a track
export const getAudioAnalysis = async (trackId: string) => {
  // Ensure token is valid before proceeding
  const currentTokenForAnalysis = await ensureValidToken();
  console.log(`[getAudioAnalysis] Token for track ${trackId}:`, currentTokenForAnalysis ? currentTokenForAnalysis.substring(0, 10) + '...' : 'No token');

  if (!currentTokenForAnalysis) {
    return getDefaultAudioData();
  }
  
  try {
    // First try to get audio features (tempo, key, etc.)
    console.log(`[getAudioAnalysis] Attempting spotify.getAudioFeaturesForTrack for ${trackId}`);
    const features = await spotify.getAudioFeaturesForTrack(trackId); // Assumes spotify instance has the latest token via ensureValidToken -> setAccessToken
    console.log(`[getAudioAnalysis] Features from spotify.getAudioFeaturesForTrack for ${trackId}:`, features ? 'Loaded' : 'Failed or no features');
    
    // Then get detailed audio analysis (beats, bars, sections, etc.)
    console.log(`[getAudioAnalysis] Attempting fetch for audio-analysis for ${trackId}`);
    const response = await fetch(`https://api.spotify.com/v1/audio-analysis/${trackId}`, {
      headers: {
        Authorization: `Bearer ${spotify.getAccessToken()}` // Ensure this uses the most up-to-date token
      },
    });
    
    if (!response.ok) {
      // If we got a 401 or 403, it likely means the token has expired 
      if (response.status === 401 /* || response.status === 403 */) { // Temporarily comment out 403 to let TrackPage handle it
        console.log('[getAudioAnalysis] Encountered 401 fetching analysis, calling refreshToken.');
        refreshToken();
        return getDefaultAudioData();
      } else if (response.status === 403) {
        console.log('[getAudioAnalysis] Encountered 403 fetching analysis. Will not call refreshToken here to let other handlers try.');
        // Do not call refreshToken() here for 403 on audio-analysis to let TrackPage.tsx logic take precedence for now.
      }
      
      // For other errors, still return the features if we have them
      if (features) {
        return {
          features,
          analysis: getDefaultAnalysis()
        };
      }
      
      throw new Error('Failed to fetch audio analysis');
    }
    
    const analysis = await response.json();
    
    // Return combined data
    return {
      features,
      analysis
    };
  } catch (error) {
    console.error('Error fetching audio analysis:', error);
    return getDefaultAudioData();
  }
};

// Helper function to return default audio data
const getDefaultAudioData = () => {
  return {
    features: {
      energy: 0.5,
      danceability: 0.5,
      valence: 0.5,
      acousticness: 0.5,
      tempo: 120,
      liveness: 0.5,
      speechiness: 0.5,
      instrumentalness: 0.5
    },
    analysis: getDefaultAnalysis()
  };
};

const getDefaultAnalysis = () => {
  return {
    beats: [],
    bars: [],
    tatums: [],
    sections: [],
    segments: []
  };
};

// Store artist genre cache globally to avoid repeated requests
const artistGenreCache = new Map<string, string[]>();
// Track genre cache to prevent repeated requests for the same track
const trackGenreCache = new Map<string, string[]>();

/**
 * Get track genres by fetching them from various sources
 * Implementation inspired by better-spotify-genres by Vexcited
 * https://github.com/Vexcited/better-spotify-genres
 */
export const getTrackGenres = async (trackId: string): Promise<string[]> => {
  if (!(await ensureValidToken())) {
    console.error('Invalid token when getting track genres');
    return [];
  }
  
  // Check cache first
  if (trackGenreCache.has(trackId)) {
    console.log(`Using cached genres for track ${trackId}`);
    return trackGenreCache.get(trackId) || [];
  }
  
  // If we've had several consecutive failures, enforce a cool down period
  if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
    console.warn(`Too many consecutive API failures (${consecutiveFailures}). Enforcing cool down period.`);
    await new Promise(resolve => setTimeout(resolve, COOL_DOWN_PERIOD));
    consecutiveFailures = 0;
  }
  
  try {
    // Add a small delay before making any request to prevent rate limiting
    await new Promise(resolve => setTimeout(resolve, Math.random() * 300));

    // Primary approach: Get genres from all track's artists
    const trackResponse = await fetchWithRetry(
      `https://api.spotify.com/v1/tracks/${trackId}`,
      { headers: { 'Authorization': `Bearer ${spotify.getAccessToken()}` } }
    );
    
    if (!trackResponse.ok) {
      if (trackResponse.status === 401 || trackResponse.status === 403) {
        await refreshToken();
        return getTrackGenres(trackId); // Retry after token refresh
      } else if (trackResponse.status === 429) {
        // If rate limited, wait longer and try again with exponential backoff
        const retryAfter = trackResponse.headers.get('Retry-After');
        const waitTime = retryAfter ? (parseInt(retryAfter) * 1000) : (COOL_DOWN_PERIOD * 2);
        console.warn(`Rate limited (429) when getting track. Waiting ${waitTime}ms before retry.`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        consecutiveFailures++; // Track this failure
        return getTrackGenres(trackId); // Retry after waiting
      }
      throw new Error(`Failed to get track: ${trackResponse.status}`);
    }
    
    // Reset consecutive failures counter on success
    consecutiveFailures = 0;
    
    const track = await trackResponse.json();
    if (!track || !Array.isArray(track.artists) || track.artists.length === 0) {
      throw new Error('Track data is invalid');
    }
    
    // Get artist IDs
    const artistIds = track.artists.map((artist: any) => artist.id).filter(Boolean);
    if (artistIds.length === 0) {
      throw new Error('No valid artist IDs found');
    }
    
    // Try to get genres from track's artists first
    const genresFromArtists = await getGenresFromArtists(artistIds);
    if (genresFromArtists.length > 0) {
      trackGenreCache.set(trackId, genresFromArtists);
      return genresFromArtists;
    }
    
    // Fallback 1: Try album genres
    if (track.album && track.album.id) {
      // Add a small delay before making the album request to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 200 + Math.random() * 300));
      
      const albumResponse = await fetchWithRetry(
        `https://api.spotify.com/v1/albums/${track.album.id}`,
        { headers: { 'Authorization': `Bearer ${spotify.getAccessToken()}` } }
      );
      
      if (albumResponse.ok) {
        const album = await albumResponse.json();
        if (album && Array.isArray(album.genres) && album.genres.length > 0) {
          const formattedGenres = formatGenres(album.genres);
          trackGenreCache.set(trackId, formattedGenres);
          return formattedGenres;
        }
        
        // Fallback 2: Try album artists' genres
        if (album && Array.isArray(album.artists) && album.artists.length > 0) {
          const albumArtistIds = album.artists.map((artist: any) => artist.id).filter(Boolean);
          if (albumArtistIds.length > 0) {
            // Check if these are the same as track artists before making another API call
            const newArtistIds = albumArtistIds.filter((id: string) => !artistIds.includes(id));
            if (newArtistIds.length > 0) {
              // Add a small delay before making the artist request to avoid rate limiting
              await new Promise(resolve => setTimeout(resolve, 200 + Math.random() * 300));
              
              const genresFromAlbumArtists = await getGenresFromArtists(newArtistIds);
              if (genresFromAlbumArtists.length > 0) {
                trackGenreCache.set(trackId, genresFromAlbumArtists);
                return genresFromAlbumArtists;
              }
            }
          }
        }
      } else if (albumResponse.status === 429) {
        // If rate limited on album request, increase consecutive failures and wait
        consecutiveFailures++;
        await new Promise(resolve => setTimeout(resolve, COOL_DOWN_PERIOD));
      }
    }
    
    // Fallback 3: Return default genres for specific artist names
    const artistNames = track.artists.map((artist: any) => artist.name.toLowerCase());
    const defaultGenres = getDefaultGenresByArtistName(artistNames);
    if (defaultGenres.length > 0) {
      trackGenreCache.set(trackId, defaultGenres);
      return defaultGenres;
    }
    
    // No genres found
    trackGenreCache.set(trackId, []);
    return [];
  }
  catch (error) {
    console.error(`Error getting genres for track ${trackId}:`, error);
    // Increment consecutive failures counter
    consecutiveFailures++;
    // Cache the failure to prevent repeated failing requests
    trackGenreCache.set(trackId, []);
    return [];
  }
};

// Helper function to get default genres based on artist name keywords
function getDefaultGenresByArtistName(artistNames: string[]): string[] {
  const genreMap: Record<string, string[]> = {
    // Electronic/Dance
    'dj': ['Electronic', 'Dance'],
    'electronic': ['Electronic'],
    'edm': ['Electronic', 'EDM'],
    'techno': ['Electronic', 'Techno'],
    'house': ['Electronic', 'House'],
    'trance': ['Electronic', 'Trance'],
    'dubstep': ['Electronic', 'Dubstep'],
    
    // Hip-Hop/Rap
    'rap': ['Hip Hop', 'Rap'],
    'hip hop': ['Hip Hop'],
    'hip-hop': ['Hip Hop'],
    
    // Rock
    'rock': ['Rock'],
    'metal': ['Metal', 'Rock'],
    'punk': ['Punk', 'Rock'],
    'alternative': ['Alternative', 'Rock'],
    'indie': ['Indie', 'Alternative'],
    
    // Pop
    'pop': ['Pop'],
    
    // Other genres
    'jazz': ['Jazz'],
    'blues': ['Blues'],
    'country': ['Country'],
    'folk': ['Folk'],
    'classical': ['Classical'],
    'reggae': ['Reggae'],
    'r&b': ['R&B', 'Soul'],
    'soul': ['Soul', 'R&B'],
    'funk': ['Funk'],
    'disco': ['Disco'],
    'latin': ['Latin']
  };
  
  const matchedGenres = new Set<string>();
  
  // Check each artist name against our keyword map
  artistNames.forEach(name => {
    for (const [keyword, genres] of Object.entries(genreMap)) {
      if (name.includes(keyword)) {
        genres.forEach(genre => matchedGenres.add(genre));
      }
    }
  });
  
  return formatGenres(Array.from(matchedGenres));
}

// Process the request queue with throttling
async function processRequestQueue() {
  if (isProcessingQueue || requestQueue.length === 0) return;
  
  isProcessingQueue = true;
  
  try {
    while (requestQueue.length > 0) {
      // Ensure we're not making requests too quickly
      const now = Date.now();
      const timeElapsed = now - lastRequestTime;
      
      if (timeElapsed < MIN_REQUEST_INTERVAL) {
        await new Promise(resolve => setTimeout(resolve, MIN_REQUEST_INTERVAL - timeElapsed + 50)); // Added extra 50ms buffer
      }
      
      // Execute the next request
      const request = requestQueue.shift();
      if (request) {
        lastRequestTime = Date.now();
        await request();
      }
      
      // Increased pause between requests to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, MIN_REQUEST_INTERVAL + 100));
    }
  } catch (error) {
    console.error('Error processing request queue:', error);
  } finally {
    isProcessingQueue = false;
    
    // If there are new requests that were added while processing
    if (requestQueue.length > 0) {
      processRequestQueue();
    }
  }
}

// Queue a request and start processing
function queueRequest<T>(requestFn: () => Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    requestQueue.push(async () => {
      try {
        const result = await requestFn();
        resolve(result);
      } catch (error) {
        reject(error);
      }
    });
    
    // Start processing if not already processing
    if (!isProcessingQueue) {
      processRequestQueue();
    }
  });
}

// Helper to handle fetch with retry for rate limiting
async function fetchWithRetry(
  url: string, 
  options: RequestInit, 
  maxRetries = 5, 
  initialDelayMs = 2000
): Promise<Response> {
  let retries = 0;
  let delayMs = initialDelayMs;
  
  while (true) {
    try {
      // Queue the actual fetch request
      const response = await queueRequest(() => fetch(url, options));
      
      // If we get a 429 (Too Many Requests), respect the Retry-After header
      if (response.status === 429) {
        if (retries >= maxRetries) {
          console.error(`Exceeded maximum retries (${maxRetries}) for URL: ${url}`);
          return response; // Return the 429 response to be handled by the caller
        }
        
        // Get retry delay from header or use exponential backoff with jitter
        const retryAfter = response.headers.get('Retry-After');
        let waitTime = retryAfter ? parseInt(retryAfter) * 1000 : delayMs;
        
        // Add jitter (±20%) to prevent synchronized retries
        const jitter = Math.random() * 0.4 - 0.2; // Random value between -0.2 and 0.2
        waitTime = Math.floor(waitTime * (1 + jitter));
        
        console.warn(`Rate limited by Spotify API. Retrying after ${waitTime}ms for URL: ${url}`);
        // Wait longer for each retry - exponential backoff
        await new Promise(resolve => setTimeout(resolve, waitTime));
        
        retries++;
        delayMs = Math.min(delayMs * 2, RATE_LIMIT_RESET_TIME * 1.5); // Cap at 1.5 minutes
      } else {
        return response; // Return response for any other status code
      }
    } catch (error) {
      if (retries >= maxRetries) {
        console.error(`Network error after ${maxRetries} retries for URL: ${url}`, error);
        throw error;
      }
      
      console.warn(`Network error when fetching ${url}. Retrying after ${delayMs}ms...`, error);
      await new Promise(resolve => setTimeout(resolve, delayMs));
      
      retries++;
      delayMs = Math.min(delayMs * 2, RATE_LIMIT_RESET_TIME * 1.5); // Cap at 1.5 minutes
    }
  }
}

// Helper function to get genres from artists efficiently
async function getGenresFromArtists(artistIds: string[]): Promise<string[]> {
  const allGenres: string[] = [];
  const uncachedIds: string[] = [];
  
  // Check cache first
  artistIds.forEach((id: string) => {
    if (artistGenreCache.has(id)) {
      const cachedGenres = artistGenreCache.get(id) || [];
      allGenres.push(...cachedGenres);
    } else {
      uncachedIds.push(id);
    }
  });
  
  // Fetch uncached artists in batches (Spotify API limit: 50)
  if (uncachedIds.length > 0) {
    // Process in smaller batches to reduce API load
    const batchSize = 10; // Reduce from 20 to 10 for even better throttling
    
    for (let i = 0; i < uncachedIds.length; i += batchSize) {
      const batch = uncachedIds.slice(i, i + batchSize);
      
      try {
        // Add delay between batches if processing multiple
        if (i > 0) {
          await new Promise(resolve => setTimeout(resolve, 700 + Math.random() * 300));
        }
        
        const response = await fetchWithRetry(
          `https://api.spotify.com/v1/artists?ids=${batch.join(',')}`,
          { headers: { 'Authorization': `Bearer ${spotify.getAccessToken()}` } }
        );
        
        if (!response.ok) {
          if (response.status === 401 || response.status === 403) {
            await refreshToken();
            // Don't retry here to avoid potential infinite recursion
            // The next call to getTrackGenres will use the new token
            continue;
          } else if (response.status === 429) {
            // If rate limited, wait longer and skip this batch
            const retryAfter = response.headers.get('Retry-After');
            const waitTime = retryAfter ? (parseInt(retryAfter) * 1000) : COOL_DOWN_PERIOD;
            console.warn(`Rate limited on artist batch. Waiting ${waitTime}ms`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
            consecutiveFailures++;
            continue;
          }
          console.error(`Failed to fetch artist batch: ${response.status}`);
          continue;
        }
        
        const data = await response.json();
        if (data.artists && Array.isArray(data.artists)) {
          data.artists.forEach((artist: any) => {
            if (artist && artist.id) {
              const genres = Array.isArray(artist.genres) ? formatGenres(artist.genres) : [];
              artistGenreCache.set(artist.id, genres);
              allGenres.push(...genres);
            }
          });
        }
      } catch (error) {
        console.error('Error fetching artist batch:', error);
        consecutiveFailures++;
      }
    }
  }
  
  // Return unique, sorted genres
  return Array.from(new Set(allGenres)).sort();
}

// Helper function to format genres consistently
function formatGenres(genres: string[]): string[] {
  // Deduplicate and format genres
  const uniqueGenres = new Set<string>();
  
  genres.forEach(genre => {
    // Format: Capitalize each word
    const formattedGenre = genre.split(' ').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    ).join(' ');
    
    uniqueGenres.add(formattedGenre);
  });
  
  // Convert to array and sort alphabetically
  return Array.from(uniqueGenres).sort();
}

// Function to play a specific track
export const playTrack = async (uri: string) => {
  if (!(await ensureValidToken())) {
    throw new Error('Token expired');
  }
  
  try {
    // Use fetch API directly for more control
    const response = await fetch('https://api.spotify.com/v1/me/player/play', {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${spotify.getAccessToken()}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        uris: [uri]
      })
    });
    
    if (!response.ok) {
      // Handle specific error cases
      if (response.status === 404) {
        throw new Error('No active device found. Please open Spotify on a device first.');
      } else {
        throw new Error(`Failed to play track: ${response.status}`);
      }
    }
    
    return true;
  } catch (error: any) {
    console.error('Error playing track:', error);
    throw error;
  }
};

// Function to pause playback
export const pauseTrack = async () => {
  if (!(await ensureValidToken())) {
    throw new Error('Token expired');
  }
  
  try {
    // Use fetch API directly
    const response = await fetch('https://api.spotify.com/v1/me/player/pause', {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${spotify.getAccessToken()}`
      }
    });
    
    if (!response.ok) {
      // Handle specific error cases
      if (response.status === 404) {
        throw new Error('No active device found');
      } else {
        throw new Error(`Failed to pause playback: ${response.status}`);
      }
    }
    
    return true;
  } catch (error: any) {
    console.error('Error pausing playback:', error);
    throw error;
  }
};

// Update getTrackAudioFeatures to handle errors better
export const getTrackAudioFeatures = async (trackId: string) => {
  try {
    // First ensure we have a valid token
    const token = await ensureValidToken();
    console.log(`[getTrackAudioFeatures] Token for track ${trackId}:`, token ? token.substring(0, 10) + '...' : 'No token');
    if (!token) {
      throw new Error('No valid token available');
    }

    // Set the token in the Spotify instance for spotify-web-api-js
    spotify.setAccessToken(token);
    console.log(`[getTrackAudioFeatures] Token set in spotify-web-api-js instance for ${trackId}`);

    // Try to get audio features directly through the Spotify Web API
    try {
      console.log(`[getTrackAudioFeatures] Attempting spotify.getAudioFeaturesForTrack for ${trackId}`);
      const features = await spotify.getAudioFeaturesForTrack(trackId);
      if (features) {
        console.log(`[getTrackAudioFeatures] Features loaded via spotify.getAudioFeaturesForTrack for ${trackId}`);
        return features;
      }
      console.log(`[getTrackAudioFeatures] spotify.getAudioFeaturesForTrack returned no features for ${trackId}`);
    } catch (spotifyError) {
      console.log(`[getTrackAudioFeatures] spotify.getAudioFeaturesForTrack failed for ${trackId}:`, spotifyError);
      console.log('[getTrackAudioFeatures] Spotify Web API failed, trying direct fetch:', spotifyError); // Explicitly log this
    }

    // Fallback to direct fetch if Spotify Web API fails
    console.log(`[getTrackAudioFeatures] Attempting direct fetch for audio-features for ${trackId}`);
    const response = await fetch(`https://api.spotify.com/v1/audio-features/${trackId}`, {
      headers: { 
        Authorization: `Bearer ${token}`, // Using token from ensureValidToken
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        // If we get an auth error, try to refresh the token
        const newToken = await ensureValidToken();
        if (!newToken) {
          throw new Error('Authentication failed');
        }
        
        // Retry the request with the new token
        const retryResponse = await fetch(`https://api.spotify.com/v1/audio-features/${trackId}`, {
          headers: { 
            Authorization: `Bearer ${newToken}`,
            'Content-Type': 'application/json'
          }
        });
        
        if (!retryResponse.ok) {
          throw new Error(`Failed to fetch audio features: ${retryResponse.status}`);
        }
        
        return await retryResponse.json();
      }
      throw new Error(`Failed to fetch audio features: ${response.status}`);
    }
    
    const featuresData = await response.json();
    return featuresData;
  } catch (error) {
    console.error('Error fetching audio features:', error);
    throw error;
  }
};

export default spotify;

// Get detailed information about a specific playlist
export const getPlaylistDetails = async (playlistId: string) => {
  try {
    const response = await spotify.getPlaylist(playlistId);
    return response;
  } catch (error) {
    console.error('Error fetching playlist details:', error);
    throw error;
  }
};

// Get the user's followed artists
export const getUserFollowedArtists = async (limit = 50) => {
  try {
    const response = await spotify.getFollowedArtists({ limit });
    return response.artists;
  } catch (error) {
    console.error('Error fetching followed artists:', error);
    throw error;
  }
};

// Get the user's followers (currently Spotify API doesn't provide direct access to followers)
// This is a placeholder function that returns profile data with followers count
export const getUserFollowers = async () => {
  try {
    const response = await spotify.getMe();
    return {
      total: response.followers?.total || 0,
      // The Spotify API doesn't provide a way to get the actual followers
      items: []
    };
  } catch (error) {
    console.error('Error fetching user followers:', error);
    throw error;
  }
};

// Follow a playlist
export const followPlaylist = async (playlistId: string) => {
  try {
    await spotify.followPlaylist(playlistId);
    return true;
  } catch (error) {
    console.error('Error following playlist:', error);
    return false;
  }
};

// Unfollow a playlist
export const unfollowPlaylist = async (playlistId: string) => {
  try {
    await spotify.unfollowPlaylist(playlistId);
    return true;
  } catch (error) {
    console.error('Error unfollowing playlist:', error);
    return false;
  }
};

// Check if current user follows a playlist
export const checkUserFollowsPlaylists = async (playlistId: string, userId: string) => {
  try {
    const response = await spotify.areFollowingPlaylist(playlistId, [userId]);
    return response[0];
  } catch (error) {
    console.error('Error checking if user follows playlist:', error);
    return false;
  }
};

// Add signOut function to clear session and redirect to login page
export const signOut = () => {
  // Clear all data in localStorage
  localStorage.removeItem('spotify_token');
  localStorage.removeItem('spotify_token_expires_at');
  localStorage.removeItem('spotify-storage');
  
  // Redirect to login page
  window.location.href = '/';
};
