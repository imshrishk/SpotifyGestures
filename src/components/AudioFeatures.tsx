import React from 'react';

interface AudioFeatureProps {
  features: {
    acousticness: number;
    danceability: number;
    energy: number;
    instrumentalness: number;
    liveness: number;
    speechiness: number;
    valence: number;
    tempo?: number;
  };
}

const FeatureBar: React.FC<{ label: string; value: number; description: string }> = ({
  label,
  value,
  description
}) => {
  // Convert the 0-1 value to a percentage
  const percentage = Math.round(value * 100);
  
  return (
    <div className="mb-4">
      <div className="flex justify-between mb-1">
        <div className="flex items-center">
          <span className="text-sm font-medium text-gray-300">{label}</span>
          <div className="ml-2 group relative">
            <span className="cursor-help text-gray-500 text-xs">ⓘ</span>
            <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block bg-gray-800 text-xs text-gray-300 p-2 rounded w-48 shadow-lg z-10">
              {description}
            </div>
          </div>
        </div>
        <span className="text-sm font-medium text-gray-300">{percentage}%</span>
      </div>
      <div className="w-full bg-gray-700 rounded-full h-2">
        <div 
          className="bg-green-500 h-2 rounded-full" 
          style={{ width: `${percentage}%` }}
        ></div>
      </div>
    </div>
  );
};

const AudioFeatures: React.FC<AudioFeatureProps> = ({ features }) => {
  return (
    <div className="bg-gray-800/30 p-5 rounded-lg">
      <h3 className="text-xl font-bold mb-4">Audio Features</h3>
      
      <FeatureBar 
        label="Danceability" 
        value={features.danceability} 
        description="How suitable a track is for dancing based on tempo, rhythm stability, beat strength, and overall regularity"
      />
      
      <FeatureBar 
        label="Energy" 
        value={features.energy} 
        description="Represents a perceptual measure of intensity and activity. Energetic tracks feel fast, loud, and noisy"
      />
      
      <FeatureBar 
        label="Valence" 
        value={features.valence} 
        description="The musical positiveness conveyed by a track. High valence sounds more positive (happy, cheerful)"
      />
      
      <FeatureBar 
        label="Acousticness" 
        value={features.acousticness} 
        description="A confidence measure from 0.0 to 1.0 of whether the track is acoustic"
      />
      
      <FeatureBar 
        label="Instrumentalness" 
        value={features.instrumentalness} 
        description="Predicts whether a track contains no vocals. The closer to 1.0, the greater likelihood the track is instrumental"
      />
      
      <FeatureBar 
        label="Liveness" 
        value={features.liveness} 
        description="Detects the presence of an audience in the recording. Higher liveness values represent a higher probability the track was performed live"
      />
      
      <FeatureBar 
        label="Speechiness" 
        value={features.speechiness} 
        description="Detects the presence of spoken words in a track. The more exclusively speech-like the recording, the closer to 1.0"
      />
    </div>
  );
};

export default AudioFeatures; 