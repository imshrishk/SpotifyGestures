import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  // Set the third parameter to '' to load all env regardless of the `VITE_` prefix.
  const env = loadEnv(mode, process.cwd(), '');
  
  console.log('Vite Config - Environment Variables:');
  console.log('VITE_SPOTIFY_CLIENT_ID:', env.VITE_SPOTIFY_CLIENT_ID ? 'Set' : 'Not set');
  console.log('VITE_REDIRECT_URI:', env.VITE_REDIRECT_URI ? 'Set' : 'Not set');
  
  return {
    plugins: [react()],
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
