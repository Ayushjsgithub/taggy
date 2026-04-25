import { ffmpeg } from '../ffmpeg.js';
import fs from 'fs-extra';
import path from 'path';

/**
 * Updates M4A/WAV metadata using FFmpeg (lossless copy).
 * @param {string} filePath 
 * @param {object} tags 
 */
export async function updateMetadata(filePath, tags) {
  const extension = path.extname(filePath);
  const tempPath = `${filePath}.tmp${extension}`;
  
  return new Promise((resolve, reject) => {
    let command = ffmpeg(filePath);
    
    if (tags.imagePath) {
      command = command.input(tags.imagePath);
    }

    command = command.outputOptions('-c', 'copy'); // Lossless stream copy

    if (tags.imagePath) {
      command = command
        .outputOptions('-map', '0')
        .outputOptions('-map', '-0:v?')
        .outputOptions('-map', '1:v')
        .outputOptions('-disposition:v:0', 'attached_pic'); // Set as attached picture
    } else {
      command = command.outputOptions('-map', '0');
    }

    command = command.outputOptions('-map_metadata', '0'); // Map global metadata first
      
    // Map metadata individual fields safely using global scope to override input metadata
    if (tags.title !== undefined) command = command.outputOptions('-metadata', `title=${tags.title}`);
    if (tags.artist !== undefined) command = command.outputOptions('-metadata', `artist=${tags.artist}`);
    if (tags.album !== undefined) command = command.outputOptions('-metadata', `album=${tags.album}`);
    if (tags.genre !== undefined) command = command.outputOptions('-metadata', `genre=${tags.genre}`);
    if (tags.year !== undefined) command = command.outputOptions('-metadata', `date=${tags.year}`);
    
    if (tags.track !== undefined) {
      // Set both 'track' and 'trkn' for M4A/MP4 compatibility
      command = command.outputOptions('-metadata', `track=${tags.track}`);
      command = command.outputOptions('-metadata', `trkn=${tags.track}`);
    }
    
    if (tags.lyrics !== undefined) command = command.outputOptions('-metadata', `lyrics=${tags.lyrics}`);
    
    if (tags.replayGain) {
      // iTunes-compatible replaygain tags for m4a
      command = command.outputOptions('-metadata', `----:com.apple.iTunes:replaygain_track_gain=${tags.replayGain.trackGain}`);
      command = command.outputOptions('-metadata', `----:com.apple.iTunes:replaygain_track_peak=${tags.replayGain.trackPeak}`);
    }

    command
      .on('error', (err) => {
        console.error('FFmpeg metadata update error:', err);
        reject(new Error(`FFmpeg failed: ${err.message}`));
      })
      .on('end', async () => {
        try {
          await fs.move(tempPath, filePath, { overwrite: true });
          resolve();
        } catch (err) {
          reject(err);
        }
      })
      .save(tempPath);
  });
}

export const m4aHandler = {
  updateMetadata,
  mimeType: 'audio/mp4' // Default for m4a, wav should be audio/wav
};
