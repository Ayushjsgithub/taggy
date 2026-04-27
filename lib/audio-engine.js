import { parseFile } from 'music-metadata';
import { getHandler } from './handlers/index.js';
import path from 'path';
import fs from 'fs-extra';

/**
 * Reads metadata from an audio file.
 * @param {string} filePath 
 * @param {string} originalName
 * @returns {Promise<object>}
 */
export async function readMetadata(filePath, originalName) {
  const metadata = await parseFile(filePath);
  
  // Extract relevant fields
  const { common, format } = metadata;
  
  // Helper to get first item if it's an array and convert to string
  const toString = (val) => {
    const first = Array.isArray(val) ? val[0] : val;
    if (typeof first === 'object' && first !== null) {
      if ('text' in first && first.text !== null && first.text !== undefined) return String(first.text).trim();
      if ('lyrics' in first && first.lyrics !== null && first.lyrics !== undefined) return String(first.lyrics).trim();
      if (first instanceof Date) return first.toISOString().split('T')[0];
      return String(first).trim();
    }
    return first !== undefined && first !== null ? String(first).trim() : '';
  };
  
  return {
    title: toString(common.title) || originalName.replace(path.extname(originalName), ''),
    artist: toString(common.artist) || toString(common.albumartist) || '',
    album: toString(common.album) || '',
    genre: toString(common.genre) || '',
    year: toString(common.year) || toString(common.date) || '',
    track: common.track ? (common.track.no != null ? (common.track.of ? `${common.track.no}/${common.track.of}` : String(common.track.no)) : (typeof common.track === 'string' || typeof common.track === 'number' ? String(common.track) : '')) : '',
    lyrics: toString(common.lyrics) || '',
    duration: format.duration,
    bitrate: format.bitrate,
    container: format.container,
    format: path.extname(filePath).toLowerCase().replace('.', ''),
    picture: common.picture && common.picture[0] ? {
      format: common.picture[0].format,
      data: Buffer.from(common.picture[0].data).toString('base64'),
    } : null,
  };
}

/**
 * Writes metadata to an audio file losslessly using format-specific handlers.
 * @param {string} filePath 
 * @param {object} tags 
 * @param {string} format 
 */
export async function writeMetadata(filePath, tags, format) {
  const handler = getHandler(format || path.extname(filePath));
  const TEMP_DIR = path.join(process.cwd(), 'temp');
  
  const sanitizedTags = {};
  for (const [key, value] of Object.entries(tags)) {
    if (key === 'picture' && value?.data) {
      const imgPath = path.join(TEMP_DIR, `art_${Date.now()}${value.format === 'image/jpeg' ? '.jpg' : '.png'}`);
      await fs.ensureDir(TEMP_DIR);
      await fs.writeFile(imgPath, Buffer.from(value.data, 'base64'));
      sanitizedTags.imagePath = imgPath;
      sanitizedTags.picture = value;
    } else if (typeof value === 'string') {
      // Trim and remove only truly problematic characters (control characters), but allow Unicode
      sanitizedTags[key] = value.trim().replace(/[\x00-\x1F\x7F]/g, '');
    } else if (value !== null && value !== undefined) {
      sanitizedTags[key] = value;
    }
  }

  try {
    const result = await handler.updateMetadata(filePath, sanitizedTags);
    
    if (sanitizedTags.imagePath) {
      await fs.remove(sanitizedTags.imagePath);
    }
    return result;
  } catch (error) {
    console.error('Metadata update failed:', error);
    if (sanitizedTags.imagePath) await fs.remove(sanitizedTags.imagePath);
    throw error;
  }
}
