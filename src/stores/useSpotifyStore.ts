import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface User {
  id: string;
  display_name: string;
  images?: { url: string }[];
}

interface SpotifyState {
  token: string | null;
  user: User | null;
  currentTrack: any | null;
  queue: any[];
  isPlaying: boolean;
  volume: number;
  error: string | null;
  setToken: (token: string) => void;
  setUser: (user: User) => void;
  setCurrentTrack: (track: any) => void;
  setQueue: (queue: any[]) => void;
  setIsPlaying: (isPlaying: boolean) => void;
  setVolume: (volume: number) => void;
  setError: (error: string | null) => void;
  clearSession: () => void;
}

export const useSpotifyStore = create<SpotifyState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      currentTrack: null,
      queue: [],
      isPlaying: false,
      volume: 50,
      error: null,
      setToken: (token) => set({ token, error: null }),
      setUser: (user) => set({ user }),
      setCurrentTrack: (currentTrack) => set({ currentTrack }),
      setQueue: (queue) => set({ queue }),
      setIsPlaying: (isPlaying) => set({ isPlaying }),
      setVolume: (volume) => set({ volume }),
      setError: (error) => set({ error }),
      clearSession: () => set({
        token: null,
        user: null,
        currentTrack: null,
        queue: [],
        isPlaying: false,
        error: null
      }),
    }),
    {
      name: 'spotify-storage',
    }
  )
);

export default useSpotifyStore;
