/**
 * Utility for fetching metadata from MusicBrainz and Cover Art Archive.
 */

const USER_AGENT = 'Taggy/1.0.0 ( https://github.com/taggy/taggy )';

/**
 * Helper to build a fuzzy keyword query for a field.
 * @param {string} field 
 * @param {string} value 
 * @returns {string|null}
 */
function buildKeywordQuery(field, value) {
  if (!value) return null;
  // Split by whitespace and filter out empty strings
  const keywords = value.split(/\s+/).filter(k => k.length > 0);
  if (keywords.length === 0) return null;
  
  // Create a query like field:(word1* OR word2* OR ...)
  // This allows matching any of the keywords and handles partial words
  const terms = keywords
    .map(k => k.replace(/[()\[\]{}:^"~*?+\-&|!\\]/g, ''))
    .filter(k => k.length > 0)
    .map(k => `${k}*`);

  if (terms.length === 0) return null;
  return `${field}:(${terms.join(' OR ')})`;
}

/**
 * Searches for recordings on MusicBrainz.
 * @param {string} artist 
 * @param {string} title 
 * @param {number} limit
 * @returns {Promise<Array|null>}
 */
export async function searchRecording(artist, title, limit = 5) {
  const artistQuery = buildKeywordQuery('artist', artist);
  const titleQuery = buildKeywordQuery('recording', title);
  
  const queryParts = [];
  if (artistQuery) queryParts.push(artistQuery);
  if (titleQuery) queryParts.push(titleQuery);
  
  const query = queryParts.join(' AND ');
  if (!query) return null;

  const url = `https://musicbrainz.org/ws/2/recording/?query=${encodeURIComponent(query)}&fmt=json&limit=${limit}`;

  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT }
    });
    
    if (!response.ok) throw new Error(`MusicBrainz error: ${response.status}`);
    
    const data = await response.json();
    if (!data.recordings || data.recordings.length === 0) return null;

    return data.recordings.map(recording => ({
      title: recording.title,
      artist: recording['artist-credit']?.[0]?.name || artist,
      album: recording.releases?.[0]?.title || '',
      year: recording.releases?.[0]?.['date']?.split('-')[0] || '',
      track: recording.releases?.[0]?.media?.[0]?.tracks?.[0]?.number || '',
      mbid: recording.releases?.[0]?.id || null,
      genre: recording.tags?.[0]?.name || '',
    }));
  } catch (error) {
    console.error('MusicBrainz search error:', error);
    return null;
  }
}

/**
 * Searches for recordings by a specific artist, optionally filtered by a title prefix.
 * @param {string} artist 
 * @param {string} prefix 
 * @returns {Promise<Array|null>}
 */
export async function searchByArtist(artist, prefix = '') {
  const artistQuery = buildKeywordQuery('artist', artist);
  const titleQuery = buildKeywordQuery('recording', prefix);
  
  const queryParts = [];
  if (artistQuery) queryParts.push(artistQuery);
  if (titleQuery) queryParts.push(titleQuery);
  
  const query = queryParts.join(' AND ');
  if (!query) return null;

  const url = `https://musicbrainz.org/ws/2/recording/?query=${encodeURIComponent(query)}&fmt=json&limit=15`;

  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT }
    });
    
    if (!response.ok) throw new Error(`MusicBrainz error: ${response.status}`);
    
    const data = await response.json();
    if (!data.recordings || data.recordings.length === 0) return null;

    // Use a Map to de-duplicate by title/album to avoid showing 10 versions of the same song
    const seen = new Set();
    const results = [];

    for (const rec of data.recordings) {
      const key = `${rec.title}-${rec.releases?.[0]?.title}`.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        results.push({
          title: rec.title,
          artist: rec['artist-credit']?.[0]?.name || artist,
          album: rec.releases?.[0]?.title || '',
          year: rec.releases?.[0]?.['date']?.split('-')[0] || '',
          track: rec.releases?.[0]?.media?.[0]?.tracks?.[0]?.number || '',
          mbid: rec.releases?.[0]?.id || null,
        });
      }
    }

    return results;
  } catch (error) {
    console.error('MusicBrainz artist search error:', error);
    return null;
  }
}

/**
 * Fetches cover art URL from Cover Art Archive.
 * @param {string} mbid MusicBrainz Release ID
 * @returns {Promise<string|null>}
 */
export async function getCoverArt(mbid) {
  if (!mbid) return null;
  
  const url = `https://coverartarchive.org/release/${mbid}/front`;
  
  try {
    // We just want to check if it exists and get the final URL (as it redirects)
    const response = await fetch(url, { method: 'HEAD' });
    if (response.ok) {
      return url; // The front cover endpoint is stable
    }
    return null;
  } catch (error) {
    return null;
  }
}

/**
 * Fetches a random cover art URL from MusicBrainz.
 * @returns {Promise<string|null>}
 */
export async function getRandomMusicBrainzArt() {
  const genres = ['rock', 'pop', 'electronic', 'jazz', 'hip-hop', 'metal', 'classical', 'soul', 'funk', 'disco'];
  const randomGenre = genres[Math.floor(Math.random() * genres.length)];
  const offset = Math.floor(Math.random() * 100);
  
  const url = `https://musicbrainz.org/ws/2/release/?query=tag:${randomGenre}&fmt=json&limit=20&offset=${offset}`;

  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT }
    });
    
    if (!response.ok) throw new Error(`MusicBrainz error: ${response.status}`);
    
    const data = await response.json();
    if (!data.releases || data.releases.length === 0) return null;

    // Pick a random release that has cover art (usually indicated by 'cover-art-archive' field)
    const releasesWithArt = data.releases.filter(r => r['cover-art-archive']?.front);
    if (releasesWithArt.length === 0) {
      // Fallback to picking any and trying it
      const randomRelease = data.releases[Math.floor(Math.random() * data.releases.length)];
      return `https://coverartarchive.org/release/${randomRelease.id}/front`;
    }

    const randomRelease = releasesWithArt[Math.floor(Math.random() * releasesWithArt.length)];
    return `https://coverartarchive.org/release/${randomRelease.id}/front`;
  } catch (error) {
    console.error('Random art fetch error:', error);
    return null;
  }
}

/**
 * Improved filename parser for common patterns.
 * @param {string} filename 
 * @returns {object}
 */
export function parseFilename(filename) {
  // 1. Remove extension
  let cleanName = filename.replace(/\.(mp3|flac|wav|m4a)$/i, '');
  
  // 2. Remove common noise
  cleanName = cleanName
    .replace(/\[.*?\]/g, '') // [Official Video]
    .replace(/\(.*?\)/g, '') // (Lyrics)
    .replace(/Official (Music Video|Audio|Video)/gi, '')
    .replace(/LYRICS/gi, '')
    .replace(/HD/g, '')
    .replace(/4K/g, '')
    .trim();

  // 3. Try different separators
  const separators = [' - ', ' – ', ' — ', ' ~ ', ' : '];
  for (const sep of separators) {
    const parts = cleanName.split(sep);
    if (parts.length >= 2) {
      return {
        artist: parts[0].trim(),
        title: parts[1].trim()
      };
    }
  }
  
  return {
    artist: '',
    title: cleanName.trim()
  };
}
