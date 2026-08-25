export type IllustrationReview = 'pending' | 'approved' | 'rejected';
export type IllustrationAsset = { src: string; alt: string; source: string; review: IllustrationReview };
export type StudentIllustration = Omit<IllustrationAsset, 'review'>;

export type PronunciationAccent = 'us' | 'uk';
export type PronunciationAvailability = 'ready' | 'pending' | 'missing' | 'conflict';
export type PronunciationAsset = {
  region: PronunciationAccent;
  src: string;
  source: string;
  storage: string;
  availability: PronunciationAvailability;
};

export type CourseMedia = { illustration: IllustrationAsset | null; pronunciations: PronunciationAsset[] };

export const pronunciationAccents: PronunciationAccent[] = ['us', 'uk'];
const reviews: IllustrationReview[] = ['pending', 'approved', 'rejected'];
const text = (value: unknown) => String(value ?? '').trim();

// Course media is prepared before publication and stored with the course, so a student-facing
// asset location must stay inside product storage instead of pointing at a third-party domain.
const isCourseAssetPath = (value: string) => Boolean(value)
  && !/^[a-z][a-z0-9+.-]*:/i.test(value)
  && !value.startsWith('//')
  && !value.split(/[\\/]/).includes('..');

export function normalizeIllustration(value: unknown): IllustrationAsset | null {
  const raw = typeof value === 'string' ? { src: value } : value as Record<string, unknown> | null;
  const src = text(raw?.src ?? raw?.image ?? raw?.file);
  if (!isCourseAssetPath(src)) return null;
  const review = text(raw?.review ?? raw?.reviewStatus) as IllustrationReview;
  return {
    src,
    alt: text(raw?.alt ?? raw?.altText),
    source: text(raw?.source ?? raw?.provenance),
    review: reviews.includes(review) ? review : 'pending',
  };
}

export function studentIllustration(asset: IllustrationAsset | null): StudentIllustration | null {
  if (!asset || asset.review !== 'approved' || !asset.alt) return null;
  const { review: _review, ...visible } = asset;
  return visible;
}

export function normalizePronunciationAssets(value: unknown): PronunciationAsset[] {
  const list = Array.isArray(value)
    ? value
    : pronunciationAccents.map(region => {
      const asset = (value as Record<string, unknown> | null)?.[region];
      return asset ? { ...asset as Record<string, unknown>, region } : null;
    }).filter(Boolean);
  const assets: PronunciationAsset[] = [];
  const used = new Set<string>();
  for (const raw of list as Array<Record<string, unknown>>) {
    const region = text(raw?.region ?? raw?.accent).toLowerCase() as PronunciationAccent;
    if (!pronunciationAccents.includes(region) || assets.some(asset => asset.region === region)) continue;
    const src = text(raw?.src ?? raw?.audio ?? raw?.file);
    const declared = text(raw?.availability) as PronunciationAvailability;
    const availability: PronunciationAvailability = !isCourseAssetPath(src) ? 'missing'
      : used.has(src) ? 'conflict'
      : declared === 'pending' || declared === 'missing' ? declared
      : 'ready';
    if (availability === 'ready') used.add(src);
    assets.push({ region, src, source: text(raw?.source), storage: text(raw?.storage), availability });
  }
  return assets;
}

export const isPronunciationReady = (asset: PronunciationAsset) => asset.availability === 'ready';

export function courseMediaFor(term: Record<string, unknown> | null, card: Record<string, unknown> | null = null): CourseMedia {
  return {
    illustration: normalizeIllustration(term?.illustration ?? term?.image)
      || normalizeIllustration(card?.illustration ?? card?.image_file ?? card?.image),
    pronunciations: normalizePronunciationAssets(term?.pronunciations ?? []),
  };
}
