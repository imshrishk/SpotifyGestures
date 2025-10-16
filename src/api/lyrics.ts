import express, { Router, RequestHandler } from 'express';
import axios from 'axios';
import cheerio from 'cheerio';
import NodeCache from 'node-cache';

const router: Router = express.Router();
const lyricsCache = new NodeCache({ stdTTL: 3600 }); // Cache for 1 hour

interface SyncedLyric {
  time: number;
  text: string;
}

interface LyricsResponse {
  lyrics: string;
  syncedLyrics?: SyncedLyric[];
  source: string;
  error?: string;
}

interface LyricsSource {
  name: string;
  url: string;
  selector: string;
}

// Rate limiting middleware
const rateLimit = new Map<string, { count: number; timestamp: number }>();
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const MAX_REQUESTS = 30;

const checkRateLimit: RequestHandler = (req, res, next) => {
  const ip = req.ip || 'unknown';
  const now = Date.now();
  const userLimit = rateLimit.get(ip);

  if (userLimit) {
    if (now - userLimit.timestamp > RATE_LIMIT_WINDOW) {
      rateLimit.set(ip, { count: 1, timestamp: now });
    } else if (userLimit.count >= MAX_REQUESTS) {
      res.status(429).json({ error: 'Too many requests. Please try again later.' });
      return;
    } else {
      userLimit.count++;
    }
  } else {
    rateLimit.set(ip, { count: 1, timestamp: now });
  }

  next();
};

// Helper function to clean lyrics text
const cleanLyrics = (text: string): string => {
  return text
    .replace(/\[.*?\]/g, '') // Remove [Verse], [Chorus], etc.
    .replace(/\n{3,}/g, '\n\n') // Replace multiple newlines with double newlines
    .replace(/^\s+|\s+$/g, '') // Trim whitespace
    .trim();
};

// Enhanced Genius lyrics scraper with better error handling and synced lyrics support
const scrapeGeniusLyrics = async (url: string): Promise<LyricsResponse> => {
  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    const $ = cheerio.load(response.data);
    
    // Find lyrics container
    const lyricsContainer = $('div[class*="Lyrics__Container"]');
    if (!lyricsContainer.length) {
      throw new Error('Lyrics container not found');
    }

    let lyrics = '';
    const syncedLyrics: SyncedLyric[] = [];

    lyricsContainer.each((_, elem) => {
      const $elem = $(elem);
      const text = $elem.text();
      lyrics += text + '\n\n';

      // Extract synced lyrics
      $elem.find('span[class*="Timestamp"]').each((_, span) => {
        const $span = $(span);
        const timestamp = $span.attr('data-timestamp');
        if (timestamp) {
          const time = parseInt(timestamp);
          const text = $span.text().trim();
          if (!isNaN(time) && text) {
            syncedLyrics.push({ time, text });
          }
        }
      });
    });

    // Sort synced lyrics by time
    if (syncedLyrics.length > 0) {
      syncedLyrics.sort((a, b) => a.time - b.time);
    }

    return {
      lyrics: cleanLyrics(lyrics),
      syncedLyrics: syncedLyrics.length > 0 ? syncedLyrics : undefined,
      source: 'genius'
    };
  } catch (error) {
    console.error('Error scraping Genius lyrics:', error);
    throw error;
  }
};

// Genius lyrics endpoint with caching
const getGeniusLyrics: RequestHandler = async (req, res) => {
  try {
    const { url } = req.query;
    if (!url || typeof url !== 'string') {
      res.status(400).json({ error: 'URL is required' });
      return;
    }

    // Check cache first
    const cacheKey = `genius:${url}`;
    const cachedLyrics = lyricsCache.get<LyricsResponse>(cacheKey);
    if (cachedLyrics) {
      res.json(cachedLyrics);
      return;
    }

    const lyrics = await scrapeGeniusLyrics(url);
    
    // Cache the result
    lyricsCache.set(cacheKey, lyrics);
    
    res.json(lyrics);
  } catch (error) {
    console.error('Error fetching lyrics:', error);
    res.status(500).json({ 
      error: 'Failed to fetch lyrics',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Alternative lyrics endpoint with caching
const getAlternativeLyrics: RequestHandler = async (req, res) => {
  try {
    const { artist, track } = req.query;
    if (!artist || !track || typeof artist !== 'string' || typeof track !== 'string') {
      res.status(400).json({ error: 'Artist and track are required' });
      return;
    }

    // Check cache first
    const cacheKey = `alt:${artist}:${track}`;
    const cachedLyrics = lyricsCache.get<LyricsResponse>(cacheKey);
    if (cachedLyrics) {
      res.json(cachedLyrics);
      return;
    }

    // Try multiple sources in parallel
    const sources: LyricsSource[] = [
      {
        name: 'AZLyrics',
        url: `https://www.azlyrics.com/lyrics/${artist.toLowerCase().replace(/\s+/g, '')}/${track.toLowerCase().replace(/\s+/g, '')}.html`,
        selector: '.ringtone + div'
      },
      {
        name: 'Lyrics.com',
        url: `https://www.lyrics.com/lyric/${encodeURIComponent(artist)}/${encodeURIComponent(track)}`,
        selector: '#lyric-body-text'
      }
    ];

    const results = await Promise.allSettled(
      sources.map(async (source) => {
        try {
          const response = await axios.get(source.url, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
          });
          const $ = cheerio.load(response.data);
          const lyrics = $(source.selector).text();
          if (lyrics) {
            return {
              lyrics: cleanLyrics(lyrics),
              source: source.name
            };
          }
        } catch (error) {
          console.error(`Error fetching from ${source.name}:`, error);
        }
        return null;
      })
    );

    const successfulResult = results.find(
      (result): result is PromiseFulfilledResult<LyricsResponse> =>
        result.status === 'fulfilled' && result.value !== null
    );

    if (successfulResult) {
      const lyrics = successfulResult.value;
      lyricsCache.set(cacheKey, lyrics);
      res.json(lyrics);
      return;
    }

    res.status(404).json({ error: 'Lyrics not found' });
  } catch (error) {
    console.error('Error fetching alternative lyrics:', error);
    res.status(500).json({ error: 'Failed to fetch lyrics' });
  }
};

// Register routes
router.get('/lyrics/genius', checkRateLimit, getGeniusLyrics);
router.get('/lyrics/alternative', checkRateLimit, getAlternativeLyrics);

// NetEase lyrics endpoint
const neteaseHandler: RequestHandler = async (req, res) => {
  try {
    const { artist, title } = req.query as { artist?: string; title?: string };
    if (!artist || !title) {
      res.status(400).send('Artist and title are required');
      return;
    }

    // First search for the song
    const searchResponse = await axios.get(
      `https://music.xianqiao.wang/neteaseapiv2/search?limit=10&type=1&keywords=${encodeURIComponent(`${artist} ${title}`)}`
    );

    if (searchResponse.data?.result?.songs?.length > 0) {
      const song = searchResponse.data.result.songs[0];
      
      // Get lyrics for the song
      const lyricsResponse = await axios.get(
        `https://music.xianqiao.wang/neteaseapiv2/lyric?id=${song.id}`
      );

      if (lyricsResponse.data?.lrc?.lyric) {
        res.json({ lrc: lyricsResponse.data.lrc.lyric });
        return;
      }
    }

    res.status(404).send('Lyrics not found');
  } catch (error) {
    console.error('Error fetching NetEase lyrics:', error);
    res.status(500).send('Failed to fetch lyrics');
  }
};

router.get('/lyrics/netease', checkRateLimit, neteaseHandler);

// Musixmatch lyrics endpoint
const musixmatchHandler: RequestHandler = async (req, res) => {
  try {
    const { artist, title } = req.query as { artist?: string; title?: string };
    if (!artist || !title) {
      res.status(400).send('Artist and title are required');
      return;
    }

    // First search for the song
      const mmApiKey = (typeof import.meta !== 'undefined' && (import.meta as any).env && (import.meta as any).env.VITE_MUSIXMATCH_API_KEY) || (typeof process !== 'undefined' ? process.env.VITE_MUSIXMATCH_API_KEY : undefined);
      const searchResponse = await axios.get(
        `https://api.musixmatch.com/ws/1.1/track.search?q_track=${encodeURIComponent(title)}&q_artist=${encodeURIComponent(artist)}&apikey=${mmApiKey}&format=json`
      );

    if (searchResponse.data?.message?.body?.track_list?.length > 0) {
      const trackId = searchResponse.data.message.body.track_list[0].track.track_id;
      
      // Get synced lyrics
        const lyricsResponse = await axios.get(
          `https://api.musixmatch.com/ws/1.1/track.subtitle.get?track_id=${trackId}&apikey=${mmApiKey}&format=json&subtitle_format=lrc`
        );

      if (lyricsResponse.data?.message?.body?.subtitle?.subtitle_body) {
        const lrcContent = lyricsResponse.data.message.body.subtitle.subtitle_body;
        
        // Parse LRC format into synced lyrics
        const syncedLyrics: SyncedLyric[] = lrcContent
          .split('\n')
          .map((line: string) => {
            const match = line.match(/\[(\d{2}):(\d{2})\.(\d{2,3})\](.*)/);
            if (match) {
              const [_, min, sec, ms, text] = match;
              const time = (parseInt(min) * 60 + parseInt(sec)) * 1000 + parseInt(ms);
              return { time, text: text.trim() };
            }
            return null;
          })
          .filter((line: SyncedLyric | null): line is SyncedLyric => line !== null);

        res.json({
          lyrics: syncedLyrics.map((l: SyncedLyric) => l.text).join('\n'),
          syncedLyrics
        });
        return;
      }
    }

    res.status(404).send('Lyrics not found');
  } catch (error) {
    console.error('Error fetching Musixmatch lyrics:', error);
    res.status(500).send('Failed to fetch lyrics');
  }
};

router.get('/lyrics/musixmatch', checkRateLimit, musixmatchHandler);

export default router; 