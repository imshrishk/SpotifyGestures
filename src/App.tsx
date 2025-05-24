import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Login from './pages/Login';
import Callback from './pages/Callback';
import Player from './pages/Player';
import Profile from './pages/Profile';
import Explore from './pages/Explore';
import TrackPage from './pages/TrackPage';
import Playlist from './pages/Playlist';
import Playlists from './pages/Playlists';
import Following from './pages/Following';
import Followers from './pages/Followers';

function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/callback" element={<Callback />} />
        <Route path="/player" element={<Player />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/explore" element={<Explore />} />
        <Route path="/track/:id" element={<TrackPage />} />
        <Route path="/playlist/:id" element={<Playlist />} />
        <Route path="/playlists" element={<Playlists />} />
        <Route path="/following" element={<Following />} />
        <Route path="/followers" element={<Followers />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
