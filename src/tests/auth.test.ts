import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { setAccessToken, refreshToken, ensureValidToken, SPOTIFY_AUTH_URL } from '../lib/spotify';
import { generateCodeChallenge, generateCodeVerifier } from '../lib/authCreds';

vi.mock('spotify-web-api-js');
vi.mock('../lib/tokenRefresh', () => ({
  scheduleTokenRefresh: vi.fn(),
  clearTokenRefreshSchedule: vi.fn(),
  initializeTokenRefresh: vi.fn()
}));

describe('Auth Functions', () => {
  let originalLocation: Location;

  beforeEach(() => {
    localStorage.setItem('spotify_token', 'test-token');
    localStorage.setItem('spotify_refresh_token', 'test-refresh-token');
    // Save original location
    originalLocation = window.location;
    // Mock location with a writable object
    delete (window as any).location;
    (window as any).location = { href: '' };
  });

  afterEach(() => {
    // Restore original location
    (window as any).location = originalLocation;
    localStorage.clear();
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it('should generate valid PKCE code verifier', () => {
    const verifier = generateCodeVerifier();
    expect(verifier).toMatch(/^[A-Za-z0-9_-]{43,128}$/);
  });

  it('should generate valid PKCE code challenge', async () => {
    const verifier = 'test-verifier';
    const challenge = await generateCodeChallenge(verifier);
    expect(challenge).toMatch(/^[A-Za-z0-9_-]{43,128}$/);
  });

  it('should manage access and refresh tokens correctly', () => {
    // Test token setter
    const token = 'test-access-token';
    const expiresIn = 3600;
    const refreshToken = 'test-refresh-token';

    // Call setAccessToken with parameters
    setAccessToken(token, expiresIn, refreshToken);

    // Verify stored values
    expect(localStorage.getItem('spotify_token')).toBe(token);
    expect(localStorage.getItem('spotify_refresh_token')).toBe(refreshToken);
    expect(parseInt(localStorage.getItem('spotify_token_expires_at') || '0')).toBeGreaterThan(Date.now());
  });

  it('should refresh tokens using refresh token', async () => {
    // Mock fetch for token refresh
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        access_token: 'new-access-token',
        refresh_token: 'new-refresh-token',
        expires_in: 3600
      })
    });

    // Setup initial tokens
    localStorage.setItem('spotify_refresh_token', 'test-refresh-token');
    localStorage.setItem('spotify_token_expires_at', (Date.now() - 1000).toString());

    // Run refresh
    const result = await refreshToken();

    // Verify refresh request
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('https://accounts.spotify.com/api/token'),
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: expect.stringContaining('refresh_token=test-refresh-token')
      })
    );

    // Verify new tokens were stored
    expect(localStorage.getItem('spotify_token')).toBe('new-access-token');
    expect(localStorage.getItem('spotify_refresh_token')).toBe('new-refresh-token');
    expect(result).toBe('new-access-token');
  });

  it('should handle refresh token errors gracefully', async () => {
    vi.useFakeTimers();

    // Mock fetch to simulate error
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      statusText: 'Bad Request',
      json: () => Promise.resolve({})
    });

    // Run refresh with invalid refresh token
    const refreshPromise = refreshToken();

    await vi.runAllTimersAsync();
    await refreshPromise;

    // Should redirect to auth URL on refresh failure
    expect(window.location.href).toBe(SPOTIFY_AUTH_URL);
  });

  it('should validate tokens correctly', async () => {
    vi.useFakeTimers();
    // Set up valid token
    const token = 'test-token';
    const expiresIn = 3600;
    const refreshTokenStr = 'test-refresh-token';
    setAccessToken(token, expiresIn, refreshTokenStr);

    // Should be valid
    let result = await ensureValidToken();
    expect(result).toBe(token);

    // Mock fetch for refresh token success
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        access_token: 'new-access-token',
        refresh_token: 'new-refresh-token',
        expires_in: 3600
      })
    });

    // Set expired token
    localStorage.setItem('spotify_token_expires_at', (Date.now() - 1000).toString());

    // Should attempt refresh with valid refresh token
    const refreshPromise1 = ensureValidToken();
    await vi.runAllTimersAsync();
    result = await refreshPromise1;
    expect(result).toBe('new-access-token');

    // Mock fetch for refresh token failure
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      statusText: 'Bad Request',
      json: () => Promise.resolve({})
    });

    // Clear refresh token and set expired token
    localStorage.removeItem('spotify_refresh_token');
    localStorage.setItem('spotify_token_expires_at', (Date.now() - 1000).toString());

    // Should redirect to auth URL when token is expired and no refresh token
    const refreshPromise2 = ensureValidToken();
    await vi.runAllTimersAsync();
    result = await refreshPromise2;
    expect(result).toBeNull();
    expect(window.location.href).toBe(SPOTIFY_AUTH_URL);
  });

  it('should retry failed token refresh attempts', async () => {
    vi.useFakeTimers();

    // Mock fetch to fail twice then succeed
    global.fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error'
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error'
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          access_token: 'new-access-token',
          refresh_token: 'new-refresh-token',
          expires_in: 3600
        })
      });

    // Setup expired token with refresh token
    setAccessToken('old-token', -1000, 'test-refresh-token');

    // Should eventually succeed after retries
    const tokenPromise = ensureValidToken();

    // Fast forward enough time for backoff (1s + 2s + ...)
    await vi.advanceTimersByTimeAsync(5000);

    const result = await tokenPromise;
    expect(result).toBe('new-access-token');
    expect(fetch).toHaveBeenCalledTimes(3);
  });
});