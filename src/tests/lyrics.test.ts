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

  it('should fetch lyrics from Genius API', async () => {
    // Mock successful Genius search and scrape flow
    global.fetch = vi.fn()
      // First call: Search API
      .mockImplementationOnce(() => Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          response: {
            sections: [{
              hits: [{
                result: {
                  primary_artist: { name: 'Test Artist' },
                  url: 'https://genius.com/song-url'
                }
              }]
            }]
          }
        })
      } as Response))
      // Second call: Page scrape
      .mockImplementationOnce(() => Promise.resolve({
        ok: true,
        text: () => Promise.resolve(`
          <html>
            <body>
              <div data-lyrics-container="true">Test lyrics content that is definitely longer than fifty characters so it passes the length check in the function</div>
            </body>
          </html>
        `)
      } as Response));

    // Mock Spotify track fetch which happens inside getLyrics
    const { spotify } = await import('../lib/spotify');
    spotify.getTrack = vi.fn().mockResolvedValue({
      name: 'Test Song',
      artists: [{ name: 'Test Artist' }]
    });

    const result = await getLyrics('test-track-id');
    expect(result.lyrics).toBe('Test lyrics content that is definitely longer than fifty characters so it passes the length check in the function');
    expect(result.syncedLyrics).toBeNull();
  });

  it('should handle API failures gracefully', async () => {
    global.fetch = vi.fn(() => Promise.reject(new Error('API Error')));
    const { spotify } = await import('../lib/spotify');
    spotify.getTrack = vi.fn().mockResolvedValue({
      name: 'Test Song',
      artists: [{ name: 'Test Artist' }]
    });

    const result = await getLyrics('test-track-id');
    expect(result.lyrics).toBeNull();
    expect(result.syncedLyrics).toBeNull();
  });
});