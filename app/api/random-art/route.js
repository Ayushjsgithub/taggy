import { NextResponse } from 'next/server';
import { getRandomMusicBrainzArt } from '@/lib/musicbrainz';

export async function GET() {
  try {
    const artUrl = await getRandomMusicBrainzArt();
    if (!artUrl) {
      return NextResponse.json({ success: false, error: 'Failed to fetch random art' }, { status: 500 });
    }
    return NextResponse.json({ success: true, url: artUrl });
  } catch (error) {
    console.error('Random art route error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
