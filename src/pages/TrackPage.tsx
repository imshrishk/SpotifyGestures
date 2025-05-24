import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  ArrowLeft, 
  Clock, 
  Music, 
  Play, 
  Pause, 
  Heart, 
  Share, 
  Calendar,
  Music2,
  AlertTriangle,
  Info 
} from 'lucide-react';
import useSpotifyStore from '../stores/useSpotifyStore';
import AudioFeatures from '../components/AudioFeatures';
import AudioFeatureRadar from '../components/AudioFeatureRadar';
import { getTrackAudioFeatures, signOut } from '../lib/spotify';

interface TrackInfo {
  id: string;
  name: string;
  artists: { name: string; id: string }[];
  album: {
    name: string;
    id: string;
    images: { url: string }[];
    release_date: string;
  };
  duration_ms: number;
  popularity: number;
  uri: string;
}

interface TrackAudioFeatures {
  acousticness: number;
  danceability: number;
  energy: number;
  instrumentalness: number;
  key: number;
  liveness: number;
  loudness: number;
  mode: number;
  speechiness: number;
  tempo: number;
  time_signature: number;
  valence: number;
}

const keyMap: { [key: number]: string } = {
  0: 'C',
  1: 'C♯/D♭',
  2: 'D',
  3: 'D♯/E♭',
  4: 'E',
  5: 'F',
  6: 'F♯/G♭',
  7: 'G',
  8: 'G♯/A♭',
  9: 'A',
  10: 'A♯/B♭',
  11: 'B'
};

const formatDuration = (ms: number) => {
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
};

const TrackPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { token } = useSpotifyStore();
  const [track, setTrack] = useState<TrackInfo | null>(null);
  const [features, setFeatures] = useState<TrackAudioFeatures | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timeoutError, setTimeoutError] = useState(false);
  const [featuresError, setFeaturesError] = useState(false);
  const [isMockData, setIsMockData] = useState(false);

  useEffect(() => {
    if (!token || !id) {
      return;
    }

    const fetchTrackData = async () => {
      try {
        setIsLoading(true);
        setError(null);
        setTimeoutError(false);
        setFeaturesError(false);
        setIsMockData(false);
        
        // Set a timeout to detect if the request is taking too long
        const timeoutId = setTimeout(() => {
          setTimeoutError(true);
        }, 10000); // 10 seconds timeout
        
        // Fetch track info
        const trackResponse = await fetch(`https://api.spotify.com/v1/tracks/${id}`, {
          headers: { 
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
        
        if (!trackResponse.ok) {
          clearTimeout(timeoutId);
          throw new Error(`Failed to fetch track: ${trackResponse.status}`);
        }
        
        const trackData = await trackResponse.json();
        setTrack(trackData);
        
        // Fetch audio features with retry logic
        try {
          let retryCount = 0;
          const maxRetries = 3;
          let lastError = null;
          
          while (retryCount < maxRetries) {
            try {
              const featuresData = await getTrackAudioFeatures(id);
              if (featuresData) {
                setFeatures(featuresData);
                if (featuresData.acousticness === featuresData.danceability ||
                    featuresData.energy === featuresData.valence) {
                  // This was a mock data check, let's assume it's not strictly needed for now
                  // or could be handled differently if mock data is a separate concern.
                  // setIsMockData(true); 
                }
                setFeaturesError(false); // Explicitly set featuresError to false on success
                setError(null); // Clear general error as well
                break; // Success, exit the retry loop
              }
            } catch (error) {
              lastError = error;
              retryCount++;
              if (retryCount === maxRetries) {
                throw lastError; // Throw error if we've exhausted retries
              }
              // Wait before retrying (exponential backoff)
              await new Promise(resolve => setTimeout(resolve, Math.pow(2, retryCount) * 1000));
            }
          }
        } catch (caughtFeaturesError) { // Renamed to avoid conflict with state variable
          console.error('Error fetching audio features:', caughtFeaturesError);
          setFeatures(null); // Ensure features are null on error
          setFeaturesError(true);
          // Show a more specific error message
          if (caughtFeaturesError instanceof Error) {
            if (caughtFeaturesError.message.includes('403')) {
              // Don't set the general 'error' state here, let featuresError UI handle it
              // setError('Permission denied for audio features. You can try re-logging to grant permissions.');
            } else if (caughtFeaturesError.message.includes('401')) {
              setError('Authentication failed. Please try signing out and back in.');
            } else {
              setError(caughtFeaturesError.message); // Set general error for other feature fetch issues
            }
          } else {
            setError('An unknown error occurred while fetching audio features.');
          }
        }
        
        clearTimeout(timeoutId);
        setIsLoading(false);
      } catch (error) {
        console.error('Error fetching track data:', error);
        setError(error instanceof Error ? error.message : 'An unknown error occurred');
        setIsLoading(false);
      }
    };

    fetchTrackData();
  }, [id, token]);

  const handlePlayPause = async () => {
    if (!token || !track) return;
    
    try {
      if (isPlaying) {
        await fetch('https://api.spotify.com/v1/me/player/pause', {
          method: 'PUT',
          headers: { Authorization: `Bearer ${token}` }
        });
      } else {
        await fetch('https://api.spotify.com/v1/me/player/play', {
          method: 'PUT',
          headers: { 
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            uris: [track.uri]
          })
        });
      }
      
      setIsPlaying(!isPlaying);
    } catch (error) {
      console.error('Error controlling playback:', error);
    }
  };

  // Show timeout error message
  if (timeoutError) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-900 to-black flex items-center justify-center">
        <div className="text-center p-8 max-w-md bg-gray-800 rounded-lg">
          <AlertTriangle className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-4">Loading Taking Too Long</h2>
          <p className="text-gray-300 mb-6">
            The request to Spotify's API is taking longer than expected. This could be due to network issues or Spotify's API being slow.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button 
              onClick={() => window.location.reload()}
              className="bg-green-500 hover:bg-green-600 text-white py-2 px-4 rounded-full transition-colors"
            >
              Try Again
            </button>
            <button 
              onClick={() => navigate(-1)}
              className="bg-gray-700 hover:bg-gray-600 text-white py-2 px-4 rounded-full transition-colors"
            >
              Go Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Show error message (general errors, not specific to features if featuresError is true)
  if (error && !featuresError) { // Only show this if it's not a featuresError being handled separately
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-900 to-black flex items-center justify-center">
        <div className="text-center p-8 max-w-md bg-gray-800 rounded-lg">
          <AlertTriangle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-4">Error Loading Track</h2>
          <p className="text-gray-300 mb-6">
            {error}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button 
              onClick={() => window.location.reload()}
              className="bg-green-500 hover:bg-green-600 text-white py-2 px-4 rounded-full transition-colors"
            >
              Try Again
            </button>
            <button 
              onClick={() => navigate(-1)}
              className="bg-gray-700 hover:bg-gray-600 text-white py-2 px-4 rounded-full transition-colors"
            >
              Go Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (isLoading || !track) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-900 to-black flex items-center justify-center">
        <div className="text-center">
          <div className="animate-pulse flex flex-col items-center">
            <div className="w-32 h-32 bg-gray-700 rounded mb-4"></div>
            <div className="h-6 w-48 bg-gray-700 rounded mb-2"></div>
            <div className="h-4 w-32 bg-gray-700 rounded"></div>
          </div>
          <p className="text-gray-400 mt-6">Loading track information...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-black text-white p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header with back button */}
        <div className="flex items-center mb-8">
          <button 
            onClick={() => navigate(-1)}
            className="p-2 rounded-full bg-black/30 hover:bg-black/50 mr-4 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-2xl font-bold">Track</h1>
        </div>
        
        {/* Track info */}
        <div className="flex flex-col md:flex-row gap-8 mb-12">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-64 h-64 flex-shrink-0 mx-auto md:mx-0"
          >
            <img 
              src={track.album.images[0]?.url || '/default-cover.png'} 
              alt={track.name}
              className="w-full h-full object-cover shadow-xl rounded-md"
            />
          </motion.div>
          
          <div className="flex-1">
            <motion.h2
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-3xl md:text-4xl font-bold mb-2"
            >
              {track.name}
            </motion.h2>
            
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="text-xl text-gray-300 mb-4"
            >
              {track.artists.map(artist => artist.name).join(', ')}
            </motion.p>
            
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="text-gray-400 mb-6"
            >
              {track.album.name}
            </motion.p>
            
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="flex space-x-4 mb-8"
            >
              <button 
                onClick={handlePlayPause}
                className="bg-green-500 hover:bg-green-600 text-white rounded-full px-6 py-3 flex items-center font-medium transition-colors"
              >
                {isPlaying ? (
                  <>
                    <Pause className="w-5 h-5 mr-2" />
                    Pause
                  </>
                ) : (
                  <>
                    <Play className="w-5 h-5 mr-2" fill="white" />
                    Play
                  </>
                )}
              </button>
              
              <button className="bg-transparent hover:bg-white/10 border border-white/30 rounded-full p-3 transition-colors">
                <Heart className="w-5 h-5" />
              </button>
              
              <button className="bg-transparent hover:bg-white/10 border border-white/30 rounded-full p-3 transition-colors">
                <Share className="w-5 h-5" />
              </button>
            </motion.div>
            
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="grid grid-cols-2 sm:grid-cols-4 gap-4"
            >
              <div className="bg-white/5 p-4 rounded-lg">
                <p className="text-gray-400 text-sm">Duration</p>
                <p className="font-medium flex items-center mt-1">
                  <Clock className="w-4 h-4 mr-1" />
                  {formatDuration(track.duration_ms)}
                </p>
              </div>
              
              {features && !featuresError && ( // Conditionally render Key
                <div className="bg-white/5 p-4 rounded-lg">
                  <p className="text-gray-400 text-sm">Key</p>
                  <p className="font-medium flex items-center mt-1">
                    <Music2 className="w-4 h-4 mr-1" />
                    {keyMap[features.key]} {features.mode === 1 ? 'Major' : 'Minor'}
                  </p>
                </div>
              )}
              
              <div className="bg-white/5 p-4 rounded-lg">
                <p className="text-gray-400 text-sm">Popularity</p>
                <p className="font-medium flex items-center mt-1">
                  <Music className="w-4 h-4 mr-1" />
                  {track.popularity}%
                </p>
              </div>
              
              <div className="bg-white/5 p-4 rounded-lg">
                <p className="text-gray-400 text-sm">Release Date</p>
                <p className="font-medium flex items-center mt-1">
                  <Calendar className="w-4 h-4 mr-1" />
                  {formatDate(track.album.release_date)}
                </p>
              </div>
            </motion.div>
          </div>
        </div>
        
        {/* Audio features error message */}
        {featuresError && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="bg-red-900/30 border border-red-700 rounded-lg p-6 mb-8" // Changed to red theme for error
          >
            <div className="flex items-start gap-3">
              <AlertTriangle className="text-red-500 w-6 h-6 flex-shrink-0 mt-0.5" /> {/* Changed icon and color */}
              <div>
                <h3 className="font-bold text-lg text-white mb-2">Audio Features Unavailable</h3>
                <p className="mt-1 text-gray-300 text-sm">
                  We couldn't load the detailed audio features for this track. This might be due to permissions with your Spotify account.
                </p>
                <p className="mt-2 text-gray-300 text-sm">
                  If you'd like to try granting the necessary permissions, you can sign out and reconnect your Spotify account.
                </p>
              </div>
            </div>
            <div className="mt-4 flex gap-3 justify-end">
              <button
                onClick={signOut} // Call signOut directly
                className="bg-red-600 hover:bg-red-700 text-white rounded-full px-6 py-2 text-sm inline-flex items-center transition-colors"
              >
                Sign Out and Reconnect
              </button>
              {/* Optional: A button to just dismiss or go back if they don't want to re-login
              <button
                onClick={() => navigate(-1)}
                className="bg-gray-700 hover:bg-gray-600 text-white rounded-full px-6 py-2 text-sm inline-flex items-center transition-colors"
              >
                Go Back
              </button>
              */}
            </div>
          </motion.div>
        )}
        
        {/* Additional track details */}
        {features && !featuresError && (
          <>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
            >
              <AudioFeatures features={{
                acousticness: features.acousticness,
                danceability: features.danceability,
                energy: features.energy,
                instrumentalness: features.instrumentalness,
                liveness: features.liveness,
                speechiness: features.speechiness,
                valence: features.valence,
                tempo: features.tempo
              }} />
            </motion.div>
            
            {/* Audio Feature Radar Chart */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7 }}
            >
              <AudioFeatureRadar features={{
                acousticness: features.acousticness,
                danceability: features.danceability,
                energy: features.energy,
                instrumentalness: features.instrumentalness,
                liveness: features.liveness,
                speechiness: features.speechiness,
                valence: features.valence
              }} />
            </motion.div>
          </>
        )}
        
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
          className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-6"
        >
          {/* Conditionally render the first details box if features are available */}
          {features && !featuresError && ( 
            <div className="bg-gray-800/30 p-5 rounded-lg">
              <h3 className="text-xl font-bold mb-4">Track Details</h3>
              <table className="w-full text-sm">
                <tbody>
                  <tr className="border-b border-gray-700">
                    <td className="py-2 text-gray-400">Tempo</td>
                    <td className="py-2 text-right">{Math.round(features.tempo)} BPM</td>
                  </tr>
                  <tr className="border-b border-gray-700">
                    <td className="py-2 text-gray-400">Time Signature</td>
                    <td className="py-2 text-right">{features.time_signature}/4</td>
                  </tr>
                  <tr className="border-b border-gray-700">
                    <td className="py-2 text-gray-400">Loudness</td>
                    <td className="py-2 text-right">{features.loudness.toFixed(1)} dB</td>
                  </tr>
                  <tr>
                    <td className="py-2 text-gray-400">Album</td>
                    <td className="py-2 text-right">{track.album.name}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
          
          <div className="bg-gray-800/30 p-5 rounded-lg">
            <h3 className="text-xl font-bold mb-4">About This Track</h3>
            <p className="text-gray-300 mb-4">
              This track was released on {formatDate(track.album.release_date)} as part of the album "{track.album.name}".
            </p>
            {/* Conditionally render the part of this paragraph that uses features */}
            {features && !featuresError ? (
              <p className="text-gray-300">
                With a danceability score of {Math.round(features.danceability * 100)}% and energy level of {Math.round(features.energy * 100)}%, 
                this {features.valence > 0.5 ? 'positive and uplifting' : 'moody and atmospheric'} track has a tempo of {Math.round(features.tempo)} BPM.
              </p>
            ) : (
              <p className="text-gray-300">
                This track is performed by {track.artists.map(artist => artist.name).join(', ')}. 
                Detailed audio characteristics could not be loaded.
              </p>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default TrackPage; 