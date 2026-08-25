const structures = new Map([
  ['feature-function', 'Feature-Function'], ['feature / function', 'Feature-Function'], ['feature → function', 'Feature-Function'],
  ['cause-effect', 'Cause-Effect'], ['cause / effect', 'Cause-Effect'], ['cause → effect', 'Cause-Effect'],
  ['process/life cycle', 'Process/Life cycle'], ['process / life cycle', 'Process/Life cycle'],
  ['compare-contrast', 'Compare-Contrast'], ['compare / contrast', 'Compare-Contrast'],
  ['fact/explanation', 'Fact/Explanation'], ['fact / explanation', 'Fact/Explanation'],
]);

export const canonicalStructure = (value: unknown) => structures.get(String(value || '').trim().toLowerCase()) || null;

export const cardSlug = (card: Record<string, any>) => card.slug
  || `${String(card.courseId || 'course').toLowerCase()}-${card.day}-${String(card.title || card.cardId).toLowerCase().replace(/[^a-z0-9]+/g, '-')}`
    .replace(/-+/g, '-').replace(/^-|-$/g, '');

export function normalizeContentCard<T extends Record<string, any>>(card: T) {
  const structure = canonicalStructure(card.articleStructure || card.structure);
  return { ...card, slug: cardSlug(card), articleStructure: structure, structure };
}
