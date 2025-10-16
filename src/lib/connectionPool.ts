/**
 * High-performance connection pool and retry system for handling 1000+ concurrent users
 */

import * as Cache from './cache';
import { checkRateLimit } from './rateLimiter';

interface RequestConfig {
  url: string;
  options?: RequestInit;
  retries?: number;
  timeout?: number;
  priority?: 'high' | 'normal' | 'low';
}

interface RetryConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  retryCondition?: (error: any) => boolean;
}

interface ConnectionPoolStats {
  activeRequests: number;
  queuedRequests: number;
  completedRequests: number;
  failedRequests: number;
  averageResponseTime: number;
}

class ConnectionPool {
  private activeRequests = new Map<string, AbortController>();
  private requestQueue: Array<RequestConfig & { resolve: Function; reject: Function; id: string }> = [];
  private stats: ConnectionPoolStats = {
    activeRequests: 0,
    queuedRequests: 0,
    completedRequests: 0,
    failedRequests: 0,
    averageResponseTime: 0
  };
  
  private readonly MAX_CONCURRENT_REQUESTS = 50; // Max concurrent requests
  private readonly MAX_QUEUE_SIZE = 1000; // Max queued requests
  private readonly REQUEST_TIMEOUT = 10000; // 10 seconds default timeout
  private readonly RESPONSE_TIME_HISTORY: number[] = [];
  private readonly MAX_HISTORY_SIZE = 1000;
  
  constructor() {
    // Process queue every 100ms
    setInterval(() => this.processQueue(), 100);
    
    // Cleanup stats every minute
    setInterval(() => this.cleanupStats(), 60000);
  }
  
  /**
   * Make a request with automatic retry and connection pooling
   */
  async request(config: RequestConfig): Promise<Response> {
    const requestId = this.generateRequestId();
    const timeout = config.timeout || this.REQUEST_TIMEOUT;
    
    // Check if we can process immediately
    if (this.activeRequests.size < this.MAX_CONCURRENT_REQUESTS) {
      return this.executeRequest(requestId, config, timeout);
    }
    
    // Queue the request if we're at capacity
    if (this.requestQueue.length >= this.MAX_QUEUE_SIZE) {
      throw new Error('Request queue is full. Please try again later.');
    }
    
    return new Promise((resolve, reject) => {
      this.requestQueue.push({
        ...config,
        resolve,
        reject,
        id: requestId
      });
      this.stats.queuedRequests = this.requestQueue.length;
    });
  }
  
  /**
   * Execute a request with retry logic
   */
  private async executeRequest(requestId: string, config: RequestConfig, timeout: number): Promise<Response> {
    const startTime = Date.now();
    const retryConfig: RetryConfig = {
      maxRetries: config.retries || 3,
      baseDelay: 1000,
      maxDelay: 30000,
      backoffMultiplier: 2,
      retryCondition: (error) => {
        // Retry on network errors, timeouts, and 5xx errors
        if (error.name === 'AbortError') return false; // Don't retry timeouts
        if (error.status >= 500) return true;
        if (error.status === 429) return true; // Rate limiting
        if (error.name === 'TypeError' && error.message.includes('fetch')) return true;
        return false;
      }
    };
    
    let lastError: any;
    
    for (let attempt = 0; attempt <= retryConfig.maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        this.activeRequests.set(requestId, controller);
        this.stats.activeRequests = this.activeRequests.size;
        
        // Set timeout
        const timeoutId = setTimeout(() => {
          controller.abort();
        }, timeout);
        
        const response = await fetch(config.url, {
          ...config.options,
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        // Record successful request
        const responseTime = Date.now() - startTime;
        this.recordResponseTime(responseTime);
        this.stats.completedRequests++;
        
        return response;
        
      } catch (error: any) {
        lastError = error;
        
        // Check if we should retry
        if (attempt < retryConfig.maxRetries && retryConfig.retryCondition!(error)) {
          const delay = Math.min(
            retryConfig.baseDelay * Math.pow(retryConfig.backoffMultiplier, attempt),
            retryConfig.maxDelay
          );
          
          console.warn(`[ConnectionPool] Request failed (attempt ${attempt + 1}), retrying in ${delay}ms:`, error.message);
          await this.sleep(delay);
          continue;
        }
        
        // Don't retry, record failure
        this.stats.failedRequests++;
        break;
        
      } finally {
        this.activeRequests.delete(requestId);
        this.stats.activeRequests = this.activeRequests.size;
      }
    }
    
    throw lastError;
  }
  
  /**
   * Process queued requests
   */
  private async processQueue(): Promise<void> {
    if (this.requestQueue.length === 0 || this.activeRequests.size >= this.MAX_CONCURRENT_REQUESTS) {
      return;
    }
    
    // Sort by priority (high -> normal -> low)
    this.requestQueue.sort((a, b) => {
      const priorityOrder = { high: 3, normal: 2, low: 1 };
      return priorityOrder[b.priority || 'normal'] - priorityOrder[a.priority || 'normal'];
    });
    
    const request = this.requestQueue.shift();
    if (!request) return;
    
    this.stats.queuedRequests = this.requestQueue.length;
    
    try {
      const response = await this.executeRequest(request.id, request, request.timeout || this.REQUEST_TIMEOUT);
      request.resolve(response);
    } catch (error) {
      request.reject(error);
    }
  }
  
  /**
   * Record response time for statistics
   */
  private recordResponseTime(responseTime: number): void {
    this.RESPONSE_TIME_HISTORY.push(responseTime);
    
    if (this.RESPONSE_TIME_HISTORY.length > this.MAX_HISTORY_SIZE) {
      this.RESPONSE_TIME_HISTORY.shift();
    }
    
    // Calculate average response time
    const sum = this.RESPONSE_TIME_HISTORY.reduce((a, b) => a + b, 0);
    this.stats.averageResponseTime = sum / this.RESPONSE_TIME_HISTORY.length;
  }
  
  /**
   * Generate unique request ID
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  /**
   * Cleanup old statistics
   */
  private cleanupStats(): void {
    // Keep only recent response times
    if (this.RESPONSE_TIME_HISTORY.length > this.MAX_HISTORY_SIZE) {
      this.RESPONSE_TIME_HISTORY.splice(0, this.RESPONSE_TIME_HISTORY.length - this.MAX_HISTORY_SIZE);
    }
  }
  
  /**
   * Get connection pool statistics
   */
  getStats(): ConnectionPoolStats {
    return { ...this.stats };
  }
  
  /**
   * Clear all queued requests
   */
  clearQueue(): void {
    this.requestQueue.forEach(request => {
      request.reject(new Error('Request queue cleared'));
    });
    this.requestQueue = [];
    this.stats.queuedRequests = 0;
  }
  
  /**
   * Abort all active requests
   */
  abortAll(): void {
    this.activeRequests.forEach(controller => {
      controller.abort();
    });
    this.activeRequests.clear();
    this.stats.activeRequests = 0;
  }
}

// Global connection pool instance
export const connectionPool = new ConnectionPool();

/**
 * High-level request function with caching and rate limiting
 */
export async function smartRequest(
  url: string, 
  options?: RequestInit, 
  userId?: string,
  cacheKey?: string,
  cacheTtl?: number
): Promise<Response> {
  
  // Check cache first if cacheKey provided
  if (cacheKey && userId) {
    const cached = Cache.getSpotifyData(cacheKey);
    if (cached) {
      // Return cached response as a Response-like object
      return new Response(JSON.stringify(cached), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
  
  // Check rate limiting if userId provided
  if (userId) {
    const rateLimit = checkRateLimit(userId);
    if (!rateLimit.allowed) {
      throw new Error(`Rate limited. Retry after ${rateLimit.retryAfter} seconds`);
    }
  }
  
  // Make request through connection pool
  const response = await connectionPool.request({
    url,
    options,
    timeout: 10000,
    priority: 'normal'
  });
  
  // Cache successful responses
  if (response.ok && cacheKey && userId) {
    try {
      const data = await response.clone().json();
      Cache.cacheSpotifyData(cacheKey, data, cacheTtl);
    } catch (error) {
      // Ignore caching errors
    }
  }
  
  return response;
}

/**
 * Get connection pool statistics
 */
export function getConnectionPoolStats(): ConnectionPoolStats {
  return connectionPool.getStats();
}
