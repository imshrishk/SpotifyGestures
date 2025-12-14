
import { getAverageAudioFeatures } from './audioFeatures';

export interface RecommendationSlab {
    type: 'mood' | 'discovery' | 'familiar';
    label: string;
    description: string;
    tracks: SpotifyApi.TrackObjectFull[];
}

/**
 * Strategy: Mood Match
 * Uses recent tracks to find a target energy/valence and returns songs with that vibe.
 */
export async function getMoodSlab(
    token: string,
    recentTracks: SpotifyApi.PlayHistoryObject[]
): Promise<RecommendationSlab> {
    const distinctRecent = recentTracks
        .map(item => item.track)
        .filter((track, index, self) => index === self.findIndex(t => t.id === track.id)) // Unique by ID
        .slice(0, 5);

    if (distinctRecent.length === 0) {
        // Fallback: Fetch some generic "happy" tracks for new users
        const fallbackTracks = await fetchRecommendations(token, {
            seed_genres: 'pop',
            min_energy: 0.6,
            min_valence: 0.6,
            limit: 10
        });

        return {
            type: 'mood',
            label: 'Mood Match',
            description: 'Start your journey with some upbeat vibes!',
            tracks: fallbackTracks
        };
    }

    const avgFeatures = await getAverageAudioFeatures(token, distinctRecent.map(t => t.id));

    // Seed with the last 2 tracks for continuity
    const seedTracks = distinctRecent.slice(0, 2).map(t => t.id);

    // Build params
    const params: any = {
        seed_tracks: seedTracks.join(','),
        limit: 10,
    };

    if (avgFeatures) {
        params.target_energy = avgFeatures.energy;
        params.target_valence = avgFeatures.valence;
        // Add a bit of wiggle room (min/max) to ensure we don't get 0 results
        // Actually target_ is usually enough for Spotify
    }

    const tracks = await fetchRecommendations(token, params);
    return {
        type: 'mood',
        label: 'Mood Match',
        description: avgFeatures
            ? `Based on your recent vibe (Energy: ${Math.round(avgFeatures.energy * 100)}%)`
            : 'Based on your recent listening',
        tracks
    };
}

/**
 * Strategy: Deep Discovery
 * Uses a favorite genre but excludes top artists to find hidden gems.
 */
export async function getDiscoverySlab(
    token: string,
    seedGenres: string[],
    topArtistIds: string[]
): Promise<RecommendationSlab> {
    if (seedGenres.length === 0) {
        // Fallback: Use popular genres
        // We reassign seedGenres so the code below executes normally
        seedGenres = ['pop', 'dance', 'rock', 'hip-hop'];
    }

    // Pick 1 random genre from the seeds
    const genre = seedGenres[Math.floor(Math.random() * seedGenres.length)];

    const params: any = {
        seed_genres: genre,
        limit: 10,
        target_popularity: 35, // Low popularity for "Deep" discovery
        min_popularity: 0,
        // Removed max_popularity to avoid 0 results
    };

    const tracks = await fetchRecommendations(token, params);

    // Client-side filter: Remove any tracks by user's top artists to ensure "Discovery"
    const filtered = tracks.filter(t => !t.artists.some(a => topArtistIds.includes(a.id)));

    return {
        type: 'discovery',
        label: 'Deep Discovery',
        description: `Hidden gems in ${genre}`,
        tracks: filtered
    };
}

/**
 * Strategy: Familiar Favorites
 * Uses top artists but asks for variety to find similar artists.
 */
export async function getFamiliarSlab(
    token: string,
    topArtistIds: string[]
): Promise<RecommendationSlab> {
    if (topArtistIds.length === 0) {
        // Fallback: Fetch popular tracks if no top artists
        const fallbackTracks = await fetchRecommendations(token, {
            seed_genres: 'pop',
            min_popularity: 70,
            limit: 10
        });
        return {
            type: 'familiar',
            label: 'Popular Favorites',
            description: 'Trending tracks to get you started',
            tracks: fallbackTracks
        };
    }

    // Shuffle and pick 2 artists
    const seeds = topArtistIds.sort(() => 0.5 - Math.random()).slice(0, 2);

    const params: any = {
        seed_artists: seeds.join(','),
        limit: 10,
        min_popularity: 50, // Generally well-known
    };

    const tracks = await fetchRecommendations(token, params);

    // Filter out the seed artists themselves so we get *similar* artists, not the same ones
    const filtered = tracks.filter(t => !t.artists.some(a => seeds.includes(a.id)));

    return {
        type: 'familiar',
        label: 'Familiar Favorites',
        description: `Inspired by ${seeds.length} of your favorites`,
        tracks: filtered
    };
}


async function fetchRecommendations(token: string, params: Record<string, string | number>): Promise<SpotifyApi.TrackObjectFull[]> {
    try {
        const query = new URLSearchParams();
        Object.entries(params).forEach(([k, v]) => query.append(k, String(v)));

        const url = `https://api.spotify.com/v1/recommendations?${query.toString()}`;
        console.log('[fetchRecommendations] Fetching:', url);

        const res = await fetch(url, {
            headers: { Authorization: `Bearer ${token}` }
        });

        if (!res.ok) return [];
        const data = await res.json();
        return data.tracks || [];
    } catch (e) {
        console.error('[fetchRecommendations] Error:', e);
        return [];
    }
}
