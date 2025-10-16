import { SpotifyError, TokenError, isRetryableError } from './errors';
import { ensureValidToken, refreshToken, signOut } from './spotify';

// Types for request queue
interface RequestQueueItem<T> {
  requestFn: () => Promise<T>;
  retryCount: number;
  resolve: (value: T) => void;
  reject: (error: Error) => void;
}



// Configuration
const CONFIG = {
  MAX_RETRIES: 3,
  BASE_DELAY: 1000,  // Start with 1 second delay
  MAX_DELAY: 10000,  // Maximum delay of 10 seconds
  JITTER: 0.1,       // 10% random jitter
  RATE_LIMIT: {
    REQUESTS_PER_SECOND: 10,
    MAX_CONCURRENT: 3
  }
} as const;

// Request queue state
const requestQueue: Array<RequestQueueItem<unknown>> = [];
let isProcessingQueue = false;
let activeRequests = 0;
let lastRequestTime = 0;

// Helper function to add jitter to delay
const addJitter = (delay: number): number => {
  const jitter = delay * CONFIG.JITTER;
  return delay + (Math.random() * jitter * 2 - jitter);
};

// Calculate exponential backoff delay
const getBackoffDelay = (retryCount: number): number => {
  const delay = Math.min(
    CONFIG.MAX_DELAY,
    CONFIG.BASE_DELAY * Math.pow(2, retryCount)
  );
  return addJitter(delay);
};

// Helper to check if we should retry
const shouldRetry = (error: unknown, retryCount: number): boolean => {
  if (retryCount >= CONFIG.MAX_RETRIES) return false;
  return isRetryableError(error);
};

// Process request queue
async function processRequestQueue() {
  if (isProcessingQueue || requestQueue.length === 0 || activeRequests >= CONFIG.RATE_LIMIT.MAX_CONCURRENT) {
    return;
  }

  isProcessingQueue = true;
  
  try {
    while (requestQueue.length > 0 && activeRequests < CONFIG.RATE_LIMIT.MAX_CONCURRENT) {
      const now = Date.now();
      const timeSinceLastRequest = now - lastRequestTime;
      const minInterval = 1000 / CONFIG.RATE_LIMIT.REQUESTS_PER_SECOND;
      
      if (timeSinceLastRequest < minInterval) {
        await new Promise(resolve => setTimeout(resolve, minInterval - timeSinceLastRequest));
      }
      
      const item = requestQueue.shift();
      if (!item) continue;
      
      activeRequests++;
      lastRequestTime = Date.now();
      
      try {
        const result = await executeRequest(item);
        item.resolve(result);
      } catch (error) {
        if (shouldRetry(error, item.retryCount)) {
          const delay = getBackoffDelay(item.retryCount);
          await new Promise(resolve => setTimeout(resolve, delay));
          
          requestQueue.push({
            ...item,
            retryCount: item.retryCount + 1
          });
        } else {
          item.reject(error as Error);
        }
      } finally {
        activeRequests--;
      }
    }
  } finally {
    isProcessingQueue = false;
    
    // If there are more items in the queue, schedule the next processing
    if (requestQueue.length > 0) {
      setTimeout(() => processRequestQueue(), 0);
    }
  }
}

async function executeRequest<T>(item: RequestQueueItem<T>): Promise<T> {
  try {
    // Check if token needs refresh before executing request
    await ensureValidToken();
    return await item.requestFn();
  } catch (error) {
    if (error instanceof TokenError && error.invalidToken) {
      // Token is invalid and couldn't be refreshed
      // Clear session and redirect to login
      signOut();
      throw error;
    }
    
    if (SpotifyError.isAuthError(error)) {
      // Try to refresh token and retry request once
      await refreshToken();
      return await item.requestFn();
    }
    
    throw error;
  }
}

// Queue a request with retries
export function queueRequest<T>(requestFn: () => Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const item: RequestQueueItem<T> = {
      requestFn,
      retryCount: 0,
      resolve,
      reject
    };
    
    requestQueue.push(item as RequestQueueItem<unknown>);
    processRequestQueue();
  });
}