/**
 * System Monitoring Dashboard for High-Load Performance
 * Displays real-time statistics for rate limiting, caching, and connection pooling
 */

import React, { useState, useEffect } from 'react';
import { getSystemStats, getUserRateLimitStatus } from '../lib/spotify';
import { motion, AnimatePresence } from 'framer-motion';
import { Activity, Users, Database, Zap, AlertTriangle, CheckCircle } from 'lucide-react';

interface SystemStats {
  rateLimiter: {
    activeUsers: number;
    globalRequests: number;
    globalWindowStart: number;
    memoryUsage: number;
  };
  connectionPool: {
    activeRequests: number;
    queuedRequests: number;
    completedRequests: number;
    failedRequests: number;
    averageResponseTime: number;
  };
  cache: {
    spotify: {
      hits: number;
      misses: number;
      evictions: number;
      size: number;
      memoryUsage: number;
      hitRate?: number;
    };
    user: {
      hits: number;
      misses: number;
      evictions: number;
      size: number;
      memoryUsage: number;
      hitRate?: number;
    };
    queue: {
      hits: number;
      misses: number;
      evictions: number;
      size: number;
      memoryUsage: number;
      hitRate?: number;
    };
  };
  timestamp: number;
}

const MonitoringDashboard: React.FC = () => {
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [refreshInterval, setRefreshInterval] = useState(1000); // 1 second default

  useEffect(() => {
    const updateStats = async () => {
      try {
        const systemStats = getSystemStats();
        setStats(systemStats);
      } catch (error) {
        console.error('Failed to fetch system stats:', error);
      }
    };

    updateStats(); // Initial load
    const interval = setInterval(updateStats, refreshInterval);

    return () => clearInterval(interval);
  }, [refreshInterval]);

  const getStatusColor = (value: number, threshold: number, reverse = false) => {
    if (reverse) {
      return value < threshold ? 'text-green-500' : value > threshold * 1.5 ? 'text-red-500' : 'text-yellow-500';
    }
    return value < threshold ? 'text-green-500' : value > threshold * 1.5 ? 'text-red-500' : 'text-yellow-500';
  };

  const getStatusIcon = (value: number, threshold: number, reverse = false) => {
    if (reverse) {
      return value < threshold ? CheckCircle : value > threshold * 1.5 ? AlertTriangle : Activity;
    }
    return value < threshold ? CheckCircle : value > threshold * 1.5 ? AlertTriangle : Activity;
  };

  if (!stats) {
    return (
      <div className="fixed bottom-4 right-4 bg-gray-900 text-white p-4 rounded-lg shadow-lg">
        <div className="flex items-center space-x-2">
          <Activity className="w-4 h-4 animate-pulse" />
          <span>Loading system stats...</span>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Toggle Button */}
      <button
        onClick={() => setIsVisible(!isVisible)}
        className="fixed bottom-4 right-4 bg-blue-600 hover:bg-blue-700 text-white p-3 rounded-full shadow-lg transition-colors z-50"
        title="System Monitoring"
      >
        <Activity className="w-5 h-5" />
      </button>

      {/* Dashboard */}
      <AnimatePresence>
        {isVisible && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-20 right-4 bg-gray-900 text-white p-6 rounded-lg shadow-xl max-w-md w-full z-40"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold flex items-center space-x-2">
                <Zap className="w-5 h-5" />
                <span>System Monitor</span>
              </h3>
              <div className="flex items-center space-x-2">
                <select
                  value={refreshInterval}
                  onChange={(e) => setRefreshInterval(Number(e.target.value))}
                  className="bg-gray-800 text-white text-xs px-2 py-1 rounded"
                >
                  <option value={500}>0.5s</option>
                  <option value={1000}>1s</option>
                  <option value={2000}>2s</option>
                  <option value={5000}>5s</option>
                </select>
              </div>
            </div>

            <div className="space-y-4">
              {/* Rate Limiter Stats */}
              <div className="bg-gray-800 p-3 rounded">
                <div className="flex items-center space-x-2 mb-2">
                  <Users className="w-4 h-4" />
                  <span className="font-medium">Rate Limiter</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="flex justify-between">
                    <span>Active Users:</span>
                    <span className={getStatusColor(stats.rateLimiter.activeUsers, 100)}>
                      {stats.rateLimiter.activeUsers}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Global Requests:</span>
                    <span className={getStatusColor(stats.rateLimiter.globalRequests, 1000)}>
                      {stats.rateLimiter.globalRequests}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Memory:</span>
                    <span>{stats.rateLimiter.memoryUsage}KB</span>
                  </div>
                </div>
              </div>

              {/* Connection Pool Stats */}
              <div className="bg-gray-800 p-3 rounded">
                <div className="flex items-center space-x-2 mb-2">
                  <Zap className="w-4 h-4" />
                  <span className="font-medium">Connection Pool</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="flex justify-between">
                    <span>Active:</span>
                    <span className={getStatusColor(stats.connectionPool.activeRequests, 20)}>
                      {stats.connectionPool.activeRequests}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Queued:</span>
                    <span className={getStatusColor(stats.connectionPool.queuedRequests, 50, true)}>
                      {stats.connectionPool.queuedRequests}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Completed:</span>
                    <span className="text-green-500">{stats.connectionPool.completedRequests}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Failed:</span>
                    <span className={getStatusColor(stats.connectionPool.failedRequests, 10, true)}>
                      {stats.connectionPool.failedRequests}
                    </span>
                  </div>
                  <div className="flex justify-between col-span-2">
                    <span>Avg Response:</span>
                    <span className={getStatusColor(stats.connectionPool.averageResponseTime, 1000, true)}>
                      {Math.round(stats.connectionPool.averageResponseTime)}ms
                    </span>
                  </div>
                </div>
              </div>

              {/* Cache Stats */}
              <div className="bg-gray-800 p-3 rounded">
                <div className="flex items-center space-x-2 mb-2">
                  <Database className="w-4 h-4" />
                  <span className="font-medium">Cache Performance</span>
                </div>
                <div className="space-y-2 text-sm">
                  {Object.entries(stats.cache).map(([cacheName, cacheStats]) => (
                    <div key={cacheName} className="flex justify-between items-center">
                      <span className="capitalize">{cacheName}:</span>
                      <div className="flex items-center space-x-2">
                        <span className={getStatusColor(cacheStats.hitRate || 0, 70)}>
                          {cacheStats.hitRate?.toFixed(1)}%
                        </span>
                        <span className="text-gray-400">
                          ({cacheStats.size})
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Performance Indicators */}
              <div className="bg-gray-800 p-3 rounded">
                <div className="flex items-center space-x-2 mb-2">
                  <Activity className="w-4 h-4" />
                  <span className="font-medium">Performance</span>
                </div>
                <div className="text-sm space-y-1">
                  <div className="flex justify-between">
                    <span>System Load:</span>
                    <span className={
                      stats.rateLimiter.activeUsers > 500 || 
                      stats.connectionPool.queuedRequests > 100 ||
                      stats.connectionPool.averageResponseTime > 2000
                        ? 'text-red-500' : 'text-green-500'
                    }>
                      {stats.rateLimiter.activeUsers > 500 || 
                       stats.connectionPool.queuedRequests > 100 ||
                       stats.connectionPool.averageResponseTime > 2000
                        ? 'High' : 'Normal'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Last Update:</span>
                    <span className="text-gray-400">
                      {new Date(stats.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default MonitoringDashboard;
