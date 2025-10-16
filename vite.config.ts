import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg'],
        workbox: {
          maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 5 MiB
        },
        manifest: {
          name: 'Spotify Gestures',
          short_name: 'Gestures',
          description: 'Control your Spotify music with hand gestures.',
          theme_color: '#1DB954',
          icons: [
            {
              src: 'pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png',
            },
            {
              src: 'pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
            },
          ],
        },
      }),
    ],
    define: {
      'import.meta.env.VITE_SPOTIFY_CLIENT_ID': JSON.stringify(env.VITE_SPOTIFY_CLIENT_ID || ''),
      'import.meta.env.VITE_REDIRECT_URI': JSON.stringify(env.VITE_REDIRECT_URI || ''),
      'import.meta.env.VITE_SPOTIFY_AUTH_ENDPOINT': JSON.stringify(env.VITE_SPOTIFY_AUTH_ENDPOINT || 'https://accounts.spotify.com/authorize'),
      'import.meta.env.VITE_SPOTIFY_TOKEN_ENDPOINT': JSON.stringify(env.VITE_SPOTIFY_TOKEN_ENDPOINT || 'https://accounts.spotify.com/api/token'),
      'import.meta.env.VITE_MUSIXMATCH_API_KEY': JSON.stringify(env.VITE_MUSIXMATCH_API_KEY || ''),
      'import.meta.env.VITE_GENIUS_CLIENT_ID': JSON.stringify(env.VITE_GENIUS_CLIENT_ID || ''),
      'import.meta.env.VITE_GENIUS_CLIENT_SECRET': JSON.stringify(env.VITE_GENIUS_CLIENT_SECRET || ''),
      'import.meta.env.VITE_GENIUS_ACCESS_TOKEN': JSON.stringify(env.VITE_GENIUS_ACCESS_TOKEN || ''),
      'import.meta.env.VITE_LASTFM_API_KEY': JSON.stringify(env.VITE_LASTFM_API_KEY || ''),
      'import.meta.env.VITE_SOCKET_URL': JSON.stringify(env.VITE_SOCKET_URL || ''),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      port: 5173,
      host: true,
    },
  };
});

