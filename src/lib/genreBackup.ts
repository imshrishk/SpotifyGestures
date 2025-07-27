interface GenreResult {
  genres: string[];
  source: 'musicbrainz' | 'lastfm' | 'spotify';
  success: boolean;
  error?: string;
}

// MusicBrainz API
export const getGenresFromMusicBrainz = async (trackName: string, artistName: string): Promise<GenreResult> => {
  try {
    // First, search for the recording
    const searchUrl = `https://musicbrainz.org/ws/2/recording/?query=recording:"${encodeURIComponent(trackName)}" AND artist:"${encodeURIComponent(artistName)}"&fmt=json`;
    
    const searchResponse = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'SpotifyGestures/0.2.0 (https://github.com/SpotifyGestures/)'
      }
    });

    if (!searchResponse.ok) {
      throw new Error(`MusicBrainz search failed: ${searchResponse.status}`);
    }

    const searchData = await searchResponse.json();
    
    if (!searchData.recordings || searchData.recordings.length === 0) {
      return { genres: [], source: 'musicbrainz', success: false, error: 'No recordings found' };
    }

    // Get the first recording's details
    const recordingId = searchData.recordings[0].id;
    const recordingUrl = `https://musicbrainz.org/ws/2/recording/${recordingId}?inc=releases+tags&fmt=json`;
    
    const recordingResponse = await fetch(recordingUrl, {
      headers: {
        'User-Agent': 'SpotifyGestures/0.2.0 (https://github.com/SpotifyGestures/)'
      }
    });

    if (!recordingResponse.ok) {
      throw new Error(`MusicBrainz recording fetch failed: ${recordingResponse.status}`);
    }

    const recordingData = await recordingResponse.json();
    
    // Extract genres from tags and releases
    const genres: string[] = [];
    
    // Get tags from the recording
    if (recordingData.tags) {
      recordingData.tags.forEach((tag: any) => {
        if (tag.name && !genres.includes(tag.name)) {
          genres.push(tag.name);
        }
      });
    }
    
    // Get genres from releases
    if (recordingData.releases) {
      recordingData.releases.forEach((release: any) => {
        if (release.tags) {
          release.tags.forEach((tag: any) => {
            if (tag.name && !genres.includes(tag.name)) {
              genres.push(tag.name);
            }
          });
        }
      });
    }

    return { 
      genres: genres.slice(0, 5), // Limit to 5 genres
      source: 'musicbrainz', 
      success: true 
    };
  } catch (error) {
    console.error('MusicBrainz API error:', error);
    return { 
      genres: [], 
      source: 'musicbrainz', 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
};

// Last.fm API
const LASTFM_API_KEY = process.env.VITE_LASTFM_API_KEY || 'YOUR_LASTFM_API_KEY';

export const getGenresFromLastfm = async (trackName: string, artistName: string): Promise<GenreResult> => {
  try {
    // Get track info from Last.fm
    const trackUrl = `https://ws.audioscrobbler.com/2.0/?method=track.getInfo&artist=${encodeURIComponent(artistName)}&track=${encodeURIComponent(trackName)}&api_key=${LASTFM_API_KEY}&format=json`;
    
    const trackResponse = await fetch(trackUrl);
    
    if (!trackResponse.ok) {
      throw new Error(`Last.fm track API failed: ${trackResponse.status}`);
    }

    const trackData = await trackResponse.json();
    
    if (trackData.error) {
      return { 
        genres: [], 
        source: 'lastfm', 
        success: false, 
        error: trackData.message || 'Track not found' 
      };
    }

    const genres: string[] = [];
    
    // Get genres from track tags
    if (trackData.track && trackData.track.toptags && trackData.track.toptags.tag) {
      trackData.track.toptags.tag.forEach((tag: any) => {
        if (tag.name && !genres.includes(tag.name)) {
          genres.push(tag.name);
        }
      });
    }

    // If no track genres, try artist genres
    if (genres.length === 0) {
      const artistUrl = `https://ws.audioscrobbler.com/2.0/?method=artist.getInfo&artist=${encodeURIComponent(artistName)}&api_key=${LASTFM_API_KEY}&format=json`;
      
      const artistResponse = await fetch(artistUrl);
      
      if (artistResponse.ok) {
        const artistData = await artistResponse.json();
        
        if (artistData.artist && artistData.artist.tags && artistData.artist.tags.tag) {
          artistData.artist.tags.tag.forEach((tag: any) => {
            if (tag.name && !genres.includes(tag.name)) {
              genres.push(tag.name);
            }
          });
        }
      }
    }

    return { 
      genres: genres.slice(0, 5), // Limit to 5 genres
      source: 'lastfm', 
      success: true 
    };
  } catch (error) {
    console.error('Last.fm API error:', error);
    return { 
      genres: [], 
      source: 'lastfm', 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
};

// Main backup genre function that tries multiple sources
export const getBackupGenres = async (trackName: string, artistName: string): Promise<GenreResult> => {

  const musicbrainzResult = await getGenresFromMusicBrainz(trackName, artistName);
  
  if (musicbrainzResult.success && musicbrainzResult.genres.length > 0) {
    return musicbrainzResult;
  }

  // Try Last.fm if MusicBrainz fails
  const lastfmResult = await getGenresFromLastfm(trackName, artistName);
  
  if (lastfmResult.success && lastfmResult.genres.length > 0) {
    return lastfmResult;
  }

  // If both fail, return the last result or empty
  return lastfmResult.success ? lastfmResult : musicbrainzResult;
};

// Cache for backup genres to avoid repeated API calls
const backupGenreCache = new Map<string, GenreResult>();

export const getCachedBackupGenres = async (trackName: string, artistName: string): Promise<GenreResult> => {
  const cacheKey = `${trackName}-${artistName}`.toLowerCase();
  
  if (backupGenreCache.has(cacheKey)) {
    return backupGenreCache.get(cacheKey)!;
  }

  const result = await getBackupGenres(trackName, artistName);
  backupGenreCache.set(cacheKey, result);
  
  return result;
};
