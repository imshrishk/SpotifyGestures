function base64URLEncode(str: ArrayBuffer): string {
    return btoa(String.fromCharCode(...new Uint8Array(str)))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
}

export async function generateCodeChallenge(verifier: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(verifier);
    const digest = await window.crypto.subtle.digest('SHA-256', data);
    return base64URLEncode(digest);
}

export function generateCodeVerifier(length = 128): string {
    // Use a conservative charset matching the tests: alphanumeric plus - and _
    const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
    let result = '';
    const array = new Uint32Array(length);
    window.crypto.getRandomValues(array);
    for (let i = 0; i < length; i++) {
        result += charset[array[i] % charset.length];
    }
    return result;
}

export const authCreds = {
    client_id: import.meta.env.VITE_SPOTIFY_CLIENT_ID,
    redirect_uri: import.meta.env.VITE_REDIRECT_URI || 'http://localhost:5173/callback',
    auth_endpoint: import.meta.env.VITE_SPOTIFY_AUTH_ENDPOINT || 'https://accounts.spotify.com/authorize',
    token_endpoint: import.meta.env.VITE_SPOTIFY_TOKEN_ENDPOINT || 'https://accounts.spotify.com/api/token',
    response_type: 'code',
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

// Proactively log when critical envs are missing to aid debugging in dev
try {
    if (!authCreds.client_id) {
        console.error('[authCreds] Missing VITE_SPOTIFY_CLIENT_ID. Ensure .env.local is loaded and server restarted.');
    }
    if (!authCreds.redirect_uri) {
        console.error('[authCreds] Missing VITE_REDIRECT_URI. Set it in .env.local (e.g., http://localhost:5173/callback)');
    }
} catch {}