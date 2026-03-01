import { useCallback } from 'react';

type ErrorType = 'validation' | 'critical' | 'general' | 'random';
type SuccessType = 'general';

/**
 * Custom hook to play audio feedback on errors and success events
 * Supports different sounds for different event types
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
      
      // Set preload to ensure immediate playback
      audio.preload = 'auto';
      
      // Play immediately and synchronously
      try {
        audio.play().catch((err) => {
          console.warn(`Audio playback failed for ${audioPath}:`, err);
        });
      } catch (err) {
        console.warn(`Audio play() failed for ${audioPath}:`, err);
      }
    } catch (err) {
      // Silently fail - don't break the app if audio doesn't play
      console.warn('Audio feedback error:', err);
    }
  }, []);

  const playSuccessSound = useCallback((successType: SuccessType = 'general') => {
    try {
      const audioPath = '/audio/yes_1.mp3'; // Success sound
      
      console.log(`Playing success sound: ${successType} -> ${audioPath}`);
      
      const audio = new Audio(audioPath);
      audio.volume = 1.0; // 100% volume for clarity
      
      // Set preload to ensure immediate playback
      audio.preload = 'auto';
      
      // Play immediately and synchronously
      try {
        audio.play().catch((err) => {
          console.warn(`Audio playback failed for ${audioPath}:`, err);
        });
      } catch (err) {
        console.warn(`Audio play() failed for ${audioPath}:`, err);
      }
    } catch (err) {
      // Silently fail - don't break the app if audio doesn't play
      console.warn('Audio feedback error:', err);
    }
  }, []);

  return { playErrorSound, playSuccessSound };
};
