
import { SpotifyApi } from './spotifyApi';

/**
 * Calculates average audio features for a list of tracks.
 * Used to determine the "mood" of a set of tracks.
 */
export async function getAverageAudioFeatures(
    token: string,
    trackIds: string[]
): Promise<{ energy: number; valence: number; danceability: number } | null> {
    if (!trackIds.length) return null;

    // Spotify allows fetching features for up to 100 tracks at once
    // We'll safeguard by slicing to 50 just in case
    const ids = trackIds.slice(0, 50);

    try {
        const chunkDetails = await SpotifyApi.getAudioFeaturesForTracks(token, ids);
        if (!chunkDetails || !Array.isArray(chunkDetails.audio_features)) {
            console.warn('[getAverageAudioFeatures] Invalid response format', chunkDetails);
            return null;
        }

        const features = chunkDetails.audio_features.filter((f: any) => f !== null);
        if (features.length === 0) return null;

        const total = features.reduce(
            (acc: { energy: number; valence: number; danceability: number }, curr: { energy: number; valence: number; danceability: number }) => ({
                energy: acc.energy + (curr.energy || 0),
                valence: acc.valence + (curr.valence || 0),
                danceability: acc.danceability + (curr.danceability || 0),
            }),
            { energy: 0, valence: 0, danceability: 0 }
        );

        return {
            energy: total.energy / features.length,
            valence: total.valence / features.length,
            danceability: total.danceability / features.length,
        };
    } catch (error) {
        console.error('[getAverageAudioFeatures] Failed to fetch features:', error);
        return null;
    }
}
