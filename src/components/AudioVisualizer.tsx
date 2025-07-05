import React, { useEffect, useState, useRef } from 'react';
import { motion } from 'framer-motion';
import useSpotifyStore from '../stores/useSpotifyStore';

interface AudioVisualizerProps {
  isPlaying: boolean;
  style?: 'bars' | 'wave' | 'circles' | 'particles';
  color?: string;
}

const AudioVisualizer: React.FC<AudioVisualizerProps> = ({ 
  isPlaying, 
  style = 'bars',
  color = 'green'
}) => {
  const [bars, setBars] = useState<number[]>([]);
  const { audioFeatures, audioAnalysis, progress_ms, currentTrack } = useSpotifyStore();
  const animationRef = useRef<number | null>(null);
  const lastBeatRef = useRef<number>(-1);
  const lastBarRef = useRef<number>(-1);
  const [visualizerHeight, setVisualizerHeight] = useState(60);
  const [visualizerColor, setVisualizerColor] = useState(getColorValue(color));
  const [beatIntensity, setBeatIntensity] = useState(0);
  const [activeSegment, setActiveSegment] = useState<any>(null);
  const lastUpdateTimeRef = useRef<number>(Date.now());
  
  // Convert color name to actual CSS color
  function getColorValue(colorName: string): string {
    const colorMap: Record<string, string> = {
      green: '#10b981',
      blue: '#3b82f6',
      purple: '#8b5cf6',
      pink: '#ec4899',
      red: '#ef4444',
      orange: '#f97316',
      yellow: '#eab308'
    };
    return colorMap[colorName] || colorMap.green;
  }
  
  // Update color when prop changes
  useEffect(() => {
    setVisualizerColor(getColorValue(color));
  }, [color]);
  
  // Adjust visualizer size on window resize
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 640) {
        setVisualizerHeight(40);
      } else if (window.innerWidth < 1024) {
        setVisualizerHeight(60);
      } else {
        setVisualizerHeight(80);
      }
    };
    
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  // Find the current beat based on progress
  const getCurrentBeat = () => {
    if (!audioAnalysis?.beats || !progress_ms) return -1;
    
    const currentTimeMs = progress_ms;
    
    for (let i = 0; i < audioAnalysis.beats.length; i++) {
      const beat = audioAnalysis.beats[i];
      const beatStartMs = beat.start * 1000;
      const beatEndMs = beatStartMs + (beat.duration * 1000);
      
      if (currentTimeMs >= beatStartMs && currentTimeMs < beatEndMs) {
        return i;
      }
    }
    
    return -1;
  };
  
  // Find the current bar based on progress
  const getCurrentBar = () => {
    if (!audioAnalysis?.bars || !progress_ms) return -1;
    
    const currentTimeMs = progress_ms;
    
    for (let i = 0; i < audioAnalysis.bars.length; i++) {
      const bar = audioAnalysis.bars[i];
      const barStartMs = bar.start * 1000;
      const barEndMs = barStartMs + (bar.duration * 1000);
      
      if (currentTimeMs >= barStartMs && currentTimeMs < barEndMs) {
        return i;
      }
    }
    
    return -1;
  };
  
  // Find the current segment based on progress
  const getCurrentSegment = () => {
    if (!audioAnalysis?.segments || !progress_ms) return null;
    
    const currentTimeMs = progress_ms;
    
    for (const segment of audioAnalysis.segments) {
      const segmentStartMs = segment.start * 1000;
      const segmentEndMs = segmentStartMs + (segment.duration * 1000);
      
      if (currentTimeMs >= segmentStartMs && currentTimeMs < segmentEndMs) {
        return segment;
      }
    }
    
    return null;
  };
  
  // Check if we need to update the animation - throttle updates for performance
  const shouldUpdate = () => {
    const now = Date.now();
    // Update at most 30 times per second (33ms)
    if (now - lastUpdateTimeRef.current > 33) {
      lastUpdateTimeRef.current = now;
      return true;
    }
    return false;
  };
  
  // Generate bars data based on audio features, analysis and animation
  useEffect(() => {
    // Initialize bars with some default values
    setBars(Array(30).fill(0).map(() => Math.random() * 30 + 5));
    
    const animate = () => {
      // Only update visualization when needed
      if (shouldUpdate() || !isPlaying) {
        // Get audio features for scaling
        const energy = audioFeatures?.energy || 0.7;
        const tempo = audioFeatures?.tempo || 120;
        
        // Base animation speed on tempo 
        const animationSpeed = Math.max(1, tempo / 120);
        
        // Higher energy = more height variation
        const maxHeight = 10 + (energy * 90);
        
        // Check for current beat/bar to sync with music
        const currentBeat = getCurrentBeat();
        const currentBar = getCurrentBar();
        const currentSegment = getCurrentSegment();
        let beatTriggered = false;
        let barTriggered = false;
        
        // Update active segment
        if (currentSegment && (!activeSegment || currentSegment.start !== activeSegment.start)) {
          setActiveSegment(currentSegment);
        }
        
        // If we've moved to a new beat
        if (currentBeat !== -1 && currentBeat !== lastBeatRef.current) {
          lastBeatRef.current = currentBeat;
          setBeatIntensity(1.0); // Full intensity on beat
          beatTriggered = true;
        } else if (isPlaying) {
          // Decay beat intensity faster on higher tempo songs
          const decayRate = 0.9 - (tempo / 2000); // Faster decay for faster songs
          setBeatIntensity(prev => Math.max(0, prev * decayRate));
        } else {
          // Slow decay when paused
          setBeatIntensity(prev => Math.max(0, prev * 0.98));
        }
        
        // If we've moved to a new bar
        if (currentBar !== -1 && currentBar !== lastBarRef.current) {
          lastBarRef.current = currentBar;
          barTriggered = true;
        }
        
        // Get segment data if available for frequency distribution
        let segmentLoudness = -30;
        let pitches: number[] = Array(12).fill(0.5);
        
        if (activeSegment) {
          segmentLoudness = activeSegment.loudness_max || activeSegment.loudness_start || -30;
          pitches = activeSegment.pitches || pitches;
        }
        
        // Scale loudness to a usable value between 0 and 1
        // Spotify loudness values typically range from -60 to 0 dB
        const loudnessFactor = Math.min(1, Math.max(0, (segmentLoudness + 60) / 60));
        
        // For when music is actually playing
        if (isPlaying && progress_ms) {
          // Generate bar heights based on audio analysis, beats, and features
          const newBars = Array(30).fill(0).map((_, i) => {
            const position = i / 30; // Normalized position (0-1)
            
            // Get the corresponding pitch class for this bar position
            const pitchIndex = Math.floor(position * 12);
            const pitchValue = pitches[pitchIndex] || 0.5;
            
            // Base height calculation using pitch and loudness
            let baseHeight = maxHeight * 0.3 * pitchValue * (loudnessFactor + 0.2);
            
            // Add beat-synchronized animation
            if (beatTriggered) {
              // Emphasize beat based on position
              const beatEmphasis = Math.sin(Math.PI * position) * maxHeight * 0.3;
              baseHeight += beatEmphasis * (audioAnalysis?.beats?.[currentBeat]?.confidence || 0.5);
            }
            
            // Add bar-synchronized animation
            if (barTriggered) {
              // Emphasize bar starts with a wave effect
              const barEmphasis = Math.sin(Math.PI * 2 * position) * maxHeight * 0.5;
              baseHeight += barEmphasis * (audioAnalysis?.bars?.[currentBar]?.confidence || 0.5);
            }
            
            // Calculate height based on visualizer style
            let height;
            switch (style) {
              case 'wave':
                // Wave synced to beat and tempo
                height = baseHeight + maxHeight * 0.4 * (
                  Math.sin(position * 5 + (progress_ms || 0) * 0.01 * animationSpeed) * (beatIntensity * 0.5 + 0.5) +
                  Math.sin(position * 3 + (progress_ms || 0) * 0.007 * animationSpeed) * 0.3
                );
                break;
                
              case 'circles':
                // Circles with radius based on pitch and beat intensity
                height = baseHeight * 1.2 * (
                  1 + beatIntensity * 0.5 * Math.sin(position * Math.PI * 2)
                );
                break;
                
              case 'particles':
                // Particles with positions influenced by beat and bar
                height = baseHeight + maxHeight * 0.3 * (
                  Math.sin(position * 7 + (progress_ms || 0) * 0.008 * animationSpeed) +
                  (beatIntensity * 2 * Math.random() - 0.5)
                );
                break;
                
              case 'bars':
              default:
                // Default bars visualization synced to music
                height = baseHeight + maxHeight * 0.3 * (
                  (beatIntensity * 0.7 + 0.3) * // Height affected by beat
                  Math.sin(position * 8 + (progress_ms || 0) * 0.006 * animationSpeed)
                );
                
                // Add some randomness influenced by energy
                if (isPlaying) {
                  height += Math.random() * maxHeight * 0.1 * energy;
                }
                break;
            }
            
            // Ensure height stays positive and has good variation
            return Math.max(5, Math.min(maxHeight, height));
          });
          
          setBars(newBars);
        } else {
          // Idle animation when not playing
          const idleBars = Array(30).fill(0).map((_, i) => {
            const position = i / 30;
            return 5 + Math.sin(position * 5 + Date.now() * 0.001) * 10;
          });
          setBars(idleBars);
        }
      }
      
      animationRef.current = requestAnimationFrame(animate);
    };
    
    animationRef.current = requestAnimationFrame(animate);
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isPlaying, style, audioFeatures, audioAnalysis, progress_ms, currentTrack]);
  
  // Render different visualizer styles
  const renderVisualizer = () => {
    // Scale effect for beat visualization
    const beatScale = 1 + beatIntensity * 0.2;
    
    switch (style) {
      case 'wave':
        return (
          <div data-testid="audio-visualizer" className="absolute bottom-0 left-0 right-0" style={{ height: `${visualizerHeight}px` }}>
            <motion.svg 
              width="100%" 
              height={visualizerHeight} 
              viewBox={`0 0 ${bars.length} ${visualizerHeight}`}
              preserveAspectRatio="none"
              animate={{ scale: beatScale }}
              transition={{ duration: 0.1 }}
            >
              <defs>
                <linearGradient id="waveGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" style={{ stopColor: visualizerColor, stopOpacity: 0.8 }} />
                  <stop offset="100%" style={{ stopColor: visualizerColor, stopOpacity: 0.3 }} />
                </linearGradient>
              </defs>
              <path
                d={`M 0 ${visualizerHeight} ${bars.map((h, i) => `L ${i} ${visualizerHeight - h}`).join(' ')} L ${bars.length - 1} ${visualizerHeight} Z`}
                fill="url(#waveGradient)"
                className="transition-all duration-100"
              />
            </motion.svg>
          </div>
        );
        
      case 'circles':
        return (
          <div data-testid="audio-visualizer" className="absolute bottom-0 left-0 right-0 flex items-center justify-center gap-1 px-4" 
               style={{ height: `${visualizerHeight}px` }}>
            {bars.map((height, i) => (
              <motion.div
                key={i}
                style={{
                  width: `${Math.max(4, height / 5)}px`,
                  height: `${Math.max(4, height / 5)}px`,
                  backgroundColor: `${visualizerColor}B3`, // 70% opacity
                  borderRadius: '9999px',
                  backdropFilter: 'blur(4px)'
                }}
                initial={{ scale: 0 }}
                animate={{ 
                  scale: isPlaying ? 1 : 0.2,
                  opacity: 0.4 + (height / visualizerHeight) * 0.6
                }}
                transition={{ duration: 0.2, delay: i * 0.01 }}
              />
            ))}
          </div>
        );
        
      case 'particles':
        return (
          <div data-testid="audio-visualizer" className="absolute bottom-0 left-0 right-0 flex items-center justify-center overflow-hidden"
               style={{ height: `${visualizerHeight}px` }}>
            {bars.map((height, i) => (
              <motion.div
                key={i}
                style={{
                  position: 'absolute',
                  width: '6px',
                  height: '6px',
                  borderRadius: '9999px',
                  backgroundColor: visualizerColor,
                  left: `${(i / bars.length) * 100}%`,
                  bottom: `${(height / 80) * 100}%`,
                  opacity: isPlaying ? 0.2 + (height / 80) * 0.8 : 0.2,
                }}
                animate={{
                  y: isPlaying ? [0, -5 * beatIntensity, 0] : 0,
                  opacity: isPlaying ? [0.5, 0.8, 0.5] : 0.2,
                  scale: beatIntensity > 0.5 ? [1, 1.3, 1] : 1,
                }}
                transition={{
                  repeat: Infinity,
                  duration: 2,
                  delay: i * 0.1,
                  ease: "easeInOut"
                }}
              />
            ))}
          </div>
        );
        
      case 'bars':
      default:
        return (
          <div data-testid="audio-visualizer" className="absolute bottom-0 left-0 right-0 flex items-end justify-center gap-1 px-4"
               style={{ height: `${visualizerHeight}px` }}>
            {bars.map((height, i) => (
              <motion.div
                key={i}
                style={{
                  width: '8px',
                  height: `${height}px`,
                  backgroundColor: `${visualizerColor}B3`, // 70% opacity
                  borderTopLeftRadius: '2px',
                  borderTopRightRadius: '2px',
                  backdropFilter: 'blur(4px)'
                }}
                initial={{ height: 5 }}
                animate={{ 
                  height: `${height}px`,
                  opacity: 0.5 + (height / visualizerHeight) * 0.5,
                  scale: i % 3 === 0 && beatIntensity > 0.7 ? [1, 1.1, 1] : 1 
                }}
                transition={{ duration: 0.1 }}
              />
            ))}
          </div>
        );
    }
  };
  
  if (!isPlaying) return null;

  return renderVisualizer();
};

export default AudioVisualizer;
