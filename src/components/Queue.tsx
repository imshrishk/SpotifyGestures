import React, { useState, useEffect } from 'react';
import { List, Music, Shuffle, Repeat, Play } from 'lucide-react';
import useSpotifyStore from '../stores/useSpotifyStore';
import { shufflePlaylist, toggleRepeat } from '../lib/spotify';
import spotify from '../lib/spotify';
import { SpotifyApi } from '../lib/spotifyApi';

interface Track {
  id: string;
  name: string;
  artists: { name: string }[];
  album: { name: string; images: { url: string }[] };
  duration_ms?: number;
  uri: string;
}

interface TrackObjectSimplified {
  id: string;
  name: string;
  artists: { name: string }[];
  album?: { name: string; images: { url: string }[] };
  uri: string;
  duration_ms?: number;
}

const Queue: React.FC = () => {
  const { queue, currentTrack, token } = useSpotifyStore();
  const [activeTab, setActiveTab] = useState<'upcoming' | 'recent'>('upcoming');
  const [isShuffled, setIsShuffled] = useState(false);
  const [repeatMode, setRepeatMode] = useState<'off' | 'track' | 'context'>('off');
  const [recentTracks, setRecentTracks] = useState<Track[]>([]);

  useEffect(() => {
    const fetchRecentTracks = async () => {
      try {
        const response = await spotify.getMyRecentlyPlayedTracks({ limit: 20 });
        // Convert to Track format
        const formattedTracks: Track[] = response.items.map((item: any) => {
          const track = item.track;
          return {
            id: track.id,
            name: track.name,
            artists: track.artists,
            album: track.album,
            duration_ms: track.duration_ms,
            uri: track.uri
          };
        });
        setRecentTracks(formattedTracks);
      } catch (error) {
        console.error(error);
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
      console.error(error);
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
      console.error(error);
    }
  };

  const playSong = async (uri: string, index: number) => {
    if (!token) return;
    
    try {
      if (activeTab === 'upcoming') {
        // For upcoming tracks, use the skip next method to preserve queue
        for (let i = 0; i < index; i++) {
          await SpotifyApi.skipToNext(token);
          // Small delay to avoid rate limits
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      } else {
        // For recent tracks, play with context if available
        await SpotifyApi.playSmartly(token, uri);
      }
    } catch (error) {
      console.error('Error playing track:', error);
    }
  };

  const formatDuration = (ms: number | undefined) => {
    if (!ms) return '0:00';
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
              className={`px-3 py-1 rounded-full text-sm transition-colors ${activeTab === 'upcoming' ? 'bg-green-500 text-white' : 'text-gray-400 hover:text-white'}`}
            >
              Upcoming
            </button>
            <button
              onClick={() => setActiveTab('recent')}
              className={`px-3 py-1 rounded-full text-sm transition-colors ${activeTab === 'recent' ? 'bg-green-500 text-white' : 'text-gray-400 hover:text-white'}`}
            >
              Recent
            </button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleShuffle}
            className={`p-2 rounded-full transition-all ${isShuffled ? 'bg-green-500 text-white' : 'text-gray-400 hover:bg-gray-700'}`}
            title="Shuffle Playlist"
          >
            <Shuffle className="w-5 h-5" />
          </button>
          <button
            onClick={handleRepeat}
            className={`p-2 rounded-full transition-all ${repeatMode !== 'off' ? 'bg-green-500 text-white' : 'text-gray-400 hover:bg-gray-700'}`}
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
              key={`${track.id}-${index}`}
              className="flex items-center gap-3 p-3 hover:bg-white/5 rounded-xl transition-colors group cursor-pointer"
              onClick={() => playSong(track.uri, index)}
            >
              <span className="text-sm text-gray-500 w-6 opacity-50 group-hover:opacity-100">
                {index + 1}
              </span>
              <div className="relative">
                <img
                  src={track.album.images[2]?.url || '/placeholder-album.png'}
                  alt={track.album.name}
                  className="w-12 h-12 rounded-lg object-cover shadow-md"
                />
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <Play className="w-5 h-5 text-white" />
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-white truncate">{track.name}</p>
                <p className="text-sm text-gray-400 truncate">
                  {track.artists.map((a: { name: string }) => a.name).join(', ')}
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
