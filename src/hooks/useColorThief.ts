import { useCallback, useRef } from 'react';
import ColorThief from 'colorthief';

export const useColorThief = (imageRef: React.RefObject<HTMLImageElement>) => {
  const colorThiefRef = useRef<ColorThief | null>(null);

  const getColor = useCallback(() => {
    if (!imageRef.current || !colorThiefRef.current) return null;
    
    try {
      return colorThiefRef.current.getColor(imageRef.current);
    } catch (error) {
      console.error('Error extracting color from image:', error);
      return null;
    }
  }, [imageRef]);

  const initializeColorThief = useCallback(() => {
    if (!imageRef.current) return;
    
    try {
      colorThiefRef.current = new ColorThief();
    } catch (error) {
      console.error('Error initializing ColorThief:', error);
    }
  }, [imageRef]);

  return {
    getColor,
    initializeColorThief
  };
}; 