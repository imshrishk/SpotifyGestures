/**
 * High-performance rate limiter for handling 1000+ concurrent users
 * Implements token bucket algorithm with Redis-like in-memory storage
 */

interface RateLimitBucket {
  tokens: number;
  lastRefill: number;
  requests: number;
  lastReset: number;
}

interface GlobalRateLimit {
  requests: number;
  windowStart: number;
  backoffUntil: number;
}

class RateLimiter {
  private buckets = new Map<string, RateLimitBucket>();
  private globalLimit: GlobalRateLimit = {
    requests: 0,
    windowStart: Date.now(),
    backoffUntil: 0
  };
  
  // Rate limiting configuration
  private readonly MAX_REQUESTS_PER_MINUTE = 1000; // Per user
  private readonly MAX_GLOBAL_REQUESTS_PER_MINUTE = 50000; // Global limit
  private readonly BUCKET_SIZE = 100; // Tokens per bucket
  private readonly REFILL_RATE = 100; // Tokens per minute
  private readonly WINDOW_SIZE = 60000; // 1 minute
  private readonly CLEANUP_INTERVAL = 300000; // 5 minutes
  
  constructor() {
    // Cleanup old buckets every 5 minutes
    setInterval(() => this.cleanup(), this.CLEANUP_INTERVAL);
  }
  
  /**
   * Check if request is allowed for a specific user
   */
  isAllowed(userId: string): { allowed: boolean; retryAfter?: number; remaining?: number } {
    const now = Date.now();
    
    // Check global rate limit first
    if (now < this.globalLimit.backoffUntil) {
      return {
        allowed: false,
        retryAfter: Math.ceil((this.globalLimit.backoffUntil - now) / 1000)
      };
    }
    
    // Reset global window if needed
    if (now - this.globalLimit.windowStart > this.WINDOW_SIZE) {
      this.globalLimit.requests = 0;
      this.globalLimit.windowStart = now;
    }
    
    // Check global limit
    if (this.globalLimit.requests >= this.MAX_GLOBAL_REQUESTS_PER_MINUTE) {
      this.globalLimit.backoffUntil = now + 60000; // 1 minute backoff
      return {
        allowed: false,
        retryAfter: 60
      };
    }
    
    // Get or create bucket for user
    let bucket = this.buckets.get(userId);
    if (!bucket) {
      bucket = {
        tokens: this.BUCKET_SIZE,
        lastRefill: now,
        requests: 0,
        lastReset: now
      };
      this.buckets.set(userId, bucket);
    }
    
    // Refill tokens based on time passed
    const timePassed = now - bucket.lastRefill;
    const tokensToAdd = Math.floor((timePassed / 60000) * this.REFILL_RATE);
    bucket.tokens = Math.min(this.BUCKET_SIZE, bucket.tokens + tokensToAdd);
    bucket.lastRefill = now;
    
    // Reset request count if window expired
    if (now - bucket.lastReset > this.WINDOW_SIZE) {
      bucket.requests = 0;
      bucket.lastReset = now;
    }
    
    // Check if user has tokens and hasn't exceeded per-minute limit
    if (bucket.tokens >= 1 && bucket.requests < this.MAX_REQUESTS_PER_MINUTE) {
      bucket.tokens--;
      bucket.requests++;
      this.globalLimit.requests++;
      return {
        allowed: true,
        remaining: bucket.tokens
      };
    }
    
    return {
      allowed: false,
      retryAfter: Math.ceil((this.WINDOW_SIZE - (now - bucket.lastReset)) / 1000)
    };
  }
  
  /**
   * Record a successful request (for adaptive rate limiting)
   */
  recordSuccess(_userId: string): void {
    // Could implement adaptive rate limiting here
    // For now, just track success
  }
  
  /**
   * Record a failed request (for circuit breaker)
   */
  recordFailure(_userId: string): void {
    const bucket = this.buckets.get(_userId);
    if (bucket) {
      // Could implement failure tracking here
    }
  }
  
  /**
   * Get current status for a user
   */
  getStatus(userId: string): { tokens: number; requests: number; resetTime: number } {
    const bucket = this.buckets.get(userId);
    if (!bucket) {
      return { tokens: this.BUCKET_SIZE, requests: 0, resetTime: Date.now() + this.WINDOW_SIZE };
    }
    
    const now = Date.now();
    const timePassed = now - bucket.lastRefill;
    const tokensToAdd = Math.floor((timePassed / 60000) * this.REFILL_RATE);
    const currentTokens = Math.min(this.BUCKET_SIZE, bucket.tokens + tokensToAdd);
    
    return {
      tokens: currentTokens,
      requests: bucket.requests,
      resetTime: bucket.lastReset + this.WINDOW_SIZE
    };
  }
  
  /**
   * Cleanup old buckets to prevent memory leaks
   */
  private cleanup(): void {
    const now = Date.now();
    const cutoff = now - (this.WINDOW_SIZE * 2); // Keep buckets for 2 windows
    
    for (const [userId, bucket] of this.buckets.entries()) {
      if (bucket.lastRefill < cutoff) {
        this.buckets.delete(userId);
      }
    }
    
    console.log(`[RateLimiter] Cleaned up buckets. Active buckets: ${this.buckets.size}`);
  }
  
  /**
   * Get statistics for monitoring
   */
  getStats(): {
    activeUsers: number;
    globalRequests: number;
    globalWindowStart: number;
    memoryUsage: number;
  } {
    return {
      activeUsers: this.buckets.size,
      globalRequests: this.globalLimit.requests,
      globalWindowStart: this.globalLimit.windowStart,
      memoryUsage: this.buckets.size * 100 // Rough estimate
    };
  }
}

// Global rate limiter instance
export const rateLimiter = new RateLimiter();

/**
 * Middleware function to check rate limits
 */
export function checkRateLimit(userId: string): { allowed: boolean; retryAfter?: number; remaining?: number } {
  return rateLimiter.isAllowed(userId);
}

/**
 * Get user rate limit status
 */
export function getRateLimitStatus(userId: string) {
  return rateLimiter.getStatus(userId);
}

/**
 * Get global rate limiter statistics
 */
export function getRateLimitStats() {
  return rateLimiter.getStats();
}
