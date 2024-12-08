import SpotifyWebApi from 'spotify-web-api-js';

const spotify = new SpotifyWebApi();

export const SPOTIFY_AUTH_URL = `https://accounts.spotify.com/authorize?client_id=${import.meta.env.VITE_SPOTIFY_CLIENT_ID}&response_type=token&redirect_uri=${import.meta.env.VITE_REDIRECT_URI}&scope=user-read-private user-read-email user-read-playback-state user-modify-playback-state user-read-currently-playing streaming playlist-read-private user-read-recently-played`;
export const setAccessToken = (token: string) => {
  spotify.setAccessToken(token);
};

export const getCurrentUser = async () => {
  try {
    return await spotify.getMe();
  } catch (error) {
    console.error('Failed to get user profile:', error);
    throw error;
  }
};

export const getCurrentTrack = async () => {
  try {
    const track = await spotify.getMyCurrentPlayingTrack();
    console.log('Current Track:', track);
    return track;
  } catch (error) {
    console.error('Failed to get current track:', error);
    throw error;
  }
};

export const getQueue = async () => {
  try {
    const response = await fetch('https://api.spotify.com/v1/me/player/queue', {
      headers: {
        'Authorization': `Bearer ${spotify.getAccessToken()}`
      }
    });
    
    if (!response.ok) {
      throw new Error('Failed to fetch queue');
    }
    
    const queue = await response.json();
    console.log('Current Queue:', queue);
    return queue;
  } catch (error) {
    console.error('Failed to get queue:', error);
    throw error;
  }
};

export const playPause = async (playing: boolean) => {
  try {
    if (playing) {
      await spotify.pause();
    } else {
      await spotify.play();
    }
  } catch (error) {
    console.error('Failed to play/pause:', error);
    throw error;
  }
};

export const nextTrack = async () => {
  try {
    await spotify.skipToNext();
  } catch (error) {
    console.error('Failed to skip to next track:', error);
    throw error;
  }
};

export const previousTrack = async () => {
  try {
    await spotify.skipToPrevious();
  } catch (error) {
    console.error('Failed to skip to previous track:', error);
    throw error;
  }
};

export const setVolume = async (volume: number) => {
  try {
    await spotify.setVolume(volume);
  } catch (error) {
    console.error('Failed to set volume:', error);
    throw error;
  }
};

export const getCurrentTrackDetails = async () => {
  try {
    const response = await spotify.getMyCurrentPlaybackState();
    return response;
  } catch (error) {
    console.error('Failed to get current track details:', error);
    throw error;
  }
};

export const likeTrack = async (trackId: string) => {
  try {
    await spotify.addToMySavedTracks([trackId]);
  } catch (error) {
    console.error('Failed to like track:', error);
    throw error;
  }
};

export const saveToPlaylist = async (trackId: string) => {
  try {
    // You might want to implement playlist selection logic here
    const playlists = await spotify.getUserPlaylists();
    if (playlists.items.length > 0) {
      await spotify.addTracksToPlaylist(playlists.items[0].id, [`spotify:track:${trackId}`]);
    }
  } catch (error) {
    console.error('Failed to save track to playlist:', error);
    throw error;
  }
};

export const shufflePlaylist = async (shuffle: boolean) => {
  try {
    await spotify.shuffle(shuffle);
  } catch (error) {
    console.error('Failed to shuffle playlist:', error);
    throw error;
  }
};

export const toggleRepeat = async (mode: 'off' | 'track' | 'context') => {
  try {
    await spotify.setRepeat(mode);
  } catch (error) {
    console.error('Failed to toggle repeat:', error);
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

export default spotify;