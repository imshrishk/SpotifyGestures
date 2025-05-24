export const checkEnvVariables = () => {
  const clientId = import.meta.env.VITE_SPOTIFY_CLIENT_ID;
  const redirectUri = import.meta.env.VITE_REDIRECT_URI;
  
  console.log('Environment Variables Check:');
  console.log('VITE_SPOTIFY_CLIENT_ID:', clientId ? 'Set' : 'Not set');
  console.log('VITE_REDIRECT_URI:', redirectUri ? 'Set' : 'Not set');
  
  if (!clientId || !redirectUri) {
    console.error('Missing required environment variables!');
    return false;
  }
  
  // Check if the values match what we expect
  if (clientId !== '5b022d5cdcd24de69d1008d55b698823') {
    console.warn('Client ID does not match expected value');
  }
  
  if (redirectUri !== 'http://localhost:5173/callback') {
    console.warn('Redirect URI does not match expected value');
  }
  
  return true;
}; 