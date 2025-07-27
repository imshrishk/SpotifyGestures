import React, { useEffect, useState, useRef, useCallback } from 'react';
import useSpotifyStore from '../stores/useSpotifyStore';
import { motion } from 'framer-motion';
import { getTrackGenres } from '../lib/spotify';
import { Loader2 } from 'lucide-react';

// Enhanced genre colors - inspired by Vexcited/better-spotify-genres
const genreColors: Record<string, string> = {
  // Major genre categories
  'Pop': '#1DB954',       // Spotify green
  'Rock': '#E13300',      // Reddish orange
  'Hip Hop': '#FFCD00',   // Gold
  'Rap': '#FFCD00',       // Same as Hip Hop
  'R&B': '#BA55D3',       // Purple
  'Electronic': '#00FFFF', // Cyan
  'Dance': '#FF69B4',     // Pink
  'Indie': '#4B0082',     // Indigo
  'Alternative': '#708090', // Slate gray
  'Metal': '#000000',     // Black
  'Jazz': '#0000CD',      // Dark blue
  'Soul': '#800080',      // Purple
  'Classical': '#D2B48C', // Tan
  'Folk': '#8FBC8F',      // Dark sea green
  'Country': '#CD853F',   // Peru
  'Blues': '#0000FF',     // Blue
  'Ambient': '#87CEEB',   // Sky blue
  'EDM': '#00FF00',       // Lime
  'Punk': '#FF0000',      // Red
  'Trap': '#FFD700',      // Gold
  'House': '#FF45A4',     // Pink
  'Techno': '#36E2EC',    // Light blue
  'Latin': '#FF6A00',     // Orange
  'Reggae': '#00B300',    // Green
  'Disco': '#9467BD',     // Purple
  'Funk': '#FF7F0E',      // Orange
  // Additional subgenres
  'Lo-fi': '#6A5ACD',     // Slate blue
  'Synthwave': '#FF1493', // Deep pink
  'Drum And Bass': '#00CED1', // Dark turquoise
  'Lounge': '#DEB887',    // Burlywood
  'UK Garage': '#8B008B', // Dark magenta
  'K-pop': '#FF6347',     // Tomato
  'J-pop': '#4169E1',     // Royal blue
  'Grunge': '#696969',    // Dim gray
  'Hardcore': '#8B0000',  // Dark red
  'Emo': '#000080',       // Navy
  'Goth': '#4B0082',      // Indigo
  'Psychedelic': '#9370DB' // Medium purple
};

// Local session cache (persists between track changes)
const sessionGenreCache = new Map<string, string[]>();

// Determine text color for contrast
const getTextColor = (bgColor: string): string => {
  if (bgColor.startsWith('#')) {
    const r = parseInt(bgColor.slice(1, 3), 16);
    const g = parseInt(bgColor.slice(3, 5), 16);
    const b = parseInt(bgColor.slice(5, 7), 16);
    return (r * 0.299 + g * 0.587 + b * 0.114) > 150 ? '#000000' : '#FFFFFF';
  }
  return '#FFFFFF';
};

// Get color for a genre
const getGenreColor = (genre: string): string => {
  // Try direct match first
  for (const [key, color] of Object.entries(genreColors)) {
    if (key.toLowerCase() === genre.toLowerCase()) {
      return color;
    }
  }
  
  // Try partial match
  for (const [key, color] of Object.entries(genreColors)) {
    if (genre.toLowerCase().includes(key.toLowerCase()) || 
        key.toLowerCase().includes(genre.toLowerCase())) {
      return color;
    }
  }
  
  // Generate consistent color based on genre name
  let hash = 0;
  for (let i = 0; i < genre.length; i++) {
    hash = genre.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  let color = '#';
  for (let i = 0; i < 3; i++) {
    const value = (hash >> (i * 8)) & 0xFF;
    color += ('00' + value.toString(16)).substr(-2);
  }
  
  return color;
};

interface TrackGenresProps {
  showTitle?: boolean;
  className?: string;
  onGenreClick?: (genre: string) => void;
}

const TrackGenres: React.FC<TrackGenresProps> = ({ 
  showTitle = true, 
  className = '',
  onGenreClick 
}) => {
  const { currentTrack, token } = useSpotifyStore();
  const [genres, setGenres] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedGenre, setSelectedGenre] = useState<string | null>(null);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const failedAttemptsRef = useRef(0);
  const lastTrackRef = useRef<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  
  // Clear timeout on unmount
  useEffect(() => {
    return () => {
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);
  
  // Function to fetch genres with retry logic
  const fetchGenres = useCallback(async (retryCount = 0) => {
    // Don't do anything if there's no track playing
    if (!currentTrack?.id || !token) return;
    
    // Update lastTrackRef
    lastTrackRef.current = currentTrack.id;
    
    // Check session cache first for quicker response
    if (sessionGenreCache.has(currentTrack.id)) {
      setGenres(sessionGenreCache.get(currentTrack.id) || []);
      setError(null);
      setIsLoading(false);
      setIsInitialized(true);
      return;
    }
    
    try {
      setIsLoading(true);
      setError(null);
      
      // Direct API call to get genres
      const trackGenres = await getTrackGenres(currentTrack.id);
      
      // Only update if this is still the current track
      if (lastTrackRef.current !== currentTrack.id) {
        return;
      }
      
      // Reset failed attempts counter on success
      failedAttemptsRef.current = 0;
      
      // Cache the results in session
      if (trackGenres.length > 0) {
        sessionGenreCache.set(currentTrack.id, trackGenres);
        setGenres(trackGenres);
        setError(null);
      } else {
        // If no genres were found, show a message but still clear error state
        setGenres([]);
        setError("No genres found for this track");
      }
      
      setIsLoading(false);
      setIsInitialized(true);
    } catch (err: any) {
      console.error('Error fetching track genres:', err);
      
      // Only update if this is still the current track
      if (lastTrackRef.current !== currentTrack.id) {
        return;
      }
      
      failedAttemptsRef.current += 1;
      
      // Check if it's a rate limiting error
      if (err.message && (err.message.includes('429') || err.message.includes('rate limit'))) {
        // Exponential backoff with max delay of 1 minute
        // Also add random jitter to avoid all clients retrying at the same time
        const baseDelay = Math.min(30, Math.pow(2, retryCount)) * 1000;
        const jitter = Math.random() * 1000;
        const retryAfter = Math.floor(baseDelay + jitter) / 1000;
        
        setError(`Rate limited. Retrying in ${retryAfter.toFixed(0)}s...`);
        
        // Clear any existing timeout
        if (retryTimeoutRef.current) {
          clearTimeout(retryTimeoutRef.current);
        }
        
        // Limit retries to prevent infinite loops - after 5 failures, back off for longer
        if (failedAttemptsRef.current <= 5) {
          // Set a retry timeout
          retryTimeoutRef.current = setTimeout(() => {
            // Only retry if this is still the current track
            if (lastTrackRef.current === currentTrack.id) {
              fetchGenres(retryCount + 1);
            }
          }, baseDelay + jitter);
        } else {
          // After multiple failures, show a more permanent error but still allow manual retry
          setError('Spotify API rate limited. Try again later.');
        }
      } else {
        // For non-rate-limit errors
        setError('Unable to load genres');
      }
      
      setIsLoading(false);
      setIsInitialized(true);
    }
  }, [currentTrack?.id, token]);
  
  // Effect to fetch genres when track changes with debouncing
  useEffect(() => {
    if (!currentTrack?.id) return;
    
    // Clear any existing debounce
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    
    // Debounce the state changes to prevent jumping
    debounceRef.current = setTimeout(() => {
      // Reset state when track changes
      setGenres([]);
      setError(null);
      setIsLoading(false);
      setIsInitialized(false);
      
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
      }
      
      // Don't immediately fetch if we've had multiple recent failures
      // This helps avoid cascading rate limit errors
      if (failedAttemptsRef.current > 5) {
        const cooldownDelay = 10000; // 10 seconds cooldown
        setError('Cooling down after rate limiting...');
        
        retryTimeoutRef.current = setTimeout(() => {
          failedAttemptsRef.current = 0; // Reset counter after cooldown
          fetchGenres(0);
        }, cooldownDelay);
      } else {
        fetchGenres(0);
      }
      
      // Clear selection when track changes
      if (selectedGenre && onGenreClick) {
        setSelectedGenre(null);
        onGenreClick('');
      }
    }, 100); // 100ms debounce
    
  }, [currentTrack?.id, token, onGenreClick, selectedGenre, fetchGenres]);
  
  // Handle genre click
  const handleGenreClick = (genre: string) => {
    // Toggle selection
    if (selectedGenre === genre) {
      setSelectedGenre(null);
      if (onGenreClick) onGenreClick('');
    } else {
      setSelectedGenre(genre);
      if (onGenreClick) onGenreClick(genre);
    }
  };
  
  // Handle manual retry
  const handleRetry = () => {
    failedAttemptsRef.current = 0; // Reset counter on manual retry
    fetchGenres(0);
  };
  
  // Don't render if no track is playing
  if (!currentTrack) {
    return null;
  }

  return (
    <div className={`${className} mt-4`}>
      {showTitle && (
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-white text-sm font-medium">Genres</h3>
          {isLoading && (
            <Loader2 className="w-3 h-3 text-gray-400 animate-spin" />
          )}
        </div>
      )}
      
      <div className="flex flex-wrap gap-2 min-h-[32px] transition-all duration-200">
        {isLoading && genres.length === 0 ? (
          // Loading state with fixed height to prevent jumping
          <>
            <div className="animate-pulse bg-white/10 rounded-full h-5 w-16"></div>
            <div className="animate-pulse bg-white/10 rounded-full h-5 w-20"></div>
            <div className="animate-pulse bg-white/10 rounded-full h-5 w-14"></div>
          </>
        ) : genres.length > 0 ? (
          // Display genres
          genres.map((genre, index) => {
            const bgColor = getGenreColor(genre);
            const textColor = getTextColor(bgColor);
            const isSelected = selectedGenre === genre;
            
            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 5 }}
                animate={{ 
                  opacity: 1, 
                  y: 0,
                  scale: isSelected ? 1.05 : 1,
                }}
                transition={{ duration: 0.2, delay: index * 0.03 }}
                className="rounded-full px-2.5 py-1 text-xs font-medium cursor-pointer hover:scale-105 transition-all"
                style={{ 
                  backgroundColor: bgColor, 
                  color: textColor,
                  border: isSelected ? '2px solid white' : 'none'
                }}
                title={genre}
                onClick={() => handleGenreClick(genre)}
              >
                {genre}
              </motion.div>
            );
          })
        ) : error ? (
          // Error state with fixed height
          <div className="text-xs text-gray-400 flex items-center justify-between w-full">
            <span>{error}</span>
            {failedAttemptsRef.current > 0 && (
              <button 
                onClick={handleRetry}
                className="text-xs text-blue-400 hover:text-blue-300 ml-2 underline"
              >
                Retry
              </button>
            )}
          </div>
        ) : isInitialized ? (
          // No genres found and not loading
          <div className="text-xs text-gray-400">No genres found</div>
        ) : (
          // Initial loading state
          <div className="text-xs text-gray-400">Loading...</div>
        )}
      </div>
      
      {selectedGenre && (
        <div className="mt-2 flex items-center">
          <span className="text-xs text-gray-400">
            Filtering by: {selectedGenre}
          </span>
          <button 
            className="ml-2 text-xs text-gray-400 hover:text-white underline"
            onClick={() => {
              setSelectedGenre(null);
              if (onGenreClick) onGenreClick('');
            }}
          >
            Clear
          </button>
        </div>
      )}
    </div>
  );
};

export default TrackGenres;
