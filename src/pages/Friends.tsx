import React, { useEffect, useState } from 'react';
import useSpotifyStore from '../stores/useSpotifyStore';

const Friends: React.FC = () => {
  const { token } = useSpotifyStore();
  const [following, setFollowing] = useState<any[]>([]);
  const [friendsActivity, setFriendsActivity] = useState<any[]>([]);

  useEffect(() => {
    const fetchFollowing = async () => {
      if (token) {
        // TODO: Implement getUserFollowedArtists or use a correct method from SpotifyApi
        // const followedArtists = await SpotifyApi.getUserFollowedArtists(token);
        const followedArtists: any[] = [];
        setFollowing(Array.isArray(followedArtists) ? followedArtists : []);
      }
    };

    fetchFollowing();
  }, [token]);

  useEffect(() => {
    const fetchFriendsActivity = async () => {
      if (token && following.length > 0) {
        // TODO: Implement getCurrentlyPlaying or use a correct method from SpotifyApi
        // const currentlyPlaying = await SpotifyApi.getCurrentlyPlaying(token);
        const currentlyPlaying: any = null;
        if (currentlyPlaying && currentlyPlaying.item) {
          const activity = following.map((friend: any) => ({
            user: friend,
            track: currentlyPlaying.item
          }));
          setFriendsActivity(activity);
        }
      }
    };

    fetchFriendsActivity();
  }, [token, following]);

  return (
    <div className="p-8 text-white">
      <h1 className="text-3xl font-bold mb-6">Friend Activity</h1>
      <div className="space-y-4">
        {friendsActivity.map((activity, index) => (
          <div key={index} className="flex items-center bg-gray-800 p-4 rounded-lg">
            <img src={activity.user.images[0]?.url} alt={activity.user.name} className="w-12 h-12 rounded-full mr-4" />
            <div>
              <p className="font-semibold">{activity.user.name}</p>
              <p className="text-gray-400">{activity.track.name} - {activity.track.artists.map((artist: any) => artist.name).join(', ')}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Friends;
