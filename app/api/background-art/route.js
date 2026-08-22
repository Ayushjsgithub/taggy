import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const ALLOWED_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.avif']);

export async function GET() {
  try {
    const artDir = path.join(process.cwd(), 'public', 'bg-art');
    const entries = await fs.readdir(artDir, { withFileTypes: true });

    const images = entries
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name)
      .filter((name) => ALLOWED_EXTENSIONS.has(path.extname(name).toLowerCase()))
      .sort((a, b) => a.localeCompare(b))
      .map((name) => `/bg-art/${name}`);

    return NextResponse.json({ success: true, images });
  } catch (error) {
    if (error.code === 'ENOENT') {
      return NextResponse.json({ success: true, images: [] });
    }

    return NextResponse.json({ success: false, images: [] }, { status: 500 });
  }
}
