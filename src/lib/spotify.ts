import SpotifyWebApi from 'spotify-web-api-js';

const spotify = new SpotifyWebApi();
const clientId = import.meta.env.VITE_SPOTIFY_CLIENT_ID;
const redirectUri = import.meta.env.VITE_REDIRECT_URI;

if (!clientId || !redirectUri) {
  throw new Error("Spotify client ID or redirect URI is missing in the environment variables.");
}


export const SPOTIFY_AUTH_URL = `https://accounts.spotify.com/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&scope=${encodeURIComponent('user-read-private user-read-email user-modify-playback-state user-read-playback-position user-library-read user-library-modify user-read-playback-state user-read-currently-playing user-read-recently-played user-top-read playlist-modify-public playlist-modify-private')}&response_type=token`;

export const setAccessToken = (token: string) => {
  spotify.setAccessToken(token);
};

export const getCurrentUser = async () => {
  try {
    return await spotify.getMe();
  } catch (error) {
    throw new Error('Error fetching user profile');
  }
};

export const getCurrentTrack = async () => {
  try {
    return await spotify.getMyCurrentPlayingTrack();
  } catch (error) {
    throw new Error('Error fetching current track');
  }
};

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
    throw new Error('Error fetching queue');
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
    throw new Error('Error toggling play/pause');
  }
};

export const nextTrack = async () => {
  try {
    await spotify.skipToNext();
  } catch (error) {
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
    throw new Error('Error setting volume');
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
    await spotify.addToMySavedTracks([trackId]);
  } catch (error) {
    throw new Error('Error liking track');
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
    await spotify.shuffle(shuffle);
  } catch (error) {
    throw new Error('Error shuffling playlist');
  }
};

export const toggleRepeat = async (mode: 'off' | 'track' | 'context') => {
  try {
    await spotify.setRepeat(mode);
  } catch (error) {
    throw new Error('Error toggling repeat');
  }
};

export const getRecommendations = async (trackId: string) => {
  try {
    const response = await spotify.getRecommendations({
      seed_tracks: [trackId],
      limit: 10,
    });
    return response;
  } catch (error) {
    throw new Error('Error fetching recommendations');
  }
};

export const getLyrics = async (trackId: string) => {
  try {
    const musixmatchApiKey = import.meta.env.VITE_MUSIXMATCH_API_KEY;
    const response = await fetch(`https://api.musixmatch.com/ws/1.1/track.lyrics.get?track_id=${trackId}&apikey=${musixmatchApiKey}`);
    const data = await response.json();
    return data.message.body.lyrics.lyrics_body;
  } catch (error) {
    throw new Error('Error fetching lyrics');
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
    const user = await getCurrentUser();
    await spotify.unfollowPlaylist(user.id, playlistId);
  } catch (error) {
    throw new Error('Error deleting playlist');
  }
};

export const getUserPlaylists = async () => {
  try {
    const user = await getCurrentUser();
    return await spotify.getUserPlaylists(user.id);
  } catch (error) {
    throw new Error('Error fetching user playlists');
  }
};

export const getPlaylistTracks = async (playlistId: string) => {
  try {
    return await spotify.getPlaylistTracks(playlistId);
  } catch (error) {
    throw new Error('Error fetching playlist tracks');
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
