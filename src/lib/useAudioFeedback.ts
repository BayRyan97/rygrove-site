import { useCallback } from 'react';

type ErrorType = 'validation' | 'critical' | 'general';

/**
 * Custom hook to play audio feedback on errors
 * Supports different sounds for different error types
 */
export const useAudioFeedback = () => {
  const playErrorSound = useCallback((errorType: ErrorType = 'general') => {
    try {
      // Map error types to audio files
      const audioMap: Record<ErrorType, string> = {
        validation: '/audio/Nah_1.mp3',   // Validation errors
        critical: '/audio/No_1.mp3',       // Critical errors
        general: '/audio/Nah_1.mp3',       // General errors (default)
      };

      const audioPath = audioMap[errorType];
      const audio = new Audio(audioPath);
      
      // Set volume and play with error handling
      audio.volume = 0.5; // 50% volume
      audio.play().catch((err) => {
        console.debug('Audio playback failed (expected in muted contexts):', err);
      });
    } catch (err) {
      // Silently fail - don't break the app if audio doesn't play
      console.debug('Audio feedback error:', err);
    }
  }, []);

  return { playErrorSound };
};
