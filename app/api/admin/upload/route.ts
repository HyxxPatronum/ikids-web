import { writeFile, readFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const courseDir = path.join(process.cwd(), 'lib', 'course');

/** Append a timestamp suffix if the file already exists (avoid overwrite). */
async function safeFileName(dir: string, baseName: string): Promise<string> {
  const target = path.join(dir, baseName);
  try {
    await readFile(target);
    const ext = path.extname(baseName);
    const stem = baseName.slice(0, -ext.length || undefined);
    return `${stem}-${Date.now()}${ext}`;
  } catch { return baseName; }
}

/** Generate a webp thumbnail (max 400px wide, quality 75) alongside the original. */
async function generateWebpThumb(filePath: string): Promise<string | null> {
  const ext = path.extname(filePath).toLowerCase();
  if (!['.png', '.jpg', '.jpeg', '.webp'].includes(ext)) return null;
  const thumbPath = filePath.replace(ext, '.webp');
  try {
    await sharp(filePath)
      .resize(400, undefined, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 75 })
      .toFile(thumbPath);
    return path.basename(thumbPath);
  } catch {
    return null;
  }
}

/** Ensure the image references in the JSON point to files that actually exist. */
function validateImageRefs(card: Record<string, unknown>, uploadedFiles: string[]) {
  const issues: string[] = [];
  const fileSet = new Set(uploadedFiles.map(f => f.toLowerCase()));
  const exists = (ref: unknown) => {
    if (typeof ref !== 'string') return true; // no reference → no issue
    return fileSet.has(ref.toLowerCase()) || fileSet.has(ref.toLowerCase().replace(/\.webp$/, '.png'));
  };

  // Card main image
  if (card.image_file && !exists(card.image_file)) {
    issues.push(`主图 "${card.image_file}" 未在本次上传中找到`);
  }

  // Word bank images
  const wordBank = card.word_bank;
  if (Array.isArray(wordBank)) {
    for (const w of wordBank) {
      if (typeof w === 'object' && w) {
        const ref = (w as Record<string, unknown>).image_file || (w as Record<string, unknown>).image || (w as Record<string, unknown>).illustration;
        if (ref && !exists(ref)) {
          issues.push(`核心词 "${(w as Record<string, unknown>).english}" 配图 "${ref}" 未找到`);
        }
      }
    }
  }

  // Context question images (FILL THE GAP)
  const wordModule = card.wordModule;
  if (wordModule && typeof wordModule === 'object') {
    const contextQuestions = (wordModule as Record<string, unknown>).contextQuestions;
    if (Array.isArray(contextQuestions)) {
      for (let i = 0; i < contextQuestions.length; i++) {
        const q = contextQuestions[i];
        if (typeof q === 'object' && q) {
          const ref = (q as Record<string, unknown>).image_file || (q as Record<string, unknown>).image;
          if (ref && !exists(ref)) {
            issues.push(`填空第 ${i + 1} 题配图 "${ref}" 未找到`);
          }
        }
      }
    }
  }

  return issues;
}

export async function POST(request: Request) {
  try {
    await mkdir(courseDir, { recursive: true });
    const formData = await request.formData();

    // Separate JSON files from image files
    const jsonFiles: { name: string; content: string }[] = [];
    const imageFiles: { name: string; data: Uint8Array }[] = [];

    for (const [key, value] of formData.entries()) {
      if (!(value instanceof File)) continue;

      const ext = path.extname(value.name).toLowerCase();
      const bytes = new Uint8Array(await value.arrayBuffer());

      if (ext === '.json') {
        jsonFiles.push({ name: value.name, content: new TextDecoder().decode(bytes) });
      } else if (['.png', '.jpg', '.jpeg', '.webp'].includes(ext)) {
        imageFiles.push({ name: value.name, data: bytes });
      }
    }

    // --- Process image files (save + generate webp thumbnail) ---
    const savedImages: { original: string; webp: string | null }[] = [];
    for (const img of imageFiles) {
      const safeName = await safeFileName(courseDir, img.name);
      const filePath = path.join(courseDir, safeName);
      await writeFile(filePath, img.data);
      const webpName = await generateWebpThumb(filePath);
      savedImages.push({ original: safeName, webp: webpName });
    }

    // --- Process JSON files (save + validate) ---
    const cards: { name: string; issues: string[] }[] = [];
    for (const json of jsonFiles) {
      const safeName = await safeFileName(courseDir, json.name);
      const filePath = path.join(courseDir, safeName);
      await writeFile(filePath, json.content);

      let card: Record<string, unknown>;
      try {
        card = JSON.parse(json.content);
      } catch {
        cards.push({ name: safeName, issues: ['JSON 解析失败'] });
        continue;
      }

      const issues = validateImageRefs(card, imageFiles.map(i => i.name));
      cards.push({ name: safeName, issues });
    }

    return Response.json({
      ok: true,
      cards,
      images: savedImages,
      summary: `已保存 ${jsonFiles.length} 个 JSON 文件，${imageFiles.length} 个图片文件，生成 ${savedImages.filter(i => i.webp).length} 个 webp 缩略图`,
    });
  } catch (error) {
    return Response.json({ ok: false, error: error instanceof Error ? error.message : '上传处理失败' }, { status: 500 });
  }
}