import React, { useState, useEffect, useCallback } from 'react';
import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, Music, Repeat, Shuffle, Heart, Video } from 'lucide-react';
import useSpotifyStore from '../stores/useSpotifyStore';
import { 
  playPause, 
  nextTrack, 
  previousTrack, 
  setVolume, 
  shufflePlaylist, 
  toggleRepeat, 
  likeTrack,
  getCurrentTrackDetails
} from '../lib/spotify';

const NowPlaying: React.FC = () => {
  const { currentTrack, isPlaying, volume } = useSpotifyStore();
  const [repeatMode, setRepeatMode] = useState<'off' | 'track' | 'context'>('off');
  const [isShuffled, setIsShuffled] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [trackDuration, setTrackDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [showVideoOption, setShowVideoOption] = useState(false);

  const updateTrackProgress = useCallback(async () => {
    try {
      const playbackState = await getCurrentTrackDetails();
      if (playbackState && playbackState.is_playing) {
        const duration = playbackState.item?.duration_ms || 0;
        const position = playbackState.progress_ms || 0;
        
        setTrackDuration(duration);
        setCurrentTime(position);
        setProgress((position / duration) * 100);
      }
    } catch (error) {
      console.error('Failed to update track progress', error);
    }
  }, []);

  useEffect(() => {
    const progressInterval = setInterval(updateTrackProgress, 1000);
    return () => clearInterval(progressInterval);
  }, [updateTrackProgress]);

  const handlePlayPause = async () => {
    try {
      await playPause(!isPlaying);
    } catch (error) {
      console.error('Failed to play/pause', error);
    }
  };

  if (!currentTrack) {
    return (
      <div className="bg-white/10 backdrop-blur-md rounded-2xl shadow-2xl p-6 w-full border border-white/10 flex items-center justify-center">
        <Music className="w-12 h-12 text-gray-300 mr-4" />
        <p className="text-gray-500">No track currently playing</p>
      </div>
    );
  }

  const handleRepeat = async () => {
    const nextRepeatMode: ('off' | 'track' | 'context')[] = ['off', 'track', 'context'];
    const currentIndex = nextRepeatMode.indexOf(repeatMode);
    const newRepeatMode = nextRepeatMode[(currentIndex + 1) % nextRepeatMode.length];

    try {
      await toggleRepeat(newRepeatMode);
      setRepeatMode(newRepeatMode);
    } catch (error) {
      console.error('Failed to toggle repeat', error);
    }
  };

  const handleShuffle = async () => {
    try {
      await shufflePlaylist(!isShuffled);
      setIsShuffled(!isShuffled);
    } catch (error) {
      console.error('Failed to shuffle playlist', error);
    }
  };

  const handleLike = async () => {
    try {
      await likeTrack(currentTrack.id);
      setIsLiked(!isLiked);
    } catch (error) {
      console.error('Failed to like track', error);
    }
  };

  const handleVolumeChange = (newVolume: number) => {
    const adjustedVolume = isMuted ? 0 : newVolume;
    setVolume(adjustedVolume);
  };

  const toggleMute = () => {
    setIsMuted(!isMuted);
    setVolume(isMuted ? 50 : 0);
  };

  const formatTime = (ms: number) => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };

  const handleVideoToggle = () => {
    setShowVideoOption(!showVideoOption);
  };

  return (
    <div className="bg-white/10 backdrop-blur-md rounded-2xl shadow-2xl p-6 w-full border border-white/10">
      <div className="relative group">
        <div className="relative">
          <img
            src={currentTrack.album.images[0].url}
            alt={currentTrack.album.name}
            className="w-full h-96 object-cover rounded-2xl mb-4 shadow-2xl transition-all duration-300 group-hover:brightness-75"
          />
          
          {/* Video Option Button */}
          {currentTrack.preview_url && (
            <button 
              onClick={handleVideoToggle}
              className="absolute top-4 right-4 bg-black/50 p-2 rounded-full opacity-0 group-hover:opacity-100 transition-all duration-300"
              title="Toggle Video Preview"
            >
              <Video className="w-6 h-6 text-white" />
            </button>
          )}

          {!isPlaying && (
            <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center rounded-2xl">
              <Pause className="w-16 h-16 text-white" />
            </div>
          )}
        </div>
        
        {/* Video Preview (if available) */}
        {showVideoOption && currentTrack.preview_url && (
          <video 
            src={currentTrack.preview_url} 
            controls 
            className="w-full rounded-2xl mt-4"
          />
        )}

        {/* Enhanced Progress Bar */}
        <div className="mt-2 h-1 bg-gray-700 rounded-full overflow-hidden">
          <div 
            className="h-full bg-green-500 transition-all duration-500" 
            style={{ width: `${progress}%` }}
          ></div>
        </div>
        <div className="flex justify-between text-xs text-gray-400 mt-1">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(currentTrack.duration_ms || 0)}</span>
        </div>
      </div>

      <div className="mt-4 flex justify-between items-center">
        <div className="flex-1 min-w-0 mr-4">
          <h2 className="text-xl font-bold truncate text-white">{currentTrack.name}</h2>
          <p className="text-gray-400 truncate">
            {currentTrack.artists.map((a) => a.name).join(', ')} • {currentTrack.album.name}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button 
            onClick={handleLike}
            className={`p-2 rounded-full hover:bg-white/10 transition-colors ${
              isLiked ? 'text-red-500' : 'text-gray-400'
            }`}
            title="Like Track"
          >
            <Heart className={`w-5 h-5 ${isLiked ? 'fill-current' : ''}`} />
          </button>
          
          <button 
            onClick={handleShuffle}
            className={`p-2 rounded-full transition-all ${
              isShuffled 
                ? 'bg-green-500 text-white' 
                : 'text-gray-400 hover:bg-white/10'
            }`}
            title="Shuffle"
          >
            <Shuffle className="w-5 h-5" />
          </button>
          
          <button 
            onClick={handleRepeat}
            className={`p-2 rounded-full transition-all ${
              repeatMode !== 'off' 
                ? 'bg-green-500 text-white' 
                : 'text-gray-400 hover:bg-white/10'
            }`}
            title={`Repeat: ${repeatMode}`}
          >
            <Repeat className={`w-5 h-5 ${repeatMode === 'track' ? 'fill-current' : ''}`} />
          </button>
        </div>
      </div>

      <div className="mt-6 flex items-center justify-between">
        <button 
          onClick={() => previousTrack()} 
          className="p-3 hover:bg-white/10 rounded-full transition-colors"
        >
          <SkipBack className="w-6 h-6 text-white" />
        </button>

        <button
          onClick={() => {
            playPause(!isPlaying);
            // Optional: add visual feedback
          }}
          className="p-4 bg-green-500 hover:bg-green-600 rounded-full text-white shadow-xl transform active:scale-90 transition-all group"
        >
          {isPlaying ? <Pause className="w-8 h-8" /> : <Play className="w-8 h-8" />}
          <span className="sr-only">{isPlaying ? 'Pause' : 'Play'}</span>
        </button>

        <button 
          onClick={() => nextTrack()} 
          className="p-3 hover:bg-white/10 rounded-full transition-colors"
        >
          <SkipForward className="w-6 h-6 text-white" />
        </button>
      </div>

      {/* Volume Controls */}
      <div className="mt-4 flex items-center gap-3">
        <div className="flex items-center gap-3">
          <button 
            onClick={toggleMute}
            className="text-gray-400 hover:text-white transition-colors"
          >
            {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
          </button>
          <input
            type="range"
            min="0"
            max="100"
            value={volume}
            onChange={(e) => handleVolumeChange(Number(e.target.value))}
            className="flex-1 w-32 h-2 bg-gray-700 rounded-full appearance-none 
              [&::-webkit-slider-thumb]:appearance-none 
              [&::-webkit-slider-thumb]:w-4 
              [&::-webkit-slider-thumb]:h-4 
              [&::-webkit-slider-thumb]:bg-green-500 
              [&::-webkit-slider-thumb]:rounded-full 
              [&::-webkit-slider-thumb]:shadow-md
              cursor-pointer"
          />
          <span className="text-sm text-gray-400 w-8 text-right">
            {isMuted ? 0 : volume}%
          </span>
        </div>
      </div>
    </div>
  );
};

export default NowPlaying;