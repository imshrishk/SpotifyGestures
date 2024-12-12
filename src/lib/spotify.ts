import SpotifyWebApi from 'spotify-web-api-js';

const spotify = new SpotifyWebApi();

// Ensure environment variables are set correctly
const clientId = import.meta.env.VITE_SPOTIFY_CLIENT_ID;
const redirectUri = import.meta.env.VITE_REDIRECT_URI;

if (!clientId || !redirectUri) {
  throw new Error("Spotify client ID or redirect URI is missing in the environment variables.");
}

// Authorization URL
export const SPOTIFY_AUTH_URL = `https://accounts.spotify.com/authorize?client_id=${clientId}&response_type=token&redirect_uri=${redirectUri}&scope=user-read-private user-read-email user-read-playback-state user-modify-playback-state user-read-currently-playing streaming playlist-read-private user-read-recently-played`;

// Set the access token for subsequent requests
export const setAccessToken = (token: string) => {
  spotify.setAccessToken(token);
};

// Get the current authenticated user's profile
export const getCurrentUser = async () => {
  try {
    return await spotify.getMe();
  } catch (error) {
    console.error('Failed to get user profile:', error);
    throw new Error('Error fetching user profile');
  }
};

// Get current track details
export const getCurrentTrack = async () => {
  try {
    return await spotify.getMyCurrentPlayingTrack();
  } catch (error) {
    console.error('Failed to get current track:', error);
    throw new Error('Error fetching current track');
  }
};

// Fetch the user's playback queue
export const getQueue = async () => {
  try {
    const response = await fetch('https://api.spotify.com/v1/me/player/queue', {
      headers: {
        Authorization: `Bearer ${spotify.getAccessToken()}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch queue');
    }

    return await response.json();
  } catch (error) {
    console.error('Failed to get queue:', error);
    throw new Error('Error fetching queue');
  }
};

// Play or pause the current track
export const playPause = async (playing: boolean) => {
  try {
    if (playing) {
      await spotify.pause();
    } else {
      await spotify.play();
    }
  } catch (error) {
    console.error('Failed to play/pause:', error);
    throw new Error('Error toggling play/pause');
  }
};

// Skip to the next track
export const nextTrack = async () => {
  try {
    await spotify.skipToNext();
  } catch (error) {
    console.error('Failed to skip to next track:', error);
    throw new Error('Error skipping to next track');
  }
};

// Skip to the previous track
export const previousTrack = async () => {
  try {
    await spotify.skipToPrevious();
  } catch (error) {
    console.error('Failed to skip to previous track:', error);
    throw new Error('Error skipping to previous track');
  }
};

// Set the volume for playback
export const setVolume = async (volume: number) => {
  try {
    await spotify.setVolume(volume);
  } catch (error) {
    console.error('Failed to set volume:', error);
    throw new Error('Error setting volume');
  }
};

// Get the current playback state (e.g., playing track, volume)
export const getCurrentTrackDetails = async () => {
  try {
    return await spotify.getMyCurrentPlaybackState();
  } catch (error) {
    console.error('Failed to get current track details:', error);
    throw new Error('Error fetching current track details');
  }
};

// Like a track (save to the user's saved tracks)
export const likeTrack = async (trackId: string) => {
  try {
    await spotify.addToMySavedTracks([trackId]);
  } catch (error) {
    console.error('Failed to like track:', error);
    throw new Error('Error liking track');
  }
};

// Save a track to the user's playlist (first playlist found)
export const saveToPlaylist = async (trackId: string) => {
  try {
    const playlists = await spotify.getUserPlaylists();
    if (playlists.items.length > 0) {
      await spotify.addTracksToPlaylist(playlists.items[0].id, [`spotify:track:${trackId}`]);
    } else {
      console.log('No playlists found.');
    }
  } catch (error) {
    console.error('Failed to save track to playlist:', error);
    throw new Error('Error saving track to playlist');
  }
};

// Shuffle the user's playlist
export const shufflePlaylist = async (shuffle: boolean) => {
  try {
    await spotify.shuffle(shuffle);
  } catch (error) {
    console.error('Failed to shuffle playlist:', error);
    throw new Error('Error shuffling playlist');
  }
};

// Set the repeat mode for playback
export const toggleRepeat = async (mode: 'off' | 'track' | 'context') => {
  try {
    await spotify.setRepeat(mode);
  } catch (error) {
    console.error('Failed to toggle repeat:', error);
    throw new Error('Error toggling repeat');
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

export default spotify;