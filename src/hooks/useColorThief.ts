import { useCallback, useRef } from 'react';
import ColorThief from 'colorthief';

export const useColorThief = (imageRef: React.RefObject<HTMLImageElement>) => {
  const colorThiefRef = useRef<ColorThief | null>(null);

  const getColor = useCallback(() => {
    if (!imageRef.current || !colorThiefRef.current) return null;
    
    try {
      // Ensure image has loaded and has dimensions
      const img = imageRef.current as HTMLImageElement;
      if (!img.naturalWidth || !img.naturalHeight) return null;
      return colorThiefRef.current.getColor(img);
    } catch (error) {
      // SecurityError indicates cross-origin image without CORS — treat as no color
      if (error instanceof Error && error.name === 'SecurityError') {
        console.debug('Cross-origin image blocked color extraction');
        return null;
      }
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