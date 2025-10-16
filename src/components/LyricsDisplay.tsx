import React, { useEffect, useState, useRef, useCallback } from 'react';
import useSpotifyStore from '../stores/useSpotifyStore';
import { getLyrics } from '../lib/spotify';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, AlertCircle, RefreshCw } from 'lucide-react';

interface SyncedLyric {
  time: number;
  text: string;
}

const LyricsDisplay: React.FC = () => {
  const { currentTrack, progress_ms } = useSpotifyStore();
  const [lyrics, setLyrics] = useState<string | null>(null);
  const [syncedLyrics, setSyncedLyrics] = useState<SyncedLyric[] | null>(null);
  const [activeLyricIndex, setActiveLyricIndex] = useState<number>(-1);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const lyricsContainerRef = useRef<HTMLDivElement>(null);
  const autoScrollRef = useRef<boolean>(true);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const fetchLyrics = useCallback(async () => {
    if (!currentTrack) return;

    setIsLoading(true);
    setError(null);

    try {
      const result = await getLyrics(currentTrack.id);
      setLyrics(result.lyrics);
      setSyncedLyrics(result.syncedLyrics);
      setActiveLyricIndex(-1);

      if (!result.lyrics && !result.syncedLyrics) {
        setError('No lyrics found for this track');
      }
    } catch (error) {
      console.error('Error fetching lyrics:', error);
      setError('Failed to load lyrics');
    } finally {
      setIsLoading(false);
    }
  }, [currentTrack]);

  useEffect(() => {
    fetchLyrics();
  }, [currentTrack, fetchLyrics]);

  useEffect(() => {
    if (!syncedLyrics || progress_ms === null || !autoScrollRef.current) return;

    const currentIndex = syncedLyrics.findIndex((lyric, index) => {
      const nextLyric = syncedLyrics[index + 1];
      return lyric.time <= progress_ms && (!nextLyric || nextLyric.time > progress_ms);
    });

    if (currentIndex !== -1 && currentIndex !== activeLyricIndex) {
      setActiveLyricIndex(currentIndex);
      
      if (lyricsContainerRef.current && autoScrollRef.current) {
        const activeElement = lyricsContainerRef.current.children[currentIndex] as HTMLElement;
        if (activeElement) {
          if ('scrollIntoView' in activeElement && typeof (activeElement as unknown as { scrollIntoView?: unknown }).scrollIntoView === 'function') {
            try {
              activeElement.scrollIntoView({
                behavior: 'smooth',
                block: 'center',
                inline: 'nearest'
              });
            } catch {
            }
          } else if (lyricsContainerRef.current) {
            lyricsContainerRef.current.scrollTop = Math.max(0, (activeElement as HTMLElement).offsetTop - (lyricsContainerRef.current.clientHeight / 2));
          }
        }
      }
    }
  }, [progress_ms, syncedLyrics, activeLyricIndex]);

  const handleScroll = useCallback(() => {
    if (lyricsContainerRef.current) {
      autoScrollRef.current = false;
      
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
      
      scrollTimeoutRef.current = setTimeout(() => {
        autoScrollRef.current = true;
      }, 3000);
    }
  }, []);

  const handleRefreshLyrics = () => {
    fetchLyrics();
  };

  return (
    <div className="bg-gradient-to-br from-gray-900/90 to-black/90 backdrop-blur-md rounded-2xl shadow-2xl p-6 w-full border border-white/10">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <Mic className="w-5 h-5" /> Lyrics
        </h2>
        <div className="flex items-center gap-3">
          {error && (
            <span className="text-red-400 text-sm flex items-center gap-1">
              <AlertCircle className="w-4 h-4" />
              {error}
            </span>
          )}
          {currentTrack && (
            <div className="text-sm text-gray-400">
              {currentTrack.name} - {currentTrack.artists.map(artist => artist.name).join(', ')}
            </div>
          )}
          <button 
            onClick={handleRefreshLyrics}
            disabled={isLoading}
            className="p-1.5 rounded-full bg-green-600/30 text-green-400 hover:bg-green-600/50 transition-colors"
            title="Refresh lyrics"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>
      
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-green-500"></div>
        </div>
      ) : syncedLyrics ? (
        <div 
          ref={lyricsContainerRef}
          className="overflow-y-auto max-h-[60vh] space-y-4 py-4 px-2 custom-scrollbar"
          onScroll={handleScroll}
        >
          <AnimatePresence mode="wait">
            {syncedLyrics.map((lyric, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0.5 }}
                animate={{ 
                  opacity: index === activeLyricIndex ? 1 : 0.5,
                  scale: index === activeLyricIndex ? 1.05 : 1,
                  color: index === activeLyricIndex ? 'rgb(255, 255, 255)' : 'rgb(156, 163, 175)',
                  fontSize: index === activeLyricIndex ? '1.25rem' : '1rem',
                  fontWeight: index === activeLyricIndex ? 600 : 400,
                  transition: { 
                    duration: 0.3,
                    ease: "easeOut"
                  }
                }}
                className={`relative transition-all duration-300 ${
                  index === activeLyricIndex
                    ? 'text-white text-lg font-semibold'
                    : 'text-gray-400'
                }`}
              >
                {index === activeLyricIndex && (
                  <motion.div
                    className="absolute -left-2 top-1/2 -translate-y-1/2 w-1 h-4 bg-green-500 rounded-full"
                    initial={{ opacity: 0, scale: 0 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.3 }}
                  />
                )}
                {lyric.text}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      ) : lyrics ? (
        <div className="overflow-y-auto max-h-[60vh] py-4 px-2 custom-scrollbar">
          <pre className="text-gray-300 whitespace-pre-wrap font-sans text-base leading-relaxed">
            {lyrics}
          </pre>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center h-64 text-gray-400 space-y-4">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
          </svg>
          <p className="text-center">No lyrics available for this track</p>
          <p className="text-sm text-gray-500">Try playing a different song</p>
        </div>
      )}
    </div>
  );
};

export default LyricsDisplay;
