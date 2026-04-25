import NodeID3 from 'node-id3';
import fs from 'fs-extra';
import { open } from 'fs/promises';

async function removeId3v1Tag(filePath) {
  const stats = await fs.stat(filePath);
  if (stats.size < 128) return;

  const fileHandle = await open(filePath, 'r');

  try {
    const trailer = Buffer.alloc(128);
    await fileHandle.read(trailer, 0, 128, stats.size - 128);

    if (trailer.subarray(0, 3).toString('latin1') === 'TAG') {
      await fs.truncate(filePath, stats.size - 128);
    }
  } finally {
    await fileHandle.close();
  }
}

/**
 * Updates MP3 metadata using node-id3.
 * @param {string} filePath 
 * @param {object} tags 
 */
export async function updateMetadata(filePath, tags) {
  await removeId3v1Tag(filePath);

  // 1. Read existing tags
  const currentTags = NodeID3.read(filePath) || {};
  
  // 2. Map and prepare new tags
  const id3Tags = {
    title: tags.title,
    artist: tags.artist,
    album: tags.album,
    genre: tags.genre,
    year: tags.year ? String(tags.year) : undefined,
    trackNumber: tags.track ? String(tags.track) : undefined,
  };

  if (tags.picture) {
    id3Tags.image = {
      mime: tags.picture.format,
      type: { id: 3, name: 'front cover' },
      description: 'Front Cover',
      imageBuffer: Buffer.from(tags.picture.data, 'base64'),
    };
  }

  if (tags.lyrics) {
    id3Tags.unsynchronisedLyrics = {
      language: 'eng',
      text: tags.lyrics,
    };
  }

  if (tags.replayGain) {
    id3Tags.userDefinedText = [
      { description: 'REPLAYGAIN_TRACK_GAIN', value: tags.replayGain.trackGain },
      { description: 'REPLAYGAIN_TRACK_PEAK', value: tags.replayGain.trackPeak }
    ];
  }

  // 3. Delete raw sub-object to prevent duplicate frame corruption (e.g. writing both title and raw.TIT2)
  delete currentTags.raw;

  // 4. Purge existing friendly fields we are about to update to avoid duplicates/conflicts
  const fieldsToPurge = [
    'title',
    'artist',
    'album',
    'genre',
    'year',
    'trackNumber',
    'unsynchronisedLyrics',
    'image'
  ];

  for (const field of fieldsToPurge) {
    delete currentTags[field];
  }

  // 5. Merge
  const finalTags = {
    ...currentTags,
    ...id3Tags
  };

  // 6. Write back
  const success = NodeID3.write(finalTags, filePath);
  
  if (success instanceof Error) throw success;
  if (success === false) throw new Error('node-id3 failed to write tags');
  
  return success;
}

export const mp3Handler = {
  updateMetadata,
  mimeType: 'audio/mpeg'
};
