import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import io, { Socket } from 'socket.io-client';
import { setAccessToken } from '../lib/spotify';

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

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL ?? null;

interface SpotifyState {
  token: string | null;
  user: User | null;
  currentTrack: SpotifyApi.TrackObjectFull | null;
  currentPlaylist: SpotifyApi.PlaylistObjectSimplified | null;
  queue: SpotifyApi.TrackObjectFull[];
  isPlaying: boolean;
  volume: number;
  error: string | null;
  progress_ms: number | null;
  audioFeatures: AudioFeatures | null;
  audioAnalysis: AudioAnalysis | null;
  socket: Socket | null;
  refreshToken: string | null;
  tokenExpiry: number | null;
  setToken: (token: string, expiresIn?: number, refreshToken?: string) => void;
  setUser: (user: User) => void;
  setCurrentTrack: (track: SpotifyApi.TrackObjectFull | null, playlist?: SpotifyApi.PlaylistObjectSimplified | null) => void;
  setQueue: (queue: SpotifyApi.TrackObjectFull[]) => void;
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
  rehydrated: boolean;
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
      let initialTokenExpiry: number | null = null;
      let initialRefreshToken: string | null = null;

      if (storedToken && storedTokenExpiration) {
        const currentTime = new Date().getTime();
        const expiryTime = parseInt(storedTokenExpiration);
        const storedRefreshToken = localStorage.getItem('spotify_refresh_token');
        
        if (currentTime < expiryTime || storedRefreshToken) {
          initialToken = storedToken;
          initialTokenExpiry = expiryTime;
          initialRefreshToken = storedRefreshToken;
          if (storedUser) {
            initialUser = JSON.parse(storedUser);
          }
          try {
            const expiresInSec = initialTokenExpiry
              ? Math.max(0, Math.floor((initialTokenExpiry - Date.now()) / 1000))
              : undefined;
            setAccessToken(storedToken, expiresInSec, storedRefreshToken || undefined);
          } catch (e) {
            console.debug('[useSpotifyStore] failed to restore spotify access token on init', e);
          }
        } else {
          // Clear expired tokens but keep refresh token if it exists
          localStorage.removeItem('spotify_token');
          localStorage.removeItem('spotify_token_expires_at');
          localStorage.removeItem('spotify_user');
        }
      }

      return {
        rehydrated: false,
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
        refreshToken: initialRefreshToken,
        tokenExpiry: initialTokenExpiry,
        setToken: (token, expiresIn = 3600, refreshToken?: string) => {
          console.debug('[useSpotifyStore] setToken called, expiresIn:', expiresIn, 'hasRefresh:', !!refreshToken);
          // Calculate token expiry time
          const expiryTime = new Date().getTime() + (expiresIn * 1000);
          // Store token and expiry
          localStorage.setItem('spotify_token', token);
          localStorage.setItem('spotify_token_expires_at', expiryTime.toString());
          if (refreshToken) {
            localStorage.setItem('spotify_refresh_token', refreshToken);
          }
          set({ token, tokenExpiry: expiryTime, refreshToken: refreshToken || null, error: null });
        },
        setUser: (user) => {
          console.debug('[useSpotifyStore] setUser called for user:', user?.id || 'unknown');
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
          // Only try to connect if SOCKET_URL is set and not empty
          if (!SOCKET_URL) {
            console.log('Socket URL not set, skipping socket connection (this is normal).');
            return;
          }
          try {
            const socket = io(SOCKET_URL, {
              timeout: 5000,
              forceNew: true,
              reconnection: false, // Disable auto-reconnection to reduce noise
            });
            console.debug('[useSpotifyStore] initializing socket to', SOCKET_URL);
            socket.on('connect', () => {
              console.log('Socket connected successfully');
            });
            socket.on('connect_error', (error) => {
              console.log('Socket connection failed (this is normal if socket server is not running):', error.message);
              // Don't set socket to null, just log the error
            });
            socket.on('player-state-update', (state) => {
              set(state);
            });
            set({ socket });
          } catch (error) {
            console.log('Failed to initialize socket (this is normal if socket server is not running):', error);
            // Continue without socket connection
          }
        },
        clearSession: () => {
          try {
            get().socket?.disconnect();
          } catch (error) {
            console.warn('Error disconnecting socket:', error);
          }
          // Clear only Spotify-related localStorage items, preserve PKCE verifier
          try {
            localStorage.removeItem('spotify-storage');
            localStorage.removeItem('spotify_token');
            localStorage.removeItem('spotify_token_expires_at');
            localStorage.removeItem('spotify_refresh_token');
            localStorage.removeItem('spotify_user');
          } catch {
            // Fallback to removing known keys if removeItem is not available
            console.warn('Failed to clear Spotify localStorage items');
          }
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
            refreshToken: null,
            tokenExpiry: null,
          });
        },
        isAuthenticated: () => {
          // Prefer in-memory store values (rehydrated by zustand persist) to avoid
          // reading localStorage repeatedly. Fall back to localStorage for legacy
          // cases where the store hasn't been rehydrated yet.
          const state = get();
          if (state.token && state.user && state.tokenExpiry) {
            return Date.now() < state.tokenExpiry;
          }

          const storedToken = localStorage.getItem('spotify_token');
          const storedTokenExpiration = localStorage.getItem('spotify_token_expires_at');
          const storedRefreshToken = localStorage.getItem('spotify_refresh_token');
          const storedUser = localStorage.getItem('spotify_user');

          return !!(
            (storedToken && storedTokenExpiration && 
             Date.now() < parseInt(storedTokenExpiration) && 
             storedUser) ||
            (storedRefreshToken && storedUser)
          );
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
      // Called by zustand-persist after rehydration; mark store as rehydrated
      onRehydrateStorage: () => (state) => {
        try {
          if (state) {
            (state as unknown as { rehydrated?: boolean }).rehydrated = true;
          }
        } catch (e) {
          console.debug('[useSpotifyStore] onRehydrateStorage failed to mark rehydrated', e);
        }
      }
    }
  )
);

export default useSpotifyStore;
