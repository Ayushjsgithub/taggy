import { NextResponse } from 'next/server';
import { searchRecording, getCoverArt, parseFilename, searchByArtist } from '@/lib/musicbrainz';

export async function POST(req) {
  try {
    const { artist, title, filename } = await req.json();
    
    let searchArtist = artist;
    let searchTitle = title;
    
    // 1. If metadata is missing, try parsing the filename
    if (!searchArtist || !searchTitle) {
      const parsed = parseFilename(filename || '');
      searchArtist = searchArtist || parsed.artist;
      searchTitle = searchTitle || parsed.title;
    }
    
    if (!searchArtist && !searchTitle) {
      return NextResponse.json({ error: 'Insufficient info to search' }, { status: 400 });
    }
    
    // 2. Search MusicBrainz (Primary: Artist + Title)
    let results = await searchRecording(searchArtist, searchTitle);
    
    // 3. Fallback: If no match found, search by Artist only
    if ((!results || results.length === 0) && searchArtist) {
      results = await searchRecording(searchArtist, '');
    }
    
    if (!results || results.length === 0) {
      return NextResponse.json({ error: 'No matches found' }, { status: 404 });
    }
    
    // 4. Try to get cover art for the top 5 suggestions
    const suggestions = await Promise.all(results.slice(0, 5).map(async (res) => {
      if (res.mbid) {
        res.coverArt = await getCoverArt(res.mbid);
      }
      return res;
    }));
    
    return NextResponse.json({
      success: true,
      suggestions: suggestions
    });
    
  } catch (error) {
    console.error('Autofill error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
