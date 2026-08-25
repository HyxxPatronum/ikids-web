export function mediaAssetUrl(raw?: string) {
  if (!raw) return '';
  if (/^(?:https?:|data:|\/)/i.test(raw)) return raw;
  const key = raw.replace(/^\/+/, '').split('/').map(encodeURIComponent).join('/');
  return `/api/media/${key}`;
}
