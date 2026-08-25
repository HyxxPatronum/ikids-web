import { isValidObjectKey, type ObjectStorage } from './object-storage.ts';

async function objectBody(object: R2ObjectBody): Promise<Uint8Array> {
  if (typeof object.arrayBuffer === 'function') return new Uint8Array(await object.arrayBuffer());
  return new Uint8Array(await new Response(object.body).arrayBuffer());
}

export function createR2ObjectStorage(bucket: R2Bucket): ObjectStorage {
  return {
    async put(key, body, options) {
      if (!isValidObjectKey(key) || !options.contentType || !body.byteLength) throw new Error('Invalid stored asset');
      await bucket.put(key, body, { httpMetadata: { contentType: options.contentType } });
    },
    async get(key) {
      if (!isValidObjectKey(key)) return null;
      const object = await bucket.get(key);
      if (!object) return null;
      const body = await objectBody(object);
      return {
        body,
        contentType: object.httpMetadata?.contentType || 'application/octet-stream',
        size: object.size,
      };
    },
    async delete(key) { if (isValidObjectKey(key)) await bucket.delete(key); },
  };
}
