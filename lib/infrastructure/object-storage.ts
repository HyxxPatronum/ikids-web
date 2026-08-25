export type StoredObject = { body: Uint8Array; contentType: string; size: number };
export type ObjectStorage = {
  put(key: string, body: Uint8Array, options: { contentType: string }): Promise<void>;
  get(key: string): Promise<StoredObject | null>;
  delete(key: string): Promise<void>;
};

export const isValidObjectKey = (key: string) => Boolean(key && !key.startsWith('/') && !key.includes('\\') && !key.split('/').includes('..'));

export async function verifyStoredAsset(storage: ObjectStorage, key: string) {
  const asset = await storage.get(key);
  return asset
    ? { ok: asset.size > 0, contentType: asset.contentType, size: asset.size }
    : { ok: false, contentType: '', size: 0 };
}

export function createMemoryObjectStorage(): ObjectStorage {
  const objects = new Map<string, StoredObject>();
  return {
    async put(key, body, options) {
      if (!isValidObjectKey(key) || !options.contentType || !body.byteLength) throw new Error('Invalid stored asset');
      objects.set(key, { body: body.slice(), contentType: options.contentType, size: body.byteLength });
    },
    async get(key) {
      const object = objects.get(key);
      return object ? { ...object, body: object.body.slice() } : null;
    },
    async delete(key) { objects.delete(key); },
  };
}
