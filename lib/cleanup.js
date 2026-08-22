import fs from 'fs-extra';
import path from 'path';

const TEMP_DIR = path.join(process.cwd(), 'temp');
const MAX_AGE_MS = 30 * 60 * 1000; // 30 minutes

/**
 * Cleans up files in the temp directory that are older than MAX_AGE_MS.
 */
export async function cleanupTempDir() {
  try {
    if (!(await fs.pathExists(TEMP_DIR))) return;

    const files = await fs.readdir(TEMP_DIR);
    const now = Date.now();

    for (const file of files) {
      const filePath = path.join(TEMP_DIR, file);
      
      // Skip .gitkeep or other hidden files
      if (file.startsWith('.')) continue;

      try {
        const stats = await fs.stat(filePath);
        const age = now - stats.mtimeMs;

        if (age > MAX_AGE_MS) {
          await fs.unlink(filePath);
          console.log(`[Cleanup] Deleted old file: ${file}`);
        }
      } catch (err) {
        console.error(`[Cleanup] Failed to process ${file}:`, err);
      }
    }
  } catch (error) {
    console.error('[Cleanup] Error during temp directory cleanup:', error);
  }
}
