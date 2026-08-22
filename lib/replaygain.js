import { execFile } from 'child_process';
import util from 'util';
import { ffmpegPath } from './ffmpeg.js';

const execFileAsync = util.promisify(execFile);

/**
 * Calculates ReplayGain for an audio file using FFmpeg's replaygain filter.
 * 
 * @param {string} filePath - Absolute path to the audio file.
 * @returns {Promise<{trackGain: string, trackPeak: string} | null>}
 */
export async function calculateReplayGain(filePath) {
  try {
    const binary = ffmpegPath || 'ffmpeg';
    // -f null - throws away output stream, analyzing only. 
    // FFmpeg outputs the replaygain analysis to stderr.
    const { stderr } = await execFileAsync(binary, ['-i', filePath, '-af', 'replaygain', '-f', 'null', '-']);
    
    let trackGain = null;
    let trackPeak = null;
    
    const gainMatch = stderr.match(/track_gain\s*=\s*([-+0-9.]+)\s*dB/i);
    if (gainMatch) {
      trackGain = `${parseFloat(gainMatch[1]).toFixed(2)} dB`;
    }

    const peakMatch = stderr.match(/track_peak\s*=\s*([0-9.]+)/i);
    if (peakMatch) {
      trackPeak = parseFloat(peakMatch[1]).toFixed(6);
    }

    if (trackGain && trackPeak) {
      return { trackGain, trackPeak };
    }
    
    return null;
  } catch (err) {
    console.error('ReplayGain analysis error:', err);
    // Return null instead of crashing so we don't break the entire tag update process
    return null; 
  }
}
