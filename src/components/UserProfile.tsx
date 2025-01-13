import React from 'react';
import { LogOut, User } from 'lucide-react';
import useSpotifyStore from '../stores/useSpotifyStore';
import { useNavigate } from 'react-router-dom';

const UserProfile: React.FC = () => {
  const { user, clearSession } = useSpotifyStore();
  const navigate = useNavigate();

  const handleLogout = () => {
    clearSession();
    navigate('/');
  };

  if (!user) return null;

  return (
    <div className="flex items-center gap-3 bg-gray-800 rounded-lg p-3">
      {user.images?.[0]?.url ? (
        <img
          src={user.images[0].url}
          alt={user.display_name}
          className="w-10 h-10 rounded-full"
        />
      ) : (
        <User className="w-10 h-10 p-2 bg-gray-700 rounded-full" />
      )}
      <div className="flex-1">
        <p className="font-medium">{user.display_name}</p>
        <p className="text-sm text-gray-400">Connected to Spotify</p>
      </div>
      <button
        onClick={handleLogout}
        className="p-2 hover:bg-gray-700 rounded-full transition-colors"
        title="Logout"
      >
        <LogOut className="w-5 h-5" />
      </button>
    </div>
  );
};

export default UserProfile;
