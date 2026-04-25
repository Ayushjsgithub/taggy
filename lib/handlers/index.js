import { mp3Handler } from './mp3.js';
import { flacHandler } from './flac.js';
import { m4aHandler } from './m4a.js';

/**
 * Returns the appropriate handler for the given audio format.
 * @param {string} format 
 * @returns {object}
 */
export function getHandler(format) {
  const normalizedFormat = format.toLowerCase().replace('.', '');
  
  switch (normalizedFormat) {
    case 'mp3':
      return mp3Handler;
    case 'flac':
      return flacHandler;
    case 'm4a':
      return m4aHandler;
    case 'wav':
      // WAV also uses FFmpeg handler but with different MIME
      return {
        ...m4aHandler,
        mimeType: 'audio/wav'
      };
    default:
      throw new Error(`Unsupported format: ${format}`);
  }
}
