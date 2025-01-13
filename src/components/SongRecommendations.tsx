import React, { useEffect, useState } from 'react';
import { Music } from 'lucide-react';
import useSpotifyStore from '../stores/useSpotifyStore';
import { getRecommendations } from '../lib/spotify';

const SongRecommendations: React.FC = () => {
  const { currentTrack } = useSpotifyStore();
  const [recommendations, setRecommendations] = useState([]);

  useEffect(() => {
    const fetchRecommendations = async () => {
      if (currentTrack) {
        const recommendations = await getRecommendations(currentTrack.id);
        setRecommendations(recommendations.tracks);
      }
    };
    fetchRecommendations();
  }, [currentTrack]);

  return (
    <div className="bg-white/10 backdrop-blur-md rounded-2xl shadow-2xl p-6 w-full border border-white/10">
      <h2 className="text-lg font-semibold text-white mb-4">Recommendations</h2>
      {recommendations.length === 0 ? (
        <div className="flex items-center justify-center text-gray-400 py-10">
          <Music className="w-12 h-12 text-gray-300 mr-4" />
          <p>No recommendations found</p>
        </div>
      ) : (
        <div className="space-y-4">
          {recommendations.map((track) => (
            <div
              key={track.id}
              className="flex items-center gap-3 p-3 hover:bg-white/5 rounded-xl transition-colors group"
            >
              <img
                src={track.album.images[0].url}
                alt={track.name}
                className="w-12 h-12 rounded-lg object-cover shadow-md"
              />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-white truncate">{track.name}</p>
                <p className="text-sm text-gray-400 truncate">
                  {track.artists.map((a) => a.name).join(', ')}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default SongRecommendations;
