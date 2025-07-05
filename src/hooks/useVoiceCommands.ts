import { useEffect, useState, useCallback } from 'react';
import useSpotifyStore from '../stores/useSpotifyStore';
import { playPause, nextTrack, previousTrack, setVolume } from '../lib/spotify';

// Add type declaration for webkitSpeechRecognition
declare global {
  interface Window {
    webkitSpeechRecognition: any;
  }
}

// TypeScript compatibility for SpeechRecognition APIs
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

const useVoiceCommands = () => {
  const [isListening, setIsListening] = useState(false);
  const { isPlaying, volume, setIsPlaying, setVolume: updateStoreVolume } = useSpotifyStore();

  const handleVoiceCommand = useCallback((command: string) => {
    const lowerCaseCommand = command.toLowerCase();

    if (lowerCaseCommand.includes('play')) {
      playPause(true);
      setIsPlaying(true);
    } else if (lowerCaseCommand.includes('pause')) {
      playPause(false);
      setIsPlaying(false);
    } else if (lowerCaseCommand.includes('next')) {
      nextTrack();
    } else if (lowerCaseCommand.includes('previous')) {
      previousTrack();
    } else if (lowerCaseCommand.includes('volume up')) {
      const newVolume = Math.min(volume + 10, 100);
      setVolume(newVolume);
      updateStoreVolume(newVolume);
    } else if (lowerCaseCommand.includes('volume down')) {
      const newVolume = Math.max(volume - 10, 0);
      setVolume(newVolume);
      updateStoreVolume(newVolume);
    }
  }, [isPlaying, volume, setIsPlaying, updateStoreVolume]);

  useEffect(() => {
    if (!('webkitSpeechRecognition' in window)) {
      console.error('Web Speech API is not supported in this browser.');
      return;
    }

    const recognition = new ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition)();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onresult = (event: any) => {
      const transcript = event.results[event.results.length - 1][0].transcript.trim();
      handleVoiceCommand(transcript);
    };

    if (isListening) {
      recognition.start();
    } else {
      recognition.stop();
    }

    return () => {
      recognition.stop();
    };
  }, [isListening, handleVoiceCommand]);

  return { isListening, setIsListening };
};

export default useVoiceCommands;
