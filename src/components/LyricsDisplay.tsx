import React, { useEffect, useState } from 'react';
import useSpotifyStore from '../stores/useSpotifyStore';
import { getLyrics } from '../lib/spotify';

const LyricsDisplay: React.FC = () => {
  const { currentTrack } = useSpotifyStore();
  const [lyrics, setLyrics] = useState('');

  useEffect(() => {
    const fetchLyrics = async () => {
      if (currentTrack) {
        const lyrics = await getLyrics(currentTrack.id);
        setLyrics(lyrics);
      }
    };
    fetchLyrics();
  }, [currentTrack]);

  return (
    <div className="bg-white/10 backdrop-blur-md rounded-2xl shadow-2xl p-6 w-full border border-white/10">
      <h2 className="text-lg font-semibold text-white mb-4">Lyrics</h2>
      {lyrics ? (
        <div className="text-gray-400">{lyrics}</div>
      ) : (
        <div className="text-gray-400">No lyrics available</div>
      )}
    </div>
  );
};

export default LyricsDisplay;
