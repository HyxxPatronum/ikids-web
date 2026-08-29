import { readFile } from 'node:fs/promises';
import path from 'node:path';

const imageTypes: Record<string, string> = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' };

/**
 * Serve the webp thumbnail for a course image.
 * Expects the original basename (e.g. day-001-living-things-seed.png) and serves
 * the generated `*.webp` thumbnail from lib/course/; falls back to the original
 * when no thumbnail exists.
 */
export async function GET(_: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  const safeFile = path.basename(file);
  const extension = path.extname(safeFile).toLowerCase();
  if (safeFile !== file || !imageTypes[extension]) return new Response('Not found', { status: 404 });

  const baseDir = path.join(process.cwd(), 'lib', 'course');
  const thumbName = safeFile.replace(extension, '.webp');
  try {
    // Prefer the generated webp thumbnail; fall back to the original file.
    const thumb = await readFile(path.join(baseDir, thumbName)).catch(() => null);
    const body = thumb ?? await readFile(path.join(baseDir, safeFile));
    const contentType = thumb ? 'image/webp' : imageTypes[extension];
    return new Response(body, { headers: { 'content-type': contentType, 'cache-control': 'public, max-age=3600' } });
  } catch {
    return new Response('Not found', { status: 404 });
  }
}