import { useCallback } from 'react';

type ErrorType = 'validation' | 'critical' | 'general' | 'random';

/**
 * Custom hook to play audio feedback on errors
 * Supports different sounds for different error types
 */
export const useAudioFeedback = () => {
  const playErrorSound = useCallback((errorType: ErrorType = 'random') => {
    try {
      // Map error types to audio files
      let audioPath: string;
      
      if (errorType === 'random') {
        // Pick a random sound between the two
        audioPath = Math.random() > 0.5 ? '/audio/Nah_1.mp3' : '/audio/No_1.mp3';
      } else {
        const audioMap: Record<Exclude<ErrorType, 'random'>, string> = {
          validation: '/audio/Nah_1.mp3',   // Validation errors
          critical: '/audio/No_1.mp3',       // Critical errors
          general: '/audio/Nah_1.mp3',       // General errors (default)
        };
        audioPath = audioMap[errorType];
      }
      
      console.log(`Playing error sound: ${errorType} -> ${audioPath}`);
      
      const audio = new Audio(audioPath);
      audio.volume = 1.0; // 100% volume for clarity
      
      // Play with error handling
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            console.log(`Successfully played: ${audioPath}`);
          })
          .catch((err) => {
            console.warn(`Audio playback failed for ${audioPath}:`, err);
          });
      }
    } catch (err) {
      // Silently fail - don't break the app if audio doesn't play
      console.warn('Audio feedback error:', err);
    }
  }, []);

  return { playErrorSound };
};
