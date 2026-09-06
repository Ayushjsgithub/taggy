import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';
import * as mm from 'music-metadata';

let ffmpegInstance = null;

export async function getFFmpeg() {
  if (ffmpegInstance) return ffmpegInstance;
  
  ffmpegInstance = new FFmpeg();
  
  const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd';
  
  await ffmpegInstance.load({
    coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
    wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
  });
  
  return ffmpegInstance;
}

export async function readMetadataBrowser(file) {
  const metadata = await mm.parseBlob(file);
  const { common, format } = metadata;
  
  const toString = (val) => {
    const first = Array.isArray(val) ? val[0] : val;
    if (typeof first === 'object' && first !== null) {
      if ('text' in first && first !== null) return String(first.text).trim();
      if ('lyrics' in first && first !== null) return String(first.lyrics).trim();
      if (first instanceof Date) return first.toISOString().split('T')[0];
      return String(first).trim();
    }
    return first !== undefined && first !== null ? String(first).trim() : '';
  };
  
  // Try to get original name from file object
  const originalName = file.name || '';
  const extension = originalName.substring(originalName.lastIndexOf('.'));
  
  let picture = null;
  if (common.picture && common.picture[0]) {
    // Convert Uint8Array to base64 for the UI
    const uint8Array = common.picture[0].data;
    const binaryString = Array.from(uint8Array)
      .map((b) => String.fromCharCode(b))
      .join('');
    picture = {
      format: common.picture[0].format,
      data: btoa(binaryString),
    };
  }

  let trackNo = '';
  if (common.track) {
    if (common.track.no != null) {
      trackNo = common.track.of ? `${common.track.no}/${common.track.of}` : String(common.track.no);
    } else if (typeof common.track === 'string' || typeof common.track === 'number') {
      trackNo = String(common.track);
    }
  }

  return {
    title: toString(common.title) || originalName.replace(extension, ''),
    artist: toString(common.artist) || toString(common.albumartist) || '',
    album: toString(common.album) || '',
    genre: toString(common.genre) || '',
    year: toString(common.year) || toString(common.date) || '',
    track: trackNo,
    lyrics: toString(common.lyrics) || '',
    duration: format.duration,
    bitrate: format.bitrate,
    container: format.container,
    format: extension.replace('.', '').toLowerCase(),
    picture,
  };
}

export async function writeMetadataBrowser(file, tags) {
  const ffmpeg = await getFFmpeg();
  
  const originalName = file.name;
  const extension = originalName.substring(originalName.lastIndexOf('.'));
  const inputName = `input${extension}`;
  const outputName = `output${extension}`;
  
  // Write the main audio file to FFmpeg's virtual filesystem
  await ffmpeg.writeFile(inputName, await fetchFile(file));
  
  const args = ['-i', inputName];
  
  // If there's cover art, write it to VFS and map it
  let artName = null;
  if (tags.picture && tags.picture.data) {
    const artExt = tags.picture.format === 'image/jpeg' ? '.jpg' : '.png';
    artName = `cover${artExt}`;
    
    // Convert base64 back to Uint8Array
    const binaryString = atob(tags.picture.data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    await ffmpeg.writeFile(artName, bytes);
    args.push('-i', artName);
  }
  
  // Stream copy
  args.push('-c', 'copy');
  
  // Mapping for cover art
  if (artName) {
    args.push('-map', '0');       // Map all streams from input 0 (audio)
    args.push('-map', '-0:v?');   // Drop existing video/art from input 0
    args.push('-map', '1:v');     // Map the new art from input 1
    args.push('-disposition:v:0', 'attached_pic'); // Mark it as cover art
  } else {
    args.push('-map', '0');
  }
  
  // Strip existing metadata to cleanly write new tags
  args.push('-map_metadata', '0');
  
  if (tags.title) args.push('-metadata', `title=${tags.title}`);
  if (tags.artist) args.push('-metadata', `artist=${tags.artist}`);
  if (tags.album) args.push('-metadata', `album=${tags.album}`);
  if (tags.genre) args.push('-metadata', `genre=${tags.genre}`);
  if (tags.year) args.push('-metadata', `date=${tags.year}`);
  if (tags.track) {
    args.push('-metadata', `track=${tags.track}`);
    args.push('-metadata', `TRACKNUMBER=${tags.track}`);
  }
  if (tags.lyrics) args.push('-metadata', `lyrics=${tags.lyrics}`);
  
  if (tags.replayGain) {
    args.push('-metadata', `REPLAYGAIN_TRACK_GAIN=${tags.replayGain.trackGain}`);
    args.push('-metadata', `REPLAYGAIN_TRACK_PEAK=${tags.replayGain.trackPeak}`);
  }
  
  args.push(outputName);
  
  // Run FFmpeg
  await ffmpeg.exec(args);
  
  // Read back the processed file
  const data = await ffmpeg.readFile(outputName);
  
  // Clean up VFS
  await ffmpeg.deleteFile(inputName);
  await ffmpeg.deleteFile(outputName);
  if (artName) await ffmpeg.deleteFile(artName);
  
  // Return as Blob
  return new Blob([data.buffer], { type: file.type });
}

