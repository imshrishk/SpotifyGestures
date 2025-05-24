import React from 'react';
import { Info } from 'lucide-react';
import { requestAdditionalScopes } from '../lib/spotify';

const AudioFeatureErrorBanner: React.FC = () => {
  const handleReauthorize = () => {
    // Log for debugging
    console.log('Sign Out and Reconnect button clicked');
    try {
      // Use the dedicated function to request additional scopes instead of sign out
      requestAdditionalScopes();
    } catch (error) {
      console.error('Error during reauthorization:', error);
      // Force a redirect to the login page if requestAdditionalScopes fails
      window.location.href = '/';
    }
  };

  return (
    <div className="bg-[#111827] rounded-lg p-6 border border-[#1e293b]">
      <div className="flex items-start gap-3">
        <Info className="text-yellow-500 w-6 h-6 flex-shrink-0 mt-0.5" />
        <div>
          <h3 className="text-xl font-bold text-white mb-3">Audio Features Not Available</h3>
          <p className="text-gray-400 mb-3">
            We couldn't access the audio features for this track. This could be due to your Spotify account permissions or API limitations.
          </p>
          <p className="text-gray-400 mb-6">
            You can try signing out and signing back in with your Spotify account to grant additional permissions.
          </p>
          <button
            onClick={handleReauthorize}
            className="px-8 py-3 bg-green-500 hover:bg-green-600 text-white rounded-full transition-colors text-sm font-medium"
          >
            Sign Out and Reconnect
          </button>
        </div>
      </div>
    </div>
  );
};

export default AudioFeatureErrorBanner; 