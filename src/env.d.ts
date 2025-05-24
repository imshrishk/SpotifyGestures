/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SPOTIFY_CLIENT_ID: string
  readonly VITE_SPOTIFY_CLIENT_SECRET: string
  readonly VITE_REDIRECT_URI: string
  readonly VITE_MUSIXMATCH_API_KEY: string
  readonly VITE_GENIUS_CLIENT_ID: string
  readonly VITE_GENIUS_CLIENT_SECRET: string
  readonly VITE_GENIUS_ACCESS_TOKEN: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
} 