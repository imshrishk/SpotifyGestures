import React, { useEffect, useState } from 'react';
import { Music, Plus } from 'lucide-react';
import useSpotifyStore from '../stores/useSpotifyStore';
import { getRecommendations, addToQueue } from '../lib/spotify';

interface Track {
  id: string;
  name: string;
  uri: string;
  album: { images: { url: string }[] };
  artists: { name: string }[];
}

const SongRecommendations: React.FC = () => {
  const { currentTrack } = useSpotifyStore();
  const [recommendations, setRecommendations] = useState<Track[]>([]);

  const handleAddToQueue = async (uri: string) => {
    try {
      await addToQueue(uri);
      alert('Added to queue!');
    } catch (error) {
      console.error('Error adding to queue:', error);
      alert('Failed to add to queue.');
    }
  };

  useEffect(() => {
    const fetchRecommendations = async () => {
      if (currentTrack) {
        const recs = await getRecommendations([currentTrack.id]);
        setRecommendations(recs.tracks);
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
          {recommendations.map((rec: Track) => (
            <div
              key={rec.id}
              className="flex items-center gap-3 p-3 hover:bg-white/5 rounded-xl transition-colors group"
            >
              <img
                src={rec.album.images[0].url}
                alt={rec.name}
                className="w-12 h-12 rounded-lg object-cover shadow-md"
              />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-white truncate">{rec.name}</p>
                <p className="text-sm text-gray-400 truncate">
                  {rec.artists.map((a: { name: string }) => a.name).join(', ')}
                </p>
              </div>
              <button
                onClick={() => handleAddToQueue(rec.uri)}
                className="p-2 rounded-full bg-green-500/20 hover:bg-green-500/40 transition-colors"
                title="Add to Queue"
              >
                <Plus className="w-4 h-4 text-green-400" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default SongRecommendations;
