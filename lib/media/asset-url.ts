export function mediaAssetUrl(raw?: string) {
  if (!raw) return '';
  if (/^(?:https?:|data:)/i.test(raw) || raw.startsWith('/api/')) return raw;
  const key = raw.replace(/^\/+/, '').split('/').map(encodeURIComponent).join('/');
  return `/api/media/${key}`;
}

export function pronunciationAssetUrl(raw?: string) {
  if (!raw || /^(?:https?:|data:)/i.test(raw)) return '';
  return mediaAssetUrl(raw);
}
