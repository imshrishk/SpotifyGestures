import axios from 'axios';

const SPOTIFY_API = 'https://api.spotify.com/v1';

/**
 * Fetch Spotify-style recommendations via the prompt-based search API.
 * Accepts seed tracks, artists, and genres, and builds a natural-language prompt.
 */
export async function getSpotifyRecommendations(
  accessToken: string,
  {
    seedTracks = [],
    seedArtists = [],
    seedGenres = [],
    limit = 10,
  }: {
    seedTracks?: string[];
    seedArtists?: string[];
    seedGenres?: string[];
    limit?: number;
  }
) {
  if (!accessToken) throw new Error('Missing Spotify access token');

  let prompt = 'recommend songs';
  if (seedTracks.length) prompt += ` like ${seedTracks.length > 1 ? 'these tracks' : 'this track'}`;
  if (seedArtists.length) prompt += ` by artists similar to ${seedArtists.length > 1 ? 'these artists' : 'this artist'}`;
  if (seedGenres.length) prompt += ` in the genres ${seedGenres.join(', ')}`;
  prompt += ` (limit ${limit})`;

  try {
    const res = await axios.post(
      `${SPOTIFY_API}/search`,
      { prompt },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    // Try common shapes
    const tracks = res.data?.tracks?.items ?? res.data?.results ?? [];
    return (Array.isArray(tracks) ? tracks : []).slice(0, limit);
  } catch (err: any) {
    // Surface minimal error but avoid crashing callers
    console.error('[getSpotifyRecommendations] Error:', err?.response?.data || err?.message || err);
    return [];
  }
}


