declare namespace SpotifyApi {
  interface AudioAnalysisObject {
    beats: Array<TimeInterval>;
    bars: Array<TimeInterval>;
    tatums: Array<TimeInterval>;
    sections: Array<Section>;
    segments: Array<Segment>;
  }

  interface TimeInterval {
    start: number;
    duration: number;
    confidence: number;
  }

  interface Section extends TimeInterval {
    loudness: number;
    tempo: number;
  }

  interface Segment extends TimeInterval {
    loudness_start: number;
    loudness_max: number;
    pitches: number[];
    timbre: number[];
  }

  interface PlaybackDevice {
    id: string;
    is_active: boolean;
    is_private_session: boolean;
    is_restricted: boolean;
    name: string;
    type: string;
    volume_percent: number;
  }

  interface LyricsLine {
    startTimeMs: string;
    words: string;
  }
}

interface PlaybackState {
  context: {
    uri: string;
    type: string;
  } | null;
  currently_playing_type: string;
  is_playing: boolean;
  item: SpotifyApi.TrackObjectFull;
  progress_ms: number;
  shuffle_state: boolean;
  repeat_state: 'off' | 'track' | 'context';
  timestamp: number;
  device: SpotifyApi.PlaybackDevice;
}

interface SpotifyError {
  status: number;
  message: string;
}

interface QueueResponse {
  currently_playing: SpotifyApi.TrackObjectFull;
  queue: SpotifyApi.TrackObjectFull[];
}

interface RequestQueueItem<T> {
  (): Promise<T>;
}