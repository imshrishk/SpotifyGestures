import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import useSpotifyStore from '../stores/useSpotifyStore';
import { getTopTracks, getTopArtists, getRecommendations } from '../lib/spotify';
import { Loader2, Sparkles, Music, User, Flame, RefreshCw, Plus, Play, Award, X } from 'lucide-react';

interface TopItem {
    id: string;
    name: string;
    type: 'artist' | 'track';
    images?: Array<{ url: string }>;
    album?: {
        images: Array<{ url: string }>
    };
    artists?: Array<{ name: string }>;
}

interface RecommendationTrack {
    id: string;
    name: string;
    uri: string;
    artists: Array<{ id?: string, name: string }>;
    album: {
        name: string;
        images: Array<{ url: string }>
    };
    popularity?: number;
    genres?: string[];
}

interface AudioFeatureFilters {
    minEnergy?: number;
    maxEnergy?: number;
    minDanceability?: number;
    maxDanceability?: number;
    minValence?: number;
    maxValence?: number;
    minPopularity?: number;
    maxPopularity?: number;
}

const ExploreRecommendations: React.FC = () => {
    const { token, currentTrack } = useSpotifyStore();
    const [selectedGenres] = useState<string[]>([]);
    const [topArtists, setTopArtists] = useState<TopItem[]>([]);
    const [topTracks, setTopTracks] = useState<TopItem[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [recommendations, setRecommendations] = useState<RecommendationTrack[]>([]);
    const [selectedItems, setSelectedItems] = useState<TopItem[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [timeRange, setTimeRange] = useState<'short_term' | 'medium_term' | 'long_term'>('medium_term');
    const [featureFilters, setFeatureFilters] = useState<AudioFeatureFilters>({
        minEnergy: 0,
        maxEnergy: 1,
        minDanceability: 0,
        maxDanceability: 1,
        minValence: 0,
        maxValence: 1,
        minPopularity: 0,
        maxPopularity: 100
    });
    const [showFilters, setShowFilters] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchArtists, setSearchArtists] = useState<TopItem[]>([]);
    const [searchTracks, setSearchTracks] = useState<TopItem[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [currentSeed, setCurrentSeed] = useState<string | null>(null);

    // Load top tracks and artists when component mounts
    useEffect(() => {
        if (!token) return;
        loadTopItems();
    }, [token, timeRange]);

    const loadTopItems = async () => {
        try {
            setIsLoading(true);
            setError(null);

            const [artistsResponse, tracksResponse] = await Promise.all([
                getTopArtists(timeRange, 10),
                getTopTracks(timeRange, 10)
            ]);

            // Map artists to a common format
            const artists = (artistsResponse.items || []).map((artist: any) => ({
                id: artist.id,
                name: artist.name,
                type: 'artist' as const,
                images: artist.images
            }));

            // Map tracks to a common format
            const tracks = (tracksResponse.items || []).map((track: any) => ({
                id: track.id,
                name: track.name,
                type: 'track' as const,
                album: track.album,
                artists: track.artists
            }));

            setTopArtists(artists);
            setTopTracks(tracks);
        } catch (error) {
            console.error('Error loading top items:', error);
            setError('Failed to load your top artists and tracks');
        } finally {
            setIsLoading(false);
        }
    };

    const toggleSelectedItem = (item: TopItem) => {
        if (selectedItems.some(selected => selected.id === item.id)) {
            setSelectedItems(selectedItems.filter(selected => selected.id !== item.id));
        } else {
            // Allow any number of seeds, but Spotify generally limits to 5 total seeds for recommendations
            if (selectedItems.length >= 5) {
                // Optional: show warning or just don't add
                return;
            }
            setSelectedItems([...selectedItems, item]);
        }
    };

    // Debounced search for artists and tracks
    useEffect(() => {
        if (!token) return;
        const q = searchQuery.trim();
        if (!q) {
            setSearchArtists([]);
            setSearchTracks([]);
            return;
        }
        let cancelled = false;
        setIsSearching(true);
        const id = setTimeout(async () => {
            try {
                const res = await fetch(`https://api.spotify.com/v1/search?q=${encodeURIComponent(q)}&type=artist,track&limit=8`, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                if (!res.ok) throw new Error(`Search failed: ${res.status}`);
                const data = await res.json();
                if (cancelled) return;
                const a: TopItem[] = (data?.artists?.items || []).map((artist: any) => ({
                    id: artist.id,
                    name: artist.name,
                    type: 'artist',
                    images: artist.images,
                }));
                const t: TopItem[] = (data?.tracks?.items || []).map((track: any) => ({
                    id: track.id,
                    name: track.name,
                    type: 'track',
                    album: track.album,
                    artists: track.artists,
                }));
                setSearchArtists(a);
                setSearchTracks(t);
            } catch (e) {
                setSearchArtists([]);
                setSearchTracks([]);
            } finally {
                if (!cancelled) setIsSearching(false);
            }
        }, 300);
        return () => {
            cancelled = true;
            clearTimeout(id);
        };
    }, [searchQuery, token]);

    const getRecommendationsForCurrentSeed = async () => {
        if (!currentSeed || !token) return;

        try {
            setIsLoading(true);
            setError(null);

            // Determine seeds for unified helper
            let seedTracks: string[] = [];
            let seedArtists: string[] = [];
            let seedGenres: string[] = [];


            if (currentSeed === 'current') {
                if (!currentTrack?.id) {
                    setError('No track is currently playing');
                    setIsLoading(false);
                    return;
                }
                seedTracks = [currentTrack.id];
            } else if (currentSeed === 'selected') {
                if (selectedItems.length === 0) {
                    setError('Please select at least one item');
                    setIsLoading(false);
                    return;
                }

                seedArtists = selectedItems
                    .filter(item => item.type === 'artist')
                    .map(item => item.id);

                seedTracks = selectedItems
                    .filter(item => item.type === 'track')
                    .map(item => item.id);

                // Also pass along any chosen genres from the UI selection panel
                seedGenres = (Array.isArray((selectedGenres as unknown)) ? (selectedGenres as string[]) : []).slice(0, 5);
            }

            // Ensure we have at least one seed parameter
            const hasSeeds = seedTracks.length > 0 || seedArtists.length > 0 || seedGenres.length > 0;
            if (!hasSeeds) {
                setError('No valid seed items found');
                setIsLoading(false);
                return;
            }

            console.log('Fetching recommendations with unified helper and seeds:', { seedTracks, seedArtists, seedGenres });

            const data = await getRecommendations(seedTracks, seedArtists, seedGenres);

            if (!data.tracks || data.tracks.length === 0) {
                setError('No recommendations found. Try adjusting your filters or selecting different seed items.');
                setRecommendations([]);
            } else {
                console.log('Received recommendations:', data.tracks.length);
                const enhancedTracks = await enhanceRecommendationsWithGenres(data.tracks);
                setRecommendations(enhancedTracks);
            }
        } catch (error) {
            console.error('Error getting recommendations:', error);
            setError('Failed to get recommendations. Please try again.');
            setRecommendations([]);
        } finally {
            setIsLoading(false);
        }
    };

    const enhanceRecommendationsWithGenres = async (tracks: RecommendationTrack[]) => {
        if (!tracks.length || !token) return tracks;

        try {
            console.log('Enhancing recommendations with genres for', tracks.length, 'tracks');

            // Collect all unique artist IDs
            const artistIds = new Set<string>();
            tracks.forEach(track => {
                track.artists.forEach(artist => {
                    if (artist.id) artistIds.add(artist.id);
                });
            });

            if (!artistIds.size) {
                console.log('No artist IDs found in tracks');
                return tracks;
            }

            console.log('Found', artistIds.size, 'unique artists to fetch genres for');

            // Fetch artist details in batches of 50 (API limit)
            const artistIdArray = Array.from(artistIds);
            const batchSize = 50;
            const artistGenreMap = new Map<string, string[]>();

            for (let i = 0; i < artistIdArray.length; i += batchSize) {
                const batch = artistIdArray.slice(i, i + batchSize);
                console.log(`Fetching batch ${i / batchSize + 1} with ${batch.length} artists`);

                try {
                    const response = await fetch(`https://api.spotify.com/v1/artists?ids=${batch.join(',')}`, {
                        headers: { Authorization: `Bearer ${token}` }
                    });

                    if (response.ok) {
                        const data = await response.json();
                        if (data.artists) {
                            data.artists.forEach((artist: any) => {
                                if (artist.id && artist.genres) {
                                    artistGenreMap.set(artist.id, artist.genres);
                                }
                            });
                        }
                    } else {
                        console.error('Error fetching artist details:', await response.text());
                    }
                } catch (error) {
                    console.error('Error in batch fetch for artists:', error);
                }
            }

            console.log('Collected genres for', artistGenreMap.size, 'artists');

            // Add genres to each track
            const enhancedTracks = tracks.map(track => {
                const genres = new Set<string>();
                track.artists.forEach(artist => {
                    if (artist.id && artistGenreMap.has(artist.id)) {
                        artistGenreMap.get(artist.id)?.forEach(genre => genres.add(genre));
                    }
                });

                return {
                    ...track,
                    genres: Array.from(genres)
                };
            });

            console.log('Enhanced tracks with genres:', enhancedTracks.map(t => ({
                id: t.id,
                name: t.name,
                genreCount: t.genres?.length || 0
            })));

            return enhancedTracks;
        } catch (error) {
            console.error('Error enhancing recommendations with genres:', error);
            return tracks; // Return original tracks if enhancement fails
        }
    };

    const handleTimeRangeChange = (range: 'short_term' | 'medium_term' | 'long_term') => {
        setTimeRange(range);
    };

    const handleFilterChange = (filter: keyof AudioFeatureFilters, value: number) => {
        setFeatureFilters({
            ...featureFilters,
            [filter]: value
        });
    };

    const addToQueue = async (uri: string) => {
        if (!token) return;

        try {
            await fetch('https://api.spotify.com/v1/me/player/queue?uri=' + encodeURIComponent(uri), {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
        } catch (error) {
            console.error('Error adding to queue:', error);
            setError('Failed to add track to queue');
        }
    };

    const playTrack = async (uri: string) => {
        if (!token) return;

        try {
            await fetch('https://api.spotify.com/v1/me/player/play', {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    uris: [uri]
                })
            });
        } catch (error) {
            console.error('Error playing track:', error);
            setError('Failed to play track');
        }
    };

    return (
        <motion.div
            className="bg-gradient-to-br from-gray-900/90 to-black/90 backdrop-blur-md rounded-xl shadow-xl p-6 border border-white/10 w-full"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
        >
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center">
                    <Sparkles className="w-5 h-5 text-green-500 mr-2" />
                    <h2 className="text-white text-lg font-semibold">Explore Recommendations</h2>
                </div>

                <div className="flex items-center space-x-2">
                    <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => setShowFilters(!showFilters)}
                        className={`p-2 rounded-full ${showFilters ? 'bg-green-500 text-white' : 'bg-white/10 text-white hover:bg-white/20'
                            } transition-colors`}
                    >
                        <Flame className="w-4 h-4" />
                    </motion.button>

                    <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={loadTopItems}
                        className="p-2 bg-white/10 rounded-full hover:bg-white/20 transition-colors text-white"
                    >
                        <RefreshCw className="w-4 h-4" />
                    </motion.button>
                </div>
            </div>

            {error && (
                <div className="mb-4 p-4 bg-red-500/10 rounded-lg text-red-500 text-center text-sm">
                    {error}
                </div>
            )}

            {/* Time range selector */}
            <div className="mb-6">
                <div className="flex space-x-2 bg-black/20 p-1 rounded-lg">
                    {[
                        { value: 'short_term', label: 'Last 4 Weeks' },
                        { value: 'medium_term', label: '6 Months' },
                        { value: 'long_term', label: 'All Time' }
                    ].map(range => (
                        <button
                            key={range.value}
                            onClick={() => handleTimeRangeChange(range.value as any)}
                            className={`px-3 py-2 rounded-lg text-sm font-medium flex-1 ${timeRange === range.value
                                    ? 'bg-green-500 text-white'
                                    : 'text-gray-400 hover:text-white hover:bg-white/10'
                                }`}
                        >
                            {range.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Audio feature filters */}
            <AnimatePresence>
                {showFilters && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden mb-6"
                    >
                        <div className="bg-white/5 rounded-lg p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="text-xs text-gray-400 mb-1 block">Min Energy: {featureFilters.minEnergy}</label>
                                <input
                                    type="range"
                                    min="0"
                                    max="1"
                                    step="0.1"
                                    value={featureFilters.minEnergy}
                                    onChange={(e) => handleFilterChange('minEnergy', parseFloat(e.target.value))}
                                    className="w-full accent-green-500 h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                                />
                            </div>
                            <div>
                                <label className="text-xs text-gray-400 mb-1 block">Min Danceability: {featureFilters.minDanceability}</label>
                                <input
                                    type="range"
                                    min="0"
                                    max="1"
                                    step="0.1"
                                    value={featureFilters.minDanceability}
                                    onChange={(e) => handleFilterChange('minDanceability', parseFloat(e.target.value))}
                                    className="w-full accent-green-500 h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                                />
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                {/* Seed Selection Controls */}
                <div className="bg-black/20 rounded-lg p-4">
                    <h3 className="text-white font-medium mb-4 flex items-center">
                        <Sparkles className="w-4 h-4 mr-1" /> Recommendation Source
                    </h3>

                    <div className="flex flex-wrap gap-2 mb-4">
                        <button
                            onClick={() => {
                                setCurrentSeed('current');
                                getRecommendationsForCurrentSeed();
                            }}
                            className={`px-4 py-2 rounded-lg text-sm font-medium ${currentSeed === 'current'
                                    ? 'bg-green-500 text-white'
                                    : 'bg-white/10 text-white hover:bg-white/20'
                                }`}
                            disabled={!currentTrack?.id}
                        >
                            Current Track
                        </button>

                        <button
                            onClick={() => {
                                setCurrentSeed('selected');
                                getRecommendationsForCurrentSeed();
                            }}
                            className={`px-4 py-2 rounded-lg text-sm font-medium ${currentSeed === 'selected'
                                    ? 'bg-green-500 text-white'
                                    : 'bg-white/10 text-white hover:bg-white/20'
                                }`}

                        >
                            Selected Items
                        </button>
                    </div>

                    {/* Inline search to add seeds */}
                    <div className="mb-4">
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search artists or tracks to add as seeds..."
                            className="w-full p-2 bg-gray-800/60 rounded-md text-sm text-white placeholder-gray-400 border border-gray-700 focus:border-green-500 outline-none transition-colors"
                        />
                        {searchQuery && (
                            <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-3 bg-gray-900/90 p-2 rounded-md shadow-lg z-10 relative">
                                <div>
                                    <div className="text-xs text-gray-400 mb-1">Artists {isSearching ? '· searching...' : ''}</div>
                                    <div className="space-y-1 max-h-40 overflow-y-auto custom-scrollbar">
                                        {searchArtists.map(artist => (
                                            <div
                                                key={artist.id}
                                                className={`flex items-center p-2 rounded cursor-pointer ${selectedItems.some(s => s.id === artist.id) ? 'bg-green-500/30' : 'hover:bg-white/10'}`}
                                                onClick={() => toggleSelectedItem(artist)}
                                            >
                                                <img src={artist.images?.[0]?.url} alt={artist.name} className="w-8 h-8 rounded-full object-cover mr-2" />
                                                <div className="text-sm text-white truncate">{artist.name}</div>
                                            </div>
                                        ))}
                                        {!isSearching && searchArtists.length === 0 && (
                                            <div className="text-xs text-gray-500">No artists</div>
                                        )}
                                    </div>
                                </div>
                                <div>
                                    <div className="text-xs text-gray-400 mb-1">Tracks {isSearching ? '· searching...' : ''}</div>
                                    <div className="space-y-1 max-h-40 overflow-y-auto custom-scrollbar">
                                        {searchTracks.map(track => (
                                            <div
                                                key={track.id}
                                                className={`flex items-center p-2 rounded cursor-pointer ${selectedItems.some(s => s.id === track.id) ? 'bg-green-500/30' : 'hover:bg-white/10'}`}
                                                onClick={() => toggleSelectedItem(track)}
                                            >
                                                <img src={track.album?.images?.[0]?.url} alt={track.name} className="w-8 h-8 rounded object-cover mr-2" />
                                                <div className="text-sm text-white truncate flex-1">{track.name}</div>
                                                <div className="text-xs text-gray-400 truncate ml-2">{(track.artists || []).map((a: any) => a.name).join(', ')}</div>
                                            </div>
                                        ))}
                                        {!isSearching && searchTracks.length === 0 && (
                                            <div className="text-xs text-gray-500">No tracks</div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Selected items */}
                    {selectedItems.length > 0 && (
                        <div className="flex overflow-x-auto space-x-2 pb-2 mb-4 custom-scrollbar">
                            {selectedItems.map(item => (
                                <div
                                    key={item.id}
                                    className="flex-shrink-0 w-24 relative group"
                                >
                                    <img
                                        src={item.type === 'artist' ? item.images?.[0]?.url : item.album?.images[0]?.url}
                                        alt={item.name}
                                        className="w-24 h-24 object-cover rounded-md"
                                    />
                                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                        <button
                                            onClick={() => toggleSelectedItem(item)}
                                            className="p-1 bg-red-500 rounded-full"
                                        >
                                            <X className="w-4 h-4 text-white" />
                                        </button>
                                    </div>
                                    <div className="text-xs text-white truncate mt-1">{item.name}</div>
                                    <div className="text-xs text-gray-400 capitalize">{item.type}</div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Top artists and tracks */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-white/5 rounded-lg p-3">
                            <h3 className="text-white font-medium mb-2 flex items-center text-sm">
                                <User className="w-3 h-3 mr-1" /> Top Artists
                            </h3>
                            {isLoading && topArtists.length === 0 ? (
                                <div className="flex justify-center py-4">
                                    <Loader2 className="w-4 h-4 text-green-500 animate-spin" />
                                </div>
                            ) : (
                                <div className="space-y-2 max-h-[200px] overflow-y-auto pr-2 custom-scrollbar">
                                    {topArtists.map(artist => (
                                        <div
                                            key={artist.id}
                                            className={`flex items-center p-2 rounded-lg cursor-pointer ${selectedItems.some(item => item.id === artist.id)
                                                    ? 'bg-green-500/30'
                                                    : 'bg-black/30 hover:bg-white/10'
                                                }`}
                                            onClick={() => toggleSelectedItem(artist)}
                                        >
                                            <img
                                                src={artist.images?.[0]?.url}
                                                alt={artist.name}
                                                className="w-8 h-8 rounded-full object-cover"
                                            />
                                            <div className="ml-3 flex-1 min-w-0">
                                                <div className="text-white text-xs font-medium truncate">{artist.name}</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="bg-white/5 rounded-lg p-3">
                            <h3 className="text-white font-medium mb-2 flex items-center text-sm">
                                <Music className="w-3 h-3 mr-1" /> Top Tracks
                            </h3>
                            {isLoading && topTracks.length === 0 ? (
                                <div className="flex justify-center py-4">
                                    <Loader2 className="w-4 h-4 text-green-500 animate-spin" />
                                </div>
                            ) : (
                                <div className="space-y-2 max-h-[200px] overflow-y-auto pr-2 custom-scrollbar">
                                    {topTracks.map(track => (
                                        <div
                                            key={track.id}
                                            className={`flex items-center p-2 rounded-lg cursor-pointer ${selectedItems.some(item => item.id === track.id)
                                                    ? 'bg-green-500/30'
                                                    : 'bg-black/30 hover:bg-white/10'
                                                }`}
                                            onClick={() => toggleSelectedItem(track)}
                                        >
                                            <img
                                                src={track.album?.images[0]?.url}
                                                alt={track.name}
                                                className="w-8 h-8 rounded-md object-cover"
                                            />
                                            <div className="ml-3 flex-1 min-w-0">
                                                <div className="text-white text-xs font-medium truncate">{track.name}</div>
                                                <div className="text-gray-400 text-[10px] truncate">
                                                    {track.artists?.map(a => a.name).join(', ')}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Recommendations Results */}
                <div className="bg-black/20 rounded-lg p-4">
                    <h3 className="text-white font-medium mb-4 flex items-center">
                        <Award className="w-4 h-4 mr-1" /> Recommendations
                    </h3>

                    {isLoading ? (
                        <div className="flex justify-center py-6">
                            <Loader2 className="w-8 h-8 text-green-500 animate-spin" />
                        </div>
                    ) : recommendations.length === 0 ? (
                        <div className="py-6 text-center text-gray-400 flex flex-col items-center justify-center h-full min-h-[200px]">
                            <Sparkles className="w-12 h-12 text-gray-600 mb-2" />
                            <p>{currentSeed ? (error || 'No recommendations found. Try adjusting your filters.') : 'Select a seed on the left to get recommendations'}</p>
                        </div>
                    ) : (
                        <div className="space-y-2 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                            {recommendations.map(track => (
                                <div
                                    key={track.id}
                                    className="flex items-center p-3 rounded-lg bg-black/30 hover:bg-white/10 transition-colors group"
                                >
                                    <div className="flex-shrink-0 relative">
                                        <img
                                            src={track.album.images[0]?.url}
                                            alt={track.name}
                                            className="w-12 h-12 rounded-md object-cover"
                                        />
                                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                            <motion.button
                                                onClick={() => playTrack(track.uri)}
                                                className="p-1.5 bg-green-500 rounded-full"
                                                whileHover={{ scale: 1.1 }}
                                                whileTap={{ scale: 0.95 }}
                                            >
                                                <Play className="w-3 h-3 text-white" fill="white" />
                                            </motion.button>
                                        </div>
                                    </div>

                                    <div className="ml-3 flex-1 min-w-0">
                                        <div className="text-white text-sm font-medium truncate">{track.name}</div>
                                        <div className="text-gray-400 text-xs truncate">
                                            {track.artists.map(a => a.name).join(', ')}
                                        </div>

                                        {/* Display genres if available */}
                                        {track.genres && track.genres.length > 0 && (
                                            <div className="flex flex-wrap gap-1 mt-1 max-w-full">
                                                {track.genres.slice(0, 3).map((genre, i) => (
                                                    <span
                                                        key={i}
                                                        className="px-1.5 py-0.5 bg-white/10 rounded text-[10px] text-gray-300 truncate"
                                                        style={{ maxWidth: '100px' }}
                                                    >
                                                        {genre}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex space-x-1 ml-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <motion.button
                                            whileHover={{ scale: 1.05 }}
                                            whileTap={{ scale: 0.95 }}
                                            onClick={() => addToQueue(track.uri)}
                                            className="p-2 bg-white/10 rounded-full hover:bg-white/20"
                                            title="Add to queue"
                                        >
                                            <Plus className="w-3 h-3 text-white" />
                                        </motion.button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </motion.div>
    );
};

export default ExploreRecommendations;
