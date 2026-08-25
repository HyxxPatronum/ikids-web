export type ProductionBindings = {
  DB?: unknown;
  FILES?: unknown;
  CONTENT_EDITOR_PREVIEW_TOKEN?: unknown;
};

export function validateProductionConfig(bindings: ProductionBindings): string[] {
  const errors: string[] = [];
  if (!bindings.DB) errors.push('DB relational database binding is required');
  if (!bindings.FILES) errors.push('FILES object storage binding is required');
  if (!String(bindings.CONTENT_EDITOR_PREVIEW_TOKEN || '').trim()) errors.push('CONTENT_EDITOR_PREVIEW_TOKEN is required');
  return errors;
}
