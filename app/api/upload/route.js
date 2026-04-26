import { NextResponse } from 'next/server';
import { readMetadata } from '@/lib/audio-engine';
import { cleanupTempDir } from '@/lib/cleanup';
import fs from 'fs-extra';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { Readable } from 'stream';
import { createWriteStream } from 'fs';

const TEMP_DIR = path.join(process.cwd(), 'temp');
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const ALLOWED_EXTENSIONS = ['.mp3', '.flac', '.m4a', '.wav'];

export async function POST(req) {
  try {
    await fs.ensureDir(TEMP_DIR);
    
    // Trigger background cleanup on upload (non-blocking)
    cleanupTempDir().catch(err => console.error('Background cleanup error:', err));

    const formData = await req.formData();
    const file = formData.get('file');

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    // 1. Validate File Size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'File size exceeds 50MB limit' }, { status: 400 });
    }

    // 2. Validate Format
    const originalName = file.name;
    const extension = path.extname(originalName).toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(extension)) {
      return NextResponse.json({ error: `Unsupported format: ${extension}` }, { status: 400 });
    }

    const fileId = uuidv4();
    const tempFilePath = path.join(TEMP_DIR, `${fileId}${extension}`);

    // 3. Streaming Write (Safe for memory)
    const nodeStream = Readable.fromWeb(file.stream());
    const writeStream = createWriteStream(tempFilePath);

    await new Promise((resolve, reject) => {
      nodeStream.pipe(writeStream)
        .on('finish', resolve)
        .on('error', reject);
    });

    // 4. Read metadata
    const metadata = await readMetadata(tempFilePath, originalName);

    return NextResponse.json({
      success: true,
      fileId: fileId,
      extension: extension,
      format: extension.replace('.', ''),
      metadata: metadata,
    });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
