import { readFile } from 'node:fs/promises';
import path from 'node:path';

const imageTypes: Record<string, string> = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' };

export async function GET(_: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  const safeFile = path.basename(file);
  const extension = path.extname(safeFile).toLowerCase();
  if (safeFile !== file || !imageTypes[extension]) return new Response('Not found', { status: 404 });
  try { return new Response(await readFile(path.join(process.cwd(), 'lib', 'course', safeFile)), { headers: { 'content-type': imageTypes[extension], 'cache-control': 'public, max-age=3600' } }); }
  catch { return new Response('Not found', { status: 404 }); }
}
