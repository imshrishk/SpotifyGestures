import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface User {
  id: string;
  display_name: string;
  images?: { url: string }[];
  followers?: { total: number };
  product?: string;
}

interface AudioFeatures {
  energy?: number;
  danceability?: number;
  valence?: number;
  acousticness?: number;
  tempo?: number;
  liveness?: number;
  speechiness?: number;
  instrumentalness?: number;
}

interface AudioAnalysis {
  beats?: Array<{start: number; duration: number; confidence: number}>;
  bars?: Array<{start: number; duration: number; confidence: number}>;
  tatums?: Array<{start: number; duration: number; confidence: number}>;
  sections?: Array<{start: number; duration: number; confidence: number; loudness: number; tempo: number}>;
  segments?: Array<{
    start: number;
    duration: number;
    confidence: number;
    loudness_start: number;
    loudness_max: number;
    pitches: number[];
    timbre: number[];
  }>;
}

// Try to load cached user data
const loadCachedUser = (): User | null => {
  try {
    const userData = localStorage.getItem('spotify_user');
    if (userData) {
      return JSON.parse(userData);
    }
  } catch (error) {
    console.error('Error loading cached user data:', error);
  }
  return null;
};

// Try to load cached token
const loadCachedToken = (): string | null => {
  return localStorage.getItem('spotify_token');
};

interface SpotifyState {
  token: string | null;
  user: User | null;
  currentTrack: SpotifyApi.TrackObjectFull | null;
  queue: any[];
  isPlaying: boolean;
  volume: number;
  error: string | null;
  progress_ms: number | null;
  audioFeatures: AudioFeatures | null;
  audioAnalysis: AudioAnalysis | null;
  setToken: (token: string) => void;
  setUser: (user: User) => void;
  setCurrentTrack: (track: SpotifyApi.TrackObjectFull | null) => void;
  setQueue: (queue: any[]) => void;
  setIsPlaying: (isPlaying: boolean) => void;
  setVolume: (volume: number) => void;
  setError: (error: string | null) => void;
  setProgressMs: (progress_ms: number | null) => void;
  setAudioFeatures: (features: AudioFeatures | null) => void;
  setAudioAnalysis: (analysis: AudioAnalysis | null) => void;
  clearSession: () => void;
}

export const useSpotifyStore = create<SpotifyState>()(
  persist(
    (set) => ({
      token: loadCachedToken(),
      user: loadCachedUser(),
      currentTrack: null,
      queue: [],
      isPlaying: false,
      volume: 50,
      error: null,
      progress_ms: null,
      audioFeatures: null,
      audioAnalysis: null,
      setToken: (token) => set({ token, error: null }),
      setUser: (user) => set({ user }),
      setCurrentTrack: (currentTrack) => set({ currentTrack }),
      setQueue: (queue) => set({ queue }),
      setIsPlaying: (isPlaying) => set({ isPlaying }),
      setVolume: (volume) => set({ volume }),
      setError: (error) => set({ error }),
      setProgressMs: (progress_ms) => set({ progress_ms }),
      setAudioFeatures: (audioFeatures) => set({ audioFeatures }),
      setAudioAnalysis: (audioAnalysis) => set({ audioAnalysis }),
      clearSession: () => {
        // Clear localStorage data
        localStorage.removeItem('spotify_token');
        localStorage.removeItem('spotify_token_expiration');
        localStorage.removeItem('spotify_user');
        
        // Clear store state
        set({
        token: null,
        user: null,
        currentTrack: null,
        queue: [],
        isPlaying: false,
        error: null,
        progress_ms: null,
        audioFeatures: null,
        audioAnalysis: null
        });
      },
    }),
    {
      name: 'spotify-storage',
    }
  )
);

export default useSpotifyStore;
