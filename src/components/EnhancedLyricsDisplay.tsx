import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import useSpotifyStore from '../stores/useSpotifyStore';
import { getLyrics } from '../lib/spotify';
import { motion, AnimatePresence } from 'framer-motion';
import { extractDominantColor } from '../lib/colorExtractor';
import { X, Maximize2, Minimize2, Music } from 'lucide-react';

interface SyncedLyric {
  time: number;
  text: string;
}

const EnhancedLyricsDisplay: React.FC = () => {
  const { currentTrack, isPlaying, progress_ms } = useSpotifyStore();
  const [lyrics, setLyrics] = useState<string | null>(null);
  const [syncedLyrics, setSyncedLyrics] = useState<SyncedLyric[] | null>(null);
  const [activeLyricIndex, setActiveLyricIndex] = useState<number>(-1);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [backgroundColor, setBackgroundColor] = useState<string>('#121212');
  const [textColor, setTextColor] = useState<string>('#ffffff');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [nextLyricIndex, setNextLyricIndex] = useState<number>(-1);
  const [lyricsLoaded, setLyricsLoaded] = useState<boolean>(false);
  const [lyricSource, setLyricSource] = useState<string>('Spotify');
  const [isExpanded, setIsExpanded] = useState<boolean>(true);
  
  const lyricsContainerRef = useRef<HTMLDivElement>(null);
  const autoScrollRef = useRef<boolean>(true);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animationFrameRef = useRef<number>();
  const lastProgressRef = useRef<number | null>(null);
  const lastTrackIdRef = useRef<string | null>(null);
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lyricElementsRef = useRef<HTMLElement[]>([]);
  const scrollAnimationRef = useRef<number | null>(null);

  // Memoize the current track ID to prevent unnecessary re-renders
  const currentTrackId = useMemo(() => currentTrack?.id || null, [currentTrack]);

  // Extract colors from album art when it changes
  useEffect(() => {
    const extractColors = async () => {
      if (currentTrack?.album?.images?.[0]?.url) {
        try {
          const dominantColor = await extractDominantColor(currentTrack.album.images[0].url);
          
          if (dominantColor) {
            const [r, g, b] = dominantColor;
            setBackgroundColor(`rgb(${r}, ${g}, ${b})`);
            setTextColor(r + g + b > 382 ? '#000000' : '#ffffff');
          }
        } catch (error) {
          console.error('Error extracting colors:', error);
        }
      }
    };
    
    extractColors();
  }, [currentTrack]);

  // Fetch lyrics only when the track changes
  useEffect(() => {
    let isMounted = true;
    let retryCount = 0;
    const MAX_RETRIES = 2; // Allow a couple retries per track
    
    const fetchLyrics = async () => {
      // Skip if we already have lyrics for this track
      if (currentTrackId === lastTrackIdRef.current && lyricsLoaded) {
        return;
      }
      
      // Skip if we've already tried multiple times for this track
      if (currentTrackId === lastTrackIdRef.current && retryCount >= MAX_RETRIES) {
        if (!lyrics && !syncedLyrics) {
          setLyrics("Lyrics not available for this track.");
          setLyricsLoaded(true);
        }
        return;
      }
      
      if (currentTrackId) {
        setIsLoading(true);
        try {
          retryCount++;
          const result = await getLyrics(currentTrackId);
          
          // Only update state if the component is still mounted
          if (!isMounted) return;
          
          if (result.lyrics) {
            setLyrics(result.lyrics);
            if (result.syncedLyrics) {
              setSyncedLyrics(result.syncedLyrics);
              setLyricSource('Spotify');
            } else {
              setSyncedLyrics(null);
              setLyricSource('External API');
            }
            setActiveLyricIndex(-1);
            setNextLyricIndex(-1);
            setLyricsLoaded(true);
            lastTrackIdRef.current = currentTrackId;
          } else {
            // No lyrics found
            setLyrics("Lyrics not available for this track.");
            setSyncedLyrics(null);
            setLyricsLoaded(true);
          }
        } catch (error) {
          console.error('Error fetching lyrics:', error);
          
          // Only update state if component is still mounted
          if (!isMounted) return;
          
          setLyrics("Lyrics unavailable due to an error.");
          setSyncedLyrics(null);
          setLyricsLoaded(true);
        } finally {
          if (isMounted) {
            setIsLoading(false);
          }
        }
      }
    };
    
    fetchLyrics();
    
    // Clean up function
    return () => {
      isMounted = false;
    };
  }, [currentTrackId, lyricsLoaded, lyrics, syncedLyrics]);

  // Store references to lyric elements for smooth scrolling
  useEffect(() => {
    if (lyricsContainerRef.current && syncedLyrics) {
      lyricElementsRef.current = Array.from(lyricsContainerRef.current.children) as HTMLElement[];
    }
  }, [syncedLyrics]);

  // Smooth scroll to a specific position
  const smoothScrollTo = useCallback((targetPosition: number) => {
    if (!lyricsContainerRef.current) return;
    
    if (scrollAnimationRef.current) {
      cancelAnimationFrame(scrollAnimationRef.current);
    }
    
    const startPosition = lyricsContainerRef.current.scrollTop;
    const distance = targetPosition - startPosition;
    const duration = 500; // ms
    let start: number | null = null;
    
    const animation = (timestamp: number) => {
      if (!start) start = timestamp;
      const elapsed = timestamp - start;
      const progress = Math.min(elapsed / duration, 1);
      
      // Easing function for smooth acceleration and deceleration
      const easeProgress = progress < 0.5 
        ? 2 * progress * progress 
        : 1 - Math.pow(-2 * progress + 2, 2) / 2;
      
      if (lyricsContainerRef.current) {
        lyricsContainerRef.current.scrollTop = startPosition + distance * easeProgress;
      }
      
      if (progress < 1) {
        scrollAnimationRef.current = requestAnimationFrame(animation);
      } else {
        scrollAnimationRef.current = null;
      }
    };
    
    scrollAnimationRef.current = requestAnimationFrame(animation);
  }, []);

  // Update lyrics position based on current progress
  const updateLyricsPosition = useCallback(() => {
    if (!syncedLyrics || progress_ms === null || !autoScrollRef.current) return;

    const currentIndex = syncedLyrics.findIndex((lyric, index) => {
      const nextLyric = syncedLyrics[index + 1];
      return lyric.time <= progress_ms && (!nextLyric || nextLyric.time > progress_ms);
    });

    const nextIndex = syncedLyrics.findIndex((lyric) => lyric.time > progress_ms);

    if (currentIndex !== -1 && currentIndex !== activeLyricIndex) {
      setActiveLyricIndex(currentIndex);
      setNextLyricIndex(nextIndex);
      
      if (lyricsContainerRef.current && autoScrollRef.current && lyricElementsRef.current[currentIndex]) {
        const activeElement = lyricElementsRef.current[currentIndex];
        const containerRect = lyricsContainerRef.current.getBoundingClientRect();
        const elementRect = activeElement.getBoundingClientRect();
        
        // Calculate the target scroll position to center the active lyric
        const targetScrollTop = lyricsContainerRef.current.scrollTop + 
          (elementRect.top - containerRect.top) - 
          (containerRect.height / 2) + 
          (elementRect.height / 2);
        
        // Smooth scroll to the target position
        smoothScrollTo(targetScrollTop);
      }
    }
  }, [progress_ms, syncedLyrics, activeLyricIndex, smoothScrollTo]);

  // Debounced progress update to prevent too frequent updates
  const debouncedProgressUpdate = useCallback(() => {
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }
    
    debounceTimeoutRef.current = setTimeout(() => {
      if (progress_ms !== lastProgressRef.current) {
        lastProgressRef.current = progress_ms;
        updateLyricsPosition();
      }
    }, 50); // 50ms debounce for smoother updates
  }, [progress_ms, updateLyricsPosition]);

  // Use requestAnimationFrame for smooth updates
  useEffect(() => {
    if (!syncedLyrics || progress_ms === null) return;

    const animate = () => {
      debouncedProgressUpdate();
      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, [syncedLyrics, progress_ms, debouncedProgressUpdate]);

  const handleScroll = () => {
    if (lyricsContainerRef.current) {
      autoScrollRef.current = false;
      
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
      
      scrollTimeoutRef.current = setTimeout(() => {
        autoScrollRef.current = true;
      }, 3000);
    }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  const toggleExpanded = () => {
    setIsExpanded(!isExpanded);
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
      if (scrollAnimationRef.current) {
        cancelAnimationFrame(scrollAnimationRef.current);
      }
    };
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="relative">
          <div className="w-12 h-12 rounded-full border-2 border-green-500 animate-ping absolute inset-0"></div>
          <div className="w-12 h-12 rounded-full border-2 border-green-500 animate-pulse"></div>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative">
      <motion.div 
        className={`bg-gradient-to-br from-gray-900/90 to-black/90 backdrop-blur-md rounded-2xl shadow-2xl p-6 w-full border border-white/10 ${
          isFullscreen ? 'fixed inset-0 z-50' : ''
        }`}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        style={{
          background: `linear-gradient(to bottom right, ${backgroundColor}22, #000000ee)`
        }}
      >
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center space-x-3">
            <h2 className="text-xl font-bold text-white">Lyrics</h2>
            {currentTrack && (
              <span className="text-sm text-gray-400">
                {currentTrack.name} - {currentTrack.artists[0].name}
              </span>
            )}
          </div>
          <div className="flex items-center space-x-2">
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={toggleExpanded}
              className="p-2 rounded-full bg-black/30 text-white hover:bg-black/50 transition-colors backdrop-blur-sm"
            >
              {isExpanded ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={toggleFullscreen}
              className="p-2 rounded-full bg-black/30 text-white hover:bg-black/50 transition-colors backdrop-blur-sm"
            >
              {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
            </motion.button>
          </div>
        </div>

        <div className="relative">
          {isExpanded ? (
            <div 
              ref={lyricsContainerRef}
              className="overflow-y-auto space-y-4 py-4 px-2 custom-scrollbar"
              onScroll={handleScroll}
              style={{ maxHeight: isFullscreen ? 'calc(100vh - 200px)' : '400px', minHeight: '250px' }}
            >
              <AnimatePresence mode="wait">
                {syncedLyrics ? (
                  // Synced lyrics with highlighted active line
                  syncedLyrics.map((lyric, index) => {
                    const isActive = index === activeLyricIndex;
                    const isNext = index === nextLyricIndex;
                    const isPast = index < activeLyricIndex;
                    const isUpcoming = index > nextLyricIndex && nextLyricIndex !== -1;

                    return (
                      <motion.div
                        key={index}
                        initial={{ opacity: 0.5, y: 20 }}
                        animate={{ 
                          opacity: isActive ? 1 : isNext ? 0.8 : isPast ? 0.3 : isUpcoming ? 0.4 : 0.5,
                          scale: isActive ? 1.05 : 1,
                          y: 0
                        }}
                        transition={{
                          duration: 0.3,
                          ease: "easeOut"
                        }}
                        className={`transition-all duration-300 ${
                          isActive
                            ? 'text-white text-lg font-semibold'
                            : isNext
                            ? 'text-gray-300 text-base'
                            : isPast
                            ? 'text-gray-500 text-sm'
                            : isUpcoming
                            ? 'text-gray-400 text-sm'
                            : 'text-gray-400'
                        }`}
                      >
                        {lyric.text || ' '}
                      </motion.div>
                    );
                  })
                ) : lyrics ? (
                  <pre className="text-gray-300 whitespace-pre-wrap font-sans text-base leading-relaxed">
                    {lyrics}
                  </pre>
                ) : (
                  <div className="flex flex-col items-center justify-center h-64 text-gray-400 space-y-4">
                    <Music className="w-16 h-16 text-gray-600" />
                    <p className="text-center">No lyrics available for this track</p>
                    <p className="text-sm text-gray-500">Try playing a different song</p>
                  </div>
                )}
              </AnimatePresence>
            </div>
          ) : (
            // Non-expanded view: Just show a few lines
            <motion.div 
              className="lyrics-preview text-white p-5 max-h-[150px] overflow-hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5 }}
            >
              <div className="whitespace-pre-line text-lg line-clamp-3">
                {lyrics}
              </div>
              <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-gray-900 to-transparent pointer-events-none" />
            </motion.div>
          )}
        </div>
        
        <div className="mt-4 flex justify-between items-center">
          <div className="text-xs text-gray-500">
            Lyrics sourced from {lyricSource || 'External API'}
          </div>
          {currentTrack && progress_ms !== null && (
            <div className="text-xs text-gray-500">
              {Math.floor(progress_ms / 60000)}:{(progress_ms % 60000 / 1000).toFixed(0).padStart(2, '0')}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default EnhancedLyricsDisplay; 