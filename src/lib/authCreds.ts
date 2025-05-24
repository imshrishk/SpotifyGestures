const charset = "abcdefghijklmnopqrstuvwxyz0123456789";

const generateRandomString = (): string => {
    let text = "";
    for (var i = 0; i <= 16; i++)
        text += charset.charAt(Math.floor(Math.random() * charset.length));
    return text;
}

interface AuthCredentials {
    client_id: string;
    client_secret: string;
    redirect_uri: string;
    auth_endpoint: string;
    response_type: string;
    state: string;
    scope: string;
}

export const authCreds = {
    client_id: import.meta.env.VITE_SPOTIFY_CLIENT_ID,
    client_secret: import.meta.env.VITE_SPOTIFY_CLIENT_SECRET,
    redirect_uri: import.meta.env.VITE_REDIRECT_URI || 'http://localhost:5173/callback',
    auth_endpoint: 'https://accounts.spotify.com/authorize',
    response_type: 'token',
    state: 'spotify-auth',
    scope: [
        'user-read-email',
        'user-read-private',
        'user-read-playback-state',
        'user-modify-playback-state',
        'user-read-currently-playing',
        'user-read-recently-played',
        'user-top-read',
        'playlist-read-private',
        'playlist-read-collaborative',
        'playlist-modify-public',
        'playlist-modify-private',
        'user-follow-read',
        'user-follow-modify',
        'user-library-read',
        'user-library-modify',
        'streaming',
        'app-remote-control'
    ].join(' ')
}; 