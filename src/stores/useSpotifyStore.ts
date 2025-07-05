import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import io, { Socket } from 'socket.io-client';

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

const SOCKET_URL = 'http://localhost:3001';

interface SpotifyState {
  token: string | null;
  user: User | null;
  currentTrack: SpotifyApi.TrackObjectFull | null;
  currentPlaylist: SpotifyApi.PlaylistObjectSimplified | null;
  queue: any[];
  isPlaying: boolean;
  volume: number;
  error: string | null;
  progress_ms: number | null;
  audioFeatures: AudioFeatures | null;
  audioAnalysis: AudioAnalysis | null;
  socket: Socket | null;
  setToken: (token: string) => void;
  setUser: (user: User) => void;
  setCurrentTrack: (track: SpotifyApi.TrackObjectFull | null, playlist?: SpotifyApi.PlaylistObjectSimplified | null) => void;
  setQueue: (queue: any[]) => void;
  removeTrackFromQueue: (trackId: string) => void;
  setIsPlaying: (isPlaying: boolean) => void;
  setVolume: (volume: number) => void;
  setError: (error: string | null) => void;
  setProgressMs: (progress_ms: number | null) => void;
  setAudioFeatures: (features: AudioFeatures | null) => void;
  setAudioAnalysis: (analysis: AudioAnalysis | null) => void;
  initializeSocket: () => void;
  clearSession: () => void;
  isAuthenticated: () => boolean;
}

export const useSpotifyStore = create<SpotifyState>()(
  persist(
    (set, get) => {
      // Initialize auth state immediately when the store is created
      const storedToken = localStorage.getItem('spotify_token');
      const storedTokenExpiration = localStorage.getItem('spotify_token_expires_at');
      const storedUser = localStorage.getItem('spotify_user');

      let initialToken: string | null = null;
      let initialUser: User | null = null;

      if (storedToken && storedTokenExpiration && new Date().getTime() < parseInt(storedTokenExpiration)) {
        initialToken = storedToken;
        if (storedUser) {
          initialUser = JSON.parse(storedUser);
        }
      } else {
        // Clear any expired or invalid tokens
        localStorage.removeItem('spotify_token');
        localStorage.removeItem('spotify_token_expiration');
        localStorage.removeItem('spotify_user');
      }

      return {
        token: initialToken,
        user: initialUser,
        currentTrack: null,
        currentPlaylist: null,
        queue: [],
        isPlaying: false,
        volume: 50,
        error: null,
        progress_ms: null,
        audioFeatures: null,
        audioAnalysis: null,
        socket: null,
        setToken: (token) => {
          // Also update localStorage to keep it in sync
          localStorage.setItem('spotify_token', token);
          set({ token, error: null });
        },
        setUser: (user) => {
          // Also update localStorage to keep it in sync
          localStorage.setItem('spotify_user', JSON.stringify(user));
          set({ user });
        },
        setCurrentTrack: (currentTrack, playlist = null) => {
          set({ currentTrack, currentPlaylist: playlist });
          if (get().socket?.connected) {
            get().socket?.emit('player-state-change', { currentTrack, currentPlaylist: playlist });
          }
        },
        setQueue: (queue) => {
          set({ queue });
          if (get().socket?.connected) {
            get().socket?.emit('player-state-change', { queue });
          }
        },
        removeTrackFromQueue: (trackId: string) => {
          set((state) => ({
            queue: state.queue.filter((item) => item.id !== trackId),
          }));
        },
        setIsPlaying: (isPlaying) => {
          set({ isPlaying });
          if (get().socket?.connected) {
            get().socket?.emit('player-state-change', { isPlaying });
          }
        },
        setVolume: (volume) => {
          set({ volume });
          if (get().socket?.connected) {
            get().socket?.emit('player-state-change', { volume });
          }
        },
        setError: (error) => set({ error }),
        setProgressMs: (progress_ms) => {
          set({ progress_ms });
          if (get().socket?.connected) {
            get().socket?.emit('player-state-change', { progress_ms });
          }
        },
        setAudioFeatures: (audioFeatures) => set({ audioFeatures }),
        setAudioAnalysis: (audioAnalysis) => set({ audioAnalysis }),
        initializeSocket: () => {
          try {
            const socket = io(SOCKET_URL, {
              timeout: 5000,
              forceNew: true,
            });
            
            socket.on('connect', () => {
              console.log('Socket connected successfully');
            });
            
            socket.on('connect_error', (error) => {
              console.warn('Socket connection failed:', error.message);
              // Don't set the socket if connection fails
            });
            
            socket.on('player-state-update', (state) => {
              set(state);
            });
            
            set({ socket });
          } catch (error) {
            console.warn('Failed to initialize socket:', error);
            // Continue without socket connection
          }
        },
        clearSession: () => {
          try {
            get().socket?.disconnect();
          } catch (error) {
            console.warn('Error disconnecting socket:', error);
          }
          // Clear all localStorage items
          localStorage.removeItem('spotify-storage');
          localStorage.removeItem('spotify_token');
          localStorage.removeItem('spotify_token_expires_at');
          localStorage.removeItem('spotify_user');
          set({
            token: null,
            user: null,
            currentTrack: null,
            queue: [],
            isPlaying: false,
            error: null,
            progress_ms: null,
            audioFeatures: null,
            audioAnalysis: null,
            socket: null,
          });
        },
        isAuthenticated: () => {
          const storedToken = localStorage.getItem('spotify_token');
          const storedTokenExpiration = localStorage.getItem('spotify_token_expires_at');
          const storedUser = localStorage.getItem('spotify_user');
          
          return !!(storedToken && storedTokenExpiration && 
                   new Date().getTime() < parseInt(storedTokenExpiration) && 
                   storedUser);
        },
      };
    },
    {
      name: 'spotify-storage',
      // Do not persist the socket connection
      partialize: (state) =>
        Object.fromEntries(
          Object.entries(state).filter(([key]) => !['socket'].includes(key))
        ),
    }
  )
);

export default useSpotifyStore;
