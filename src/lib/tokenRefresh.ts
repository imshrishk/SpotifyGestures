import { refreshToken } from './spotify';

let refreshTimeout: number | undefined;
const TOKEN_REFRESH_BUFFER = 5 * 60 * 1000; // 5 minutes before expiry

export function scheduleTokenRefresh(expiresIn: number): void {
  // Clear any existing refresh timer
  if (refreshTimeout) {
    window.clearTimeout(refreshTimeout);
  }

  // Calculate when to refresh (5 minutes before expiry)
  const refreshDelay = (expiresIn * 1000) - TOKEN_REFRESH_BUFFER;
  
  if (refreshDelay <= 0) {
    // Token is already near expiration; do not trigger an immediate refresh here
    // (allow callers like ensureValidToken to perform the refresh). This avoids
    // duplicate concurrent refresh attempts (helps tests and prevents races).
    return;
  }

  // Schedule refresh
  refreshTimeout = window.setTimeout(async () => {
    try {
      await refreshToken();
    } catch (error) {
      console.error('Failed to refresh token:', error);
      // The refreshToken function will handle redirecting to login if needed
    }
  }, refreshDelay);
}

export function clearTokenRefreshSchedule(): void {
  if (refreshTimeout) {
    window.clearTimeout(refreshTimeout);
    refreshTimeout = undefined;
  }
}

// Start background refresh on page load if we have a token
export function initializeTokenRefresh(): void {
  const expiresAt = localStorage.getItem('spotify_token_expires_at');
  const refreshTokenStr = localStorage.getItem('spotify_refresh_token');
  
  if (expiresAt && refreshTokenStr) {
    const expiryTime = parseInt(expiresAt);
    const now = Date.now();
    const timeUntilExpiry = expiryTime - now;
    
    // If token is not expired and we have more than 30 seconds until expiry
    if (timeUntilExpiry > 30000) {
      scheduleTokenRefresh(timeUntilExpiry / 1000);
    } else {
      // Token is expired or close to expiry, refresh now
      void refreshToken();
    }
  }
}

// Listen for visibility changes to handle background refresh
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    // Check and refresh token if needed when tab becomes visible
    const expiresAt = localStorage.getItem('spotify_token_expires_at');
    const refreshTokenStr = localStorage.getItem('spotify_refresh_token');
    
    if (expiresAt && refreshTokenStr) {
      const expiryTime = parseInt(expiresAt);
      const now = Date.now();
      
      if (now >= expiryTime - TOKEN_REFRESH_BUFFER) {
        void refreshToken();
      } else {
        // Re-schedule refresh for remaining time
        scheduleTokenRefresh((expiryTime - now) / 1000);
      }
    }
  }
});