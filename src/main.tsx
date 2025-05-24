import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Check environment variables
console.log('Environment Variables Check:');
console.log('VITE_SPOTIFY_CLIENT_ID:', import.meta.env.VITE_SPOTIFY_CLIENT_ID ? 'Set' : 'Not set');
console.log('VITE_REDIRECT_URI:', import.meta.env.VITE_REDIRECT_URI ? 'Set' : 'Not set');

// Set initial theme before React loads
const rootElement = document.getElementById('root');
if (rootElement) {
  // Check system preference
  const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  
  // Check localStorage
  const storedTheme = localStorage.getItem('theme');
  const prefersDark = storedTheme === 'dark' || (!storedTheme && isDark);
  
  // Apply theme
  if (prefersDark) {
    document.documentElement.classList.add('dark');
  }
  
  // Listen for system theme changes
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    if (!localStorage.getItem('theme')) {
      document.documentElement.classList.toggle('dark', e.matches);
    }
  });

  // Create root and render app
  const root = createRoot(rootElement);
  root.render(
    <StrictMode>
      <App />
    </StrictMode>
  );
}
