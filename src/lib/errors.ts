export class SpotifyError extends Error {
  constructor(
    public readonly message: string,
    public readonly status?: number,
    public readonly code?: string,
    public readonly shouldRefreshToken = false
  ) {
    super(message);
    this.name = 'SpotifyError';
  }

  static isAuthError(error: unknown): boolean {
    return error instanceof SpotifyError && 
           (error.status === 401 || error.status === 403 || error.shouldRefreshToken);
  }

  static isRateLimitError(error: unknown): boolean {
    return error instanceof SpotifyError && error.status === 429;
  }

  static fromResponse(response: Response, message?: string): SpotifyError {
    let shouldRefreshToken = false;
    
    if (response.status === 401 || response.status === 403) {
      shouldRefreshToken = true;
      message = message || 'Authentication failed';
    } else if (response.status === 429) {
      message = message || 'Rate limit exceeded';
    } else if (response.status >= 500) {
      message = message || 'Spotify server error';
    }

    return new SpotifyError(
      message || `Spotify API error: ${response.status}`,
      response.status,
      undefined,
      shouldRefreshToken
    );
  }
}

export class RetryableError extends SpotifyError {
  constructor(
    message: string,
    status?: number,
    code?: string,
    shouldRefreshToken = false,
    public readonly retryAfter?: number
  ) {
    super(message, status, code, shouldRefreshToken);
    this.name = 'RetryableError';
  }
}

export class TokenError extends SpotifyError {
  constructor(message: string, public readonly invalidToken = false) {
    super(message, undefined, 'TOKEN_ERROR', true);
    this.name = 'TokenError';
  }
}

export class NetworkError extends SpotifyError {
  constructor(message: string) {
    super(message, undefined, 'NETWORK_ERROR');
    this.name = 'NetworkError';
  }
}

export const isRetryableError = (error: unknown): error is RetryableError => {
  // Network errors are always retryable
  if (error instanceof NetworkError) return true;
  
  // Rate limit errors are retryable
  if (SpotifyError.isRateLimitError(error)) return true;
  
  // Server errors (5xx) are retryable
  if (error instanceof SpotifyError && error.status && error.status >= 500) return true;
  
  return false;
};

export const createSpotifyError = async (response: Response): Promise<SpotifyError> => {
  try {
    const data = await response.json();
    const message = data.error?.message || data.error_description || data.error || 'Unknown Spotify API error';
    const code = data.error?.reason || data.error;
    
    if (response.status === 429) {
      const retryAfter = parseInt(response.headers.get('retry-after') || '0');
      return new RetryableError(message, response.status, code, false, retryAfter);
    }
    
    return new SpotifyError(message, response.status, code);
  } catch {
    return SpotifyError.fromResponse(response);
  }
};