import ColorThief from 'colorthief';

/**
 * Extracts the dominant color from an image URL
 * @param imageUrl The URL of the image to extract colors from
 * @returns A promise that resolves to an array of RGB colors
 */
export async function extractDominantColor(imageUrl: string): Promise<[number, number, number]> {
  try {
    const colorThief = new ColorThief();
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    
    return new Promise((resolve, reject) => {
      img.onload = () => {
        const color = colorThief.getColor(img);
        resolve(color as [number, number, number]);
      };
      
      img.onerror = () => {
        reject(new Error('Failed to load image'));
      };
      
      img.src = imageUrl;
    });
  } catch (error) {
    console.error('Error extracting color:', error);
    throw error;
  }
}

/**
 * Extracts a color palette from an image URL
 * @param imageUrl The URL of the image to extract colors from
 * @param colorCount The number of colors to extract (default: 5)
 * @returns A promise that resolves to an array of RGB color arrays
 */
export async function extractColorPalette(
  imageUrl: string,
  colorCount: number = 5
): Promise<Array<[number, number, number]>> {
  try {
    const colorThief = new ColorThief();
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    
    return new Promise((resolve, reject) => {
      img.onload = () => {
        const palette = colorThief.getPalette(img, colorCount);
        resolve(palette as Array<[number, number, number]>);
      };
      
      img.onerror = () => {
        reject(new Error('Failed to load image'));
      };
      
      img.src = imageUrl;
    });
  } catch (error) {
    console.error('Error extracting color palette:', error);
    throw error;
  }
} 