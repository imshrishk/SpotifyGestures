import React from 'react';
import { Link, useLocation, Navigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Home,
  ListMusic,
  History,
  Lightbulb,
  
  LogOut,
  User,
  Mic,
  Users
} from 'lucide-react';
import useSpotifyStore from '../stores/useSpotifyStore';
import useVoiceCommands from '../hooks/useVoiceCommands';

interface NavItemProps {
  to: string;
  icon: React.ReactNode;
  label: string;
  isActive: boolean;
}

const NavItem: React.FC<NavItemProps> = ({ to, icon, label, isActive }) => (
  <Link
    to={to}
    className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition-all duration-200
      ${isActive 
        ? 'bg-[var(--background-pressed)] text-[var(--primary)]' 
        : 'text-[var(--text-secondary)] hover:bg-[var(--background-pressed)] hover:text-[var(--text-primary)]'
      }`}
  >
    {icon}
    <span className="font-medium">{label}</span>
  </Link>
);

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const { clearSession, user, token } = useSpotifyStore();
  const { isListening, setIsListening } = useVoiceCommands();

  const [checkingAuth, setCheckingAuth] = React.useState(true);
  React.useEffect(() => {
    console.debug('[Layout] mount/update: token:', token, 'user:', user ? user.id : null);
  }, [token, user]);

  // Wait briefly for persisted zustand rehydration to complete if there is
  // evidence in localStorage that a session exists. This avoids an immediate
  // redirect back to /login when the app reloads from the OAuth callback.
  React.useEffect(() => {
    let mounted = true;

    const persisted = !!(localStorage.getItem('spotify-storage') || localStorage.getItem('spotify_token'));
    if (!persisted) {
      // No persisted auth at all — allow normal redirect logic to run
      console.debug('[Layout] no persisted session found');
      if (mounted) setCheckingAuth(false);
      return () => { mounted = false; };
    }

    // If we already have a token in the store, we're done
    if (token) {
      console.debug('[Layout] token already in store, skipping wait');
      if (mounted) setCheckingAuth(false);
      return () => { mounted = false; };
    }

  // Poll for a short time for the store to be rehydrated (max 2000ms)
    const start = Date.now();
    const interval = setInterval(() => {
      const nowToken = useSpotifyStore.getState().token;
      if (!mounted) return;
        console.debug('[Layout] polling for rehydration: nowToken=', nowToken);
      if (nowToken) {
        setCheckingAuth(false);
        clearInterval(interval);
        return;
      }
      if (Date.now() - start > 2000) {
        // Timeout — stop waiting
        setCheckingAuth(false);
        clearInterval(interval);
      }
    }, 80);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [token]);

  // Redirect to login if not authenticated and we've finished waiting for
  // rehydration. While checkingAuth is true, show a lightweight loader so
  // the app doesn't bounce the user to /login prematurely.
  if (!token && !checkingAuth && location.pathname !== '/login') {
    return <Navigate to="/login" replace />;
  }

  if (checkingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-primary text-white">
        <div className="animate-pulse text-center">
          <div className="h-8 w-8 rounded-full bg-green-500 mx-auto mb-4"></div>
          <div>Restoring session…</div>
        </div>
      </div>
    );
  }

  const navItems = [
    { to: '/player', icon: <Home size={20} />, label: 'Now Playing' },
    { to: '/player/playlists', icon: <ListMusic size={20} />, label: 'Playlists' },
    { to: '/player/recommendations', icon: <Lightbulb size={20} />, label: 'Recommendations' },
    { to: '/player/history', icon: <History size={20} />, label: 'History' },
    { to: '/friends', icon: <Users size={20} />, label: 'Friends' },
  ];

  return (
    
<div className="min-h-screen flex bg-primary text-white">
  <motion.aside
    initial={{ x: -250 }}
    animate={{ x: 0 }}
    className="w-64 bg-accent p-4 flex flex-col shadow-lg"
  >

        <div className="mb-6">
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="flex items-center space-x-3 p-4 rounded-lg bg-[var(--background)]"
          >
            {user?.images && user.images.length > 0 ? (
              <img 
                src={user.images[0].url} 
                alt={user.display_name} 
                className="w-10 h-10 rounded-full"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-[var(--primary)] flex items-center justify-center">
                <User size={20} />
              </div>
            )}
            <div>
              <h3 className="font-bold text-[var(--text-primary)]">{user?.display_name || 'User'}</h3>
              <p className="text-xs text-[var(--text-secondary)]">Spotify Premium</p>
            </div>
          </motion.div>
        </div>

        <div className="flex-1 space-y-2">
          {navItems.map((item, index) => (
            <motion.div
              key={item.to}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 * index }}
            >
              <NavItem
                to={item.to}
                icon={item.icon}
                label={item.label}
                isActive={location.pathname === item.to}
              />
            </motion.div>
          ))}
        </div>
        
        <div className="space-y-2 mt-6">
          <motion.button
            onClick={() => setIsListening(!isListening)}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-all duration-200 ${isListening ? 'bg-red-500 text-white' : 'text-[var(--text-secondary)] hover:bg-[var(--background-pressed)] hover:text-[var(--text-primary)]'}`}
          >
            <Mic size={20} />
            <span className="font-medium">{isListening ? 'Stop Listening' : 'Start Voice Commands'}</span>
          </motion.button>
          <motion.button
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            onClick={() => clearSession()}
            className="w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-[var(--text-secondary)] 
                     hover:bg-[var(--background-pressed)] hover:text-[var(--text-primary)] transition-all duration-200"
          >
            <LogOut size={20} />
            <span className="font-medium">Logout</span>
          </motion.button>
        </div>
      </motion.aside>

      {/* Main content */}
      <main className="flex-1 p-6 overflow-auto custom-scrollbar">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="h-full"
        >
          {children}
        </motion.div>
      </main>
    </div>
  );
};

export default Layout;