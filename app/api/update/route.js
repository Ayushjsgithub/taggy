import { NextResponse } from 'next/server';
import { writeMetadata } from '@/lib/audio-engine';
import { getHandler } from '@/lib/handlers/index.js';
import { cleanupTempDir } from '@/lib/cleanup';
import fs from 'fs-extra';
import path from 'path';

const TEMP_DIR = path.join(process.cwd(), 'temp');
export async function POST(req) {
  let filePath = '';
  let formData;
  try {
    formData = await req.formData();
  } catch (err) {
    console.error('Failed to parse form data:', err);
    return NextResponse.json({ error: 'Invalid form data', details: err.message }, { status: 400 });
  }

  const fileId = formData.get('fileId');
  const extension = formData.get('extension');
  const format = formData.get('format');
  const tagsJson = formData.get('tags');
  const applyReplayGain = formData.get('applyReplayGain') === 'true';

  const ALLOWED_EXTENSIONS = new Set(['.mp3', '.flac', '.m4a', '.wav']);
  const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  if (!fileId || !extension || !tagsJson) {
    return NextResponse.json({ error: 'Missing required information' }, { status: 400 });
  }

  if (typeof fileId !== 'string' || !UUID_REGEX.test(fileId)) {
    return NextResponse.json({ error: 'Invalid file ID format' }, { status: 400 });
  }

  if (typeof extension !== 'string' || !ALLOWED_EXTENSIONS.has(extension.toLowerCase())) {
    return NextResponse.json({ error: 'Invalid or unsupported extension' }, { status: 400 });
  }

  let tags;
  try {
    tags = JSON.parse(tagsJson);
  } catch (err) {
    return NextResponse.json({ error: 'Invalid tags JSON' }, { status: 400 });
  }

  // If a picture was uploaded as a separate file in the form, use it
  const pictureFile = formData.get('picture');
  if (pictureFile && pictureFile instanceof File) {
    const buffer = await pictureFile.arrayBuffer();
    tags.picture = {
      format: pictureFile.type,
      data: Buffer.from(buffer).toString('base64')
    };
  }

  try {
    // Trigger background cleanup (non-blocking)
    cleanupTempDir().catch(err => console.error('Background cleanup error:', err));

    filePath = path.resolve(TEMP_DIR, `${path.basename(fileId)}${extension.toLowerCase()}`);
    if (!filePath.startsWith(TEMP_DIR)) {
      return NextResponse.json({ error: 'Access denied: invalid file path' }, { status: 403 });
    }

    if (!(await fs.pathExists(filePath))) {
      return NextResponse.json({ error: 'File not found or expired' }, { status: 404 });
    }

    if (applyReplayGain) {
      const { calculateReplayGain } = await import('@/lib/replaygain.js');
      const gainData = await calculateReplayGain(filePath);
      if (gainData) {
        tags.replayGain = gainData;
      }
    }

    // 1. Update metadata losslessly
    try {
      await writeMetadata(filePath, tags, format);
    } catch (metadataError) {
      console.error(`Metadata write failed for ${fileId}:`, metadataError);
      return NextResponse.json({ 
        error: 'Failed to write metadata to file', 
        details: metadataError.message 
      }, { status: 500 });
    }


    // 2. Resolve Handler for MIME type
    const handler = getHandler(format || extension);
    
    // 3. Streaming Response (App Router style)
    const fileStream = fs.createReadStream(filePath);
    
    // In Next.js App Router, you can pass a Node.js ReadableStream 
    // to the Response constructor (it will be cast to a Web Stream)
    const response = new NextResponse(fileStream, {
      headers: {
        'Content-Type': handler.mimeType || 'application/octet-stream',
        'Content-Disposition': `attachment; filename="updated_${fileId}${extension}"`,
      },
    });

    // 4. Auto Cleanup System
    // Delete after a delay to ensure the user has time to download 
    // and to handle potential connection hiccups.
    setTimeout(() => {
      fs.unlink(filePath, (err) => {
        if (err && err.code !== 'ENOENT') {
          console.error(`Cleanup failed for ${filePath}:`, err);
        }
      });
    }, 10 * 60 * 1000); // 10 minutes

    return response;
  } catch (error) {
    console.error('Update error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
