interface ImportMetaEnv {
    readonly VITE_SPOTIFY_CLIENT_ID: string;
    readonly VITE_REDIRECT_URI: string;
    readonly VITE_MUSIXMATCH_API_KEY: string;
  }
  
  interface ImportMeta {
    readonly env: ImportMetaEnv;
  }
  