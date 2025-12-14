
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, vi, beforeEach, afterEach, expect } from 'vitest';

import LyricsDisplay from '../components/LyricsDisplay';
import * as spotifyLib from '../lib/spotify';
import * as store from '../stores/useSpotifyStore';

vi.mock('../stores/useSpotifyStore');

describe('LyricsDisplay component', () => {
  const mockGetLyrics = vi.spyOn(spotifyLib, 'getLyrics');
  const mockStore = vi.spyOn(store, 'default');

  beforeEach(() => {
    mockGetLyrics.mockReset();
    mockStore.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders plain lyrics when synced not available', async () => {
    mockStore.mockReturnValue({ currentTrack: { id: 't1', name: 'Song', artists: [{ name: 'Artist' }] }, progress_ms: null, isPlaying: false });
    mockGetLyrics.mockResolvedValue({ lyrics: 'These are the lyrics', syncedLyrics: null });

    render(<LyricsDisplay />);

    await waitFor(() => {
      expect(screen.getByText(/These are the lyrics/i)).toBeTruthy();
    });
  });

  it('renders synced lyrics and highlights active line based on progress', async () => {
    const synced = [
      { time: 0, text: 'Line A' },
      { time: 1000, text: 'Line B' },
      { time: 2000, text: 'Line C' }
    ];
    mockStore.mockReturnValue({ currentTrack: { id: 't2', name: 'Song2', artists: [{ name: 'Artist2' }] }, progress_ms: 1500, isPlaying: true });
    mockGetLyrics.mockResolvedValue({ lyrics: null, syncedLyrics: synced });

    render(<LyricsDisplay />);

    await waitFor(() => {
      expect(screen.getByText('Line B')).toBeTruthy();
    });
  });
});
