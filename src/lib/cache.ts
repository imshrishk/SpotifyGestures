/**
 * High-performance caching system for handling 1000+ concurrent users
 * Implements LRU cache with TTL and memory management
 */

interface CacheEntry<T> {
  value: T;
  timestamp: number;
  ttl: number;
  accessCount: number;
  lastAccessed: number;
}

interface CacheStats {
  hits: number;
  misses: number;
  evictions: number;
  size: number;
  memoryUsage: number;
  hitRate?: number;
}

class HighPerformanceCache<T> {
  private cache = new Map<string, CacheEntry<T>>();
  private accessOrder = new Map<string, number>();
  private accessCounter = 0;
  
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    evictions: 0,
    size: 0,
    memoryUsage: 0
  };
  
  constructor(
    private maxSize: number = 10000,
    private defaultTtl: number = 300000, // 5 minutes
    private maxMemoryMB: number = 100 // 100MB limit
  ) {
    // Cleanup expired entries every minute
    setInterval(() => this.cleanup(), 60000);
    
    // Memory monitoring every 30 seconds
    setInterval(() => this.monitorMemory(), 30000);
  }
  
  /**
   * Get value from cache
   */
  get(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      this.stats.misses++;
      return null;
    }
    
    // Check if expired
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      this.accessOrder.delete(key);
      this.stats.misses++;
      return null;
    }
    
    // Update access tracking
    entry.accessCount++;
    entry.lastAccessed = Date.now();
    this.accessOrder.set(key, ++this.accessCounter);
    this.stats.hits++;
    
    return entry.value;
  }
  
  /**
   * Set value in cache
   */
  set(key: string, value: T, ttl?: number): void {
    const now = Date.now();
    const entryTtl = ttl || this.defaultTtl;
    
    // Check memory limit before adding
    if (this.shouldEvict()) {
      this.evictLRU();
    }
    
    const entry: CacheEntry<T> = {
      value,
      timestamp: now,
      ttl: entryTtl,
      accessCount: 1,
      lastAccessed: now
    };
    
    this.cache.set(key, entry);
    this.accessOrder.set(key, ++this.accessCounter);
    this.stats.size = this.cache.size;
  }
  
  /**
   * Check if key exists and is not expired
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;
    
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      this.accessOrder.delete(key);
      return false;
    }
    
    return true;
  }
  
  /**
   * Delete specific key
   */
  delete(key: string): boolean {
    const deleted = this.cache.delete(key);
    this.accessOrder.delete(key);
    if (deleted) {
      this.stats.size = this.cache.size;
    }
    return deleted;
  }
  
  /**
   * Clear all entries
   */
  clear(): void {
    this.cache.clear();
    this.accessOrder.clear();
    this.stats.size = 0;
  }
  
  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const hitRate = this.stats.hits + this.stats.misses > 0 
      ? (this.stats.hits / (this.stats.hits + this.stats.misses)) * 100 
      : 0;
    
    return {
      ...this.stats,
      hitRate: Math.round(hitRate * 100) / 100
    };
  }
  
  /**
   * Check if we should evict entries
   */
  private shouldEvict(): boolean {
    return this.cache.size >= this.maxSize || this.getMemoryUsage() > this.maxMemoryMB;
  }
  
  /**
   * Evict least recently used entries
   */
  private evictLRU(): void {
    if (this.cache.size === 0) return;
    
    // Sort by access order and evict oldest 10%
    const entries = Array.from(this.accessOrder.entries())
      .sort((a, b) => a[1] - b[1])
      .slice(0, Math.max(1, Math.floor(this.cache.size * 0.1)));
    
    for (const [key] of entries) {
      this.cache.delete(key);
      this.accessOrder.delete(key);
      this.stats.evictions++;
    }
    
    this.stats.size = this.cache.size;
  }
  
  /**
   * Cleanup expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    let cleaned = 0;
    
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key);
        this.accessOrder.delete(key);
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      this.stats.size = this.cache.size;
      console.log(`[Cache] Cleaned up ${cleaned} expired entries. Active: ${this.cache.size}`);
    }
  }
  
  /**
   * Monitor memory usage
   */
  private monitorMemory(): void {
    const usage = this.getMemoryUsage();
    if (usage > this.maxMemoryMB * 0.8) {
      console.warn(`[Cache] High memory usage: ${usage.toFixed(2)}MB / ${this.maxMemoryMB}MB`);
      // Aggressive cleanup
      this.evictLRU();
    }
  }
  
  /**
   * Estimate memory usage in MB
   */
  private getMemoryUsage(): number {
    // Rough estimation: each entry ~1KB
    return (this.cache.size * 1024) / (1024 * 1024);
  }
}

// Global cache instances for different data types
export const spotifyCache = new HighPerformanceCache<any>(5000, 300000, 50); // 5K entries, 5min TTL, 50MB
export const userCache = new HighPerformanceCache<any>(1000, 600000, 20); // 1K entries, 10min TTL, 20MB
export const queueCache = new HighPerformanceCache<any>(2000, 30000, 30); // 2K entries, 30sec TTL, 30MB

/**
 * Cache key generators
 */
export function getCacheKey(prefix: string, ...parts: (string | number)[]): string {
  return `${prefix}:${parts.join(':')}`;
}

/**
 * Cache with automatic key generation
 */
export function cacheSpotifyData(key: string, data: any, ttl?: number): void {
  spotifyCache.set(key, data, ttl);
}

export function getSpotifyData(key: string): any {
  return spotifyCache.get(key);
}

export function cacheUserData(userId: string, key: string, data: any, ttl?: number): void {
  const cacheKey = getCacheKey('user', userId, key);
  userCache.set(cacheKey, data, ttl);
}

export function getUserData(userId: string, key: string): any {
  const cacheKey = getCacheKey('user', userId, key);
  return userCache.get(cacheKey);
}

export function cacheQueueData(userId: string, data: any): void {
  const cacheKey = getCacheKey('queue', userId);
  queueCache.set(cacheKey, data, 30000); // 30 second TTL for queue
}

export function getQueueData(userId: string): any {
  const cacheKey = getCacheKey('queue', userId);
  return queueCache.get(cacheKey);
}

/**
 * Get all cache statistics
 */
export function getAllCacheStats() {
  return {
    spotify: spotifyCache.getStats(),
    user: userCache.getStats(),
    queue: queueCache.getStats()
  };
}
