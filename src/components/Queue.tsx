import React, { useState, useEffect } from 'react';
import { List, Music, Shuffle, Repeat, Playlist } from 'lucide-react';
import useSpotifyStore from '../stores/useSpotifyStore';
import { shufflePlaylist, toggleRepeat } from '../lib/spotify';
import spotify from '../lib/spotify';

type Track = {
  id: string;
  name: string;
  artists: { name: string }[];
  album: { name: string; images: { url: string }[] };
  duration_ms?: number;
};

const Queue: React.FC = () => {
  const { queue, currentTrack } = useSpotifyStore();
  const [activeTab, setActiveTab] = useState<'upcoming' | 'recent'>('upcoming');
  const [isShuffled, setIsShuffled] = useState(false);
  const [repeatMode, setRepeatMode] = useState<'off' | 'track' | 'context'>('off');
  const [recentTracks, setRecentTracks] = useState<Track[]>([]);

  useEffect(() => {
    const fetchRecentTracks = async () => {
      try {
        const response = await spotify.getMyRecentlyPlayedTracks({ limit: 20 });
        setRecentTracks(response.items.map(item => item.track));
      } catch (error) {
        console.error('Failed to fetch recent tracks', error);
      }
    };

    fetchRecentTracks();
  }, []);

  const displayTracks = activeTab === 'upcoming' ? queue : recentTracks;

  const handleShuffle = async () => {
    try {
      await shufflePlaylist(!isShuffled);
      setIsShuffled(!isShuffled);
    } catch (error) {
      console.error('Failed to shuffle playlist', error);
    }
  };

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

  const formatDuration = (ms: number) => {
    const minutes = Math.floor(ms / 60000);
    const seconds = ((ms % 60000) / 1000).toFixed(0);
    return `${minutes}:${parseInt(seconds) < 10 ? '0' : ''}${seconds}`;
  };

  return (
    <div className="bg-white/10 backdrop-blur-md rounded-2xl shadow-2xl p-6 w-full border border-white/10">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <List className="w-5 h-5 text-gray-300" />
            <h2 className="text-lg font-semibold text-white">Tracks</h2>
          </div>
          
          <div className="bg-gray-800 rounded-full p-1 flex items-center">
            <button
              onClick={() => setActiveTab('upcoming')}
              className={`px-3 py-1 rounded-full text-sm transition-colors ${
                activeTab === 'upcoming' 
                  ? 'bg-green-500 text-white' 
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Upcoming
            </button>
            <button
              onClick={() => setActiveTab('recent')}
              className={`px-3 py-1 rounded-full text-sm transition-colors ${
                activeTab === 'recent' 
                  ? 'bg-green-500 text-white' 
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Recent
            </button>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <button 
            onClick={handleShuffle}
            className={`p-2 rounded-full transition-all ${
              isShuffled 
                ? 'bg-green-500 text-white' 
                : 'text-gray-400 hover:bg-gray-700'
            }`}
            title="Shuffle Playlist"
          >
            <Shuffle className="w-5 h-5" />
          </button>
          
          <button 
            onClick={handleRepeat}
            className={`p-2 rounded-full transition-all ${
              repeatMode !== 'off' 
                ? 'bg-green-500 text-white' 
                : 'text-gray-400 hover:bg-gray-700'
            }`}
            title={`Repeat: ${repeatMode}`}
          >
            <Repeat className={`w-5 h-5 ${repeatMode === 'track' ? 'fill-current' : ''}`} />
          </button>
        </div>
      </div>

      <div className="space-y-4 max-h-[500px] overflow-y-auto custom-scrollbar">
        {displayTracks.length === 0 ? (
          <div className="flex items-center justify-center text-gray-400 py-10">
            <Music className="w-12 h-12 text-gray-300 mr-4" />
            <p>{activeTab === 'upcoming' ? 'Queue is empty' : 'No recent tracks'}</p>
          </div>
        ) : (
          displayTracks.slice(0, 20).map((track, index) => (
            <div
              key={track.id}
              className="flex items-center gap-3 p-3 hover:bg-white/5 rounded-xl transition-colors group"
            >
              <span className="text-sm text-gray-500 w-6 opacity-50 group-hover:opacity-100">
                {index + 1}
              </span>
              <img
                src={track.album.images[2]?.url || '/placeholder-album.png'}
                alt={track.album.name}
                className="w-12 h-12 rounded-lg object-cover shadow-md"
              />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-white truncate">{track.name}</p>
                <p className="text-sm text-gray-400 truncate">
                  {track.artists.map((a) => a.name).join(', ')}
                </p>
              </div>
              {track.duration_ms && (
                <span className="text-xs text-gray-500 hidden md:block">
                  {formatDuration(track.duration_ms)}
                </span>
              )}
            </div>
          ))
        )}
      </div>

      {displayTracks.length > 20 && (
        <div className="text-center text-sm text-gray-500 mt-4">
          +{displayTracks.length - 20} more tracks
        </div>
      )}
    </div>
  );
};

export default Queue;