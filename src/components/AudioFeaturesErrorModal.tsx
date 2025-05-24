import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Info } from 'lucide-react';
import { motion } from 'framer-motion';
import { signOut } from '../lib/spotify';

interface AudioFeaturesErrorModalProps {
  onDismiss: () => void;
  inlineStyle?: boolean;
}

const AudioFeaturesErrorModal: React.FC<AudioFeaturesErrorModalProps> = ({ 
  onDismiss, 
  inlineStyle = false 
}) => {
  const navigate = useNavigate();

  const handleSignOut = () => {
    signOut();
    navigate('/');
  };

  if (inlineStyle) {
    return (
      <div className="bg-[#111827] rounded-lg p-6 border border-[#1e293b]">
        <div className="flex items-start gap-3 mb-4">
          <Info className="text-yellow-500 w-6 h-6 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="text-xl font-bold text-white mb-3">Audio Features Not Available</h3>
            <p className="text-[#94a3b8] mb-3">
              We couldn't access the audio features for this track. This could be due to your Spotify account permissions or API limitations.
            </p>
            <p className="text-[#94a3b8] mb-6">
              You can try signing out and signing back in with your Spotify account to grant additional permissions.
            </p>
            <button
              onClick={handleSignOut}
              className="px-8 py-3 bg-green-500 hover:bg-green-600 text-white rounded-full transition-colors text-sm font-medium"
            >
              Sign Out and Reconnect
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gray-800 rounded-lg p-6 max-w-md w-full"
      >
        <div className="flex items-center gap-3 mb-4">
          <Info className="text-yellow-500 w-6 h-6" />
          <h3 className="text-xl font-bold">Audio Features Not Available</h3>
        </div>
        <p className="mb-4 text-gray-300">
          We couldn't access the audio features for this track. This could be due to your Spotify account permissions or API limitations.
        </p>
        <p className="mb-6 text-gray-300">
          You can try signing out and signing back in with your Spotify account to grant additional permissions.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-end">
          <button
            onClick={onDismiss}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-full transition-colors"
          >
            Dismiss
          </button>
          <button
            onClick={handleSignOut}
            className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-full transition-colors"
          >
            Sign Out and Reconnect
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default AudioFeaturesErrorModal; 