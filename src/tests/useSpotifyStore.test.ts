import { describe, it, expect, beforeEach } from 'vitest';
import { useSpotifyStore } from '../stores/useSpotifyStore';

describe('useSpotifyStore', () => {
  beforeEach(() => {
    localStorage.clear();
    useSpotifyStore.getState().clearSession();
  });

  it('should initialize with null token and user', () => {
    const state = useSpotifyStore.getState();
    expect(state.token).toBeNull();
    expect(state.user).toBeNull();
  });

  it('should set and store token', () => {
    const token = 'test-token';
    useSpotifyStore.getState().setToken(token);
    expect(useSpotifyStore.getState().token).toBe(token);
    expect(localStorage.getItem('spotify_token')).toBe(token);
  });

  it('should set and store user', () => {
    const user = { 
      id: 'test-id', 
      display_name: 'Test User',
      email: 'test@example.com',
      uri: 'spotify:user:test-id',
      href: 'https://api.spotify.com/v1/users/test-id',
      type: 'user',
      images: [{ url: 'test-image.jpg', height: 300, width: 300 }],
      followers: { total: 10, href: null },
      product: 'premium',
      explicit_content: { filter_enabled: false, filter_locked: false },
      external_urls: { spotify: 'https://open.spotify.com/user/test-id' },
      country: 'US'
    };
    useSpotifyStore.getState().setUser(user);
    expect(useSpotifyStore.getState().user).toEqual(user);
    expect(JSON.parse(localStorage.getItem('spotify_user') || '')).toEqual(user);
  });

  it('should clear session data', () => {
    // Set some data first
    const token = 'test-token';
    const user = { 
      id: 'test-id', 
      display_name: 'Test User',
      email: 'test@example.com',
      uri: 'spotify:user:test-id',
      href: 'https://api.spotify.com/v1/users/test-id',
      type: 'user',
      images: [{ url: 'test-image.jpg', height: 300, width: 300 }],
      followers: { total: 10, href: null },
      product: 'premium',
      explicit_content: { filter_enabled: false, filter_locked: false },
      external_urls: { spotify: 'https://open.spotify.com/user/test-id' },
      country: 'US'
    };
    useSpotifyStore.getState().setToken(token);
    useSpotifyStore.getState().setUser(user);

    // Clear session
    useSpotifyStore.getState().clearSession();

    // Verify everything is cleared
    const state = useSpotifyStore.getState();
    expect(state.token).toBeNull();
    expect(state.user).toBeNull();
    expect(state.currentTrack).toBeNull();
    expect(state.queue).toEqual([]);
    expect(state.isPlaying).toBeFalsy();
    expect(localStorage.getItem('spotify_token')).toBeNull();
    expect(localStorage.getItem('spotify_user')).toBeNull();
  });

  it('should detect when authenticated', () => {
    // Set valid auth data
    const token = 'test-token';
    const expiresAt = Date.now() + 3600000; // 1 hour from now
    const user = { id: 'test-id', display_name: 'Test User' };

    localStorage.setItem('spotify_token', token);
    localStorage.setItem('spotify_token_expires_at', expiresAt.toString());
    localStorage.setItem('spotify_user', JSON.stringify(user));

    useSpotifyStore.getState().setToken(token);
    useSpotifyStore.getState().setUser(user);

    expect(useSpotifyStore.getState().isAuthenticated()).toBeTruthy();
  });

  it('should detect when not authenticated', () => {
    // Don't set any auth data
    expect(useSpotifyStore.getState().isAuthenticated()).toBeFalsy();

    // Set expired token
    const token = 'test-token';
    const expiresAt = Date.now() - 3600000; // 1 hour ago
    const user = { id: 'test-id', display_name: 'Test User' };

    localStorage.setItem('spotify_token', token);
    localStorage.setItem('spotify_token_expires_at', expiresAt.toString());
    localStorage.setItem('spotify_user', JSON.stringify(user));

    expect(useSpotifyStore.getState().isAuthenticated()).toBeFalsy();
  });
});