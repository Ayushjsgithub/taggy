import { execFile } from 'child_process';
import { promisify } from 'util';
import { ffmpeg } from '../ffmpeg.js';
import fs from 'fs-extra';
import path from 'path';

const execFilePromise = promisify(execFile);

/**
 * Updates FLAC metadata. Tries metaflac first, then falls back to FFmpeg.
 * @param {string} filePath 
 * @param {object} tags 
 */
export async function updateMetadata(filePath, tags) {
  try {
    await updateWithMetaflac(filePath, tags);
  } catch (metaflacError) {
    // If metaflac is missing or fails, try FFmpeg as a fallback
    console.warn('metaflac failed, trying FFmpeg fallback...', metaflacError.message);
    try {
      await updateWithFfmpeg(filePath, tags);
    } catch (ffmpegError) {
      console.error('Both metaflac and FFmpeg failed for FLAC.');
      throw new Error(`Failed to update FLAC metadata. metaflac: ${metaflacError.message}; FFmpeg: ${ffmpegError.message}`);
    }
  }
}

async function updateWithMetaflac(filePath, tags) {
  const tagMap = {
    title: 'TITLE',
    artist: 'ARTIST',
    album: 'ALBUM',
    genre: 'GENRE',
    year: 'DATE',
    track: ['TRACKNUMBER', 'TRACK'],
    lyrics: 'LYRICS',
  };

  const args = [];
  for (const [key, value] of Object.entries(tags)) {
    if (tagMap[key] && value !== undefined && value !== null) {
      const sanitizedValue = String(value).trim();
      const fields = Array.isArray(tagMap[key]) ? tagMap[key] : [tagMap[key]];
      for (const field of fields) {
        args.push(`--remove-tag=${field}`);
        args.push(`--set-tag=${field}=${sanitizedValue}`);
      }
    }
  }

  if (tags.replayGain) {
    args.push(`--remove-tag=REPLAYGAIN_TRACK_GAIN`);
    args.push(`--set-tag=REPLAYGAIN_TRACK_GAIN=${tags.replayGain.trackGain}`);
    args.push(`--remove-tag=REPLAYGAIN_TRACK_PEAK`);
    args.push(`--set-tag=REPLAYGAIN_TRACK_PEAK=${tags.replayGain.trackPeak}`);
  }

  if (args.length === 0 && !tags.imagePath) return;

  args.push(filePath);

  // Try without shell first (safer, handles quotes automatically)
  try {
    await execFilePromise('metaflac', args);
  } catch (e) {
    // If ENOENT on Windows, it might be a batch file, try with shell
    if (e.code === 'ENOENT' && process.platform === 'win32') {
      await execFilePromise('metaflac', args, { shell: true });
    } else {
      throw e;
    }
  }
  
  if (tags.imagePath) {
    const artArgs = [`--remove`, `--block-type=PICTURE`, filePath];
    const importArgs = [`--import-picture-from=${tags.imagePath}`, filePath];
    
    try {
      // Remove existing pictures first to ensure we replace, not append
      await execFilePromise('metaflac', artArgs);
      await execFilePromise('metaflac', importArgs);
    } catch (e) {
      if (e.code === 'ENOENT' && process.platform === 'win32') {
        await execFilePromise('metaflac', artArgs, { shell: true });
        await execFilePromise('metaflac', importArgs, { shell: true });
      } else {
        throw e;
      }
    }
  }
}

async function updateWithFfmpeg(filePath, tags) {
  const extension = path.extname(filePath);
  const tempPath = `${filePath}.tmp${extension}`;
  
  return new Promise((resolve, reject) => {
    let command = ffmpeg(filePath);
    
    if (tags.imagePath) {
      command = command.input(tags.imagePath);
    }

    command = command.outputOptions('-c', 'copy');

    if (tags.imagePath) {
      command = command
        .outputOptions('-map', '0')
        .outputOptions('-map', '-0:v?')
        .outputOptions('-map', '1:v')
        .outputOptions('-disposition:v:0', 'attached_pic');
    } else {
      command = command.outputOptions('-map', '0');
    }

    command = command.outputOptions('-map_metadata', '0');
      
    if (tags.title !== undefined) command = command.outputOptions('-metadata', `title=${tags.title}`);
    if (tags.artist !== undefined) command = command.outputOptions('-metadata', `artist=${tags.artist}`);
    if (tags.album !== undefined) command = command.outputOptions('-metadata', `album=${tags.album}`);
    if (tags.genre !== undefined) command = command.outputOptions('-metadata', `genre=${tags.genre}`);
    if (tags.year !== undefined) command = command.outputOptions('-metadata', `date=${tags.year}`);
    if (tags.track !== undefined) {
      command = command.outputOptions('-metadata', `track=${tags.track}`);
      command = command.outputOptions('-metadata', `TRACKNUMBER=${tags.track}`);
    }
    if (tags.lyrics !== undefined) command = command.outputOptions('-metadata', `lyrics=${tags.lyrics}`);
    if (tags.replayGain) {
      command = command.outputOptions('-metadata', `REPLAYGAIN_TRACK_GAIN=${tags.replayGain.trackGain}`);
      command = command.outputOptions('-metadata', `REPLAYGAIN_TRACK_PEAK=${tags.replayGain.trackPeak}`);
    }

    command
      .on('error', (err) => reject(err))
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

export const flacHandler = {
  updateMetadata,
  mimeType: 'audio/flac'
};
