import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getLyrics } from '../lib/spotify';

vi.mock('spotify-web-api-js');

describe('Lyrics API', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    localStorage.setItem('spotify_token', 'test-token');
  });

  afterEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    global.fetch = originalFetch;
  });

  it('should fetch lyrics from Spotify API', async () => {
    global.fetch = vi.fn(() => 
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          lines: [
            { startTimeMs: 0, words: 'Line 1' },
            { startTimeMs: 1000, words: 'Line 2' }
          ]
        })
      })
    ) as unknown as typeof fetch;

    const result = await getLyrics('test-track-id');
    expect(result.syncedLyrics).toBeDefined();
    expect(result.syncedLyrics?.length).toBe(2);
    expect(result.syncedLyrics?.[0].text).toBe('Line 1');
  });

  it('should fallback to Musixmatch API if Spotify lyrics are unavailable', async () => {
    global.fetch = vi.fn()
      .mockImplementationOnce(() => Promise.resolve({ ok: false }))
      .mockImplementationOnce(() => Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          lyrics: {
            body: 'Test lyrics content',
            syncType: 'UNSYNCED'
          }
        })
      }));

    const result = await getLyrics('test-track-id');
    expect(result.lyrics).toBe('Test lyrics content');
    expect(result.syncedLyrics).toBeNull();
  });

  it('should handle API failures gracefully', async () => {
    global.fetch = vi.fn(() => Promise.reject(new Error('API Error')));

    const result = await getLyrics('test-track-id');
    expect(result.lyrics).toBeNull();
    expect(result.syncedLyrics).toBeNull();
  });
});