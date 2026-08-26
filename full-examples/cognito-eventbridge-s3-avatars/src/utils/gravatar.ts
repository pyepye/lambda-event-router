import { createHash } from 'node:crypto';

import { deleteAvatar, getBucketName, listAvatarsForUserName, putAvatar } from './s3.js';

const GRAVATAR_SIZE = 512;
const PLACEHOLDER_PIXEL_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

export interface GravatarResult {
  buffer: Buffer;
  contentType: string;
}

function hashEmail(email: string): string {
  return createHash('md5').update(email.trim().toLowerCase()).digest('hex');
}

export async function fetchGravatar(email: string): Promise<GravatarResult | null> {
  const url = `https://www.gravatar.com/avatar/${hashEmail(email)}?d=404&s=${GRAVATAR_SIZE}`;
  const response = await fetch(url);
  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Error(`Gravatar fetch failed: ${response.status} ${response.statusText}`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  const contentType = response.headers.get('content-type') ?? 'image/jpeg';
  return { buffer, contentType };
}

function placeholderAvatar(): GravatarResult {
  return {
    buffer: Buffer.from(PLACEHOLDER_PIXEL_PNG_BASE64, 'base64'),
    contentType: 'image/png',
  };
}

export async function uploadAvatarForUserName(email: string, userName: string): Promise<void> {
  const result = (await fetchGravatar(email)) ?? placeholderAvatar();
  // Gravatar only serves png or jpg
  const extension = result.contentType.endsWith('png') ? 'png' : 'jpg';
  const key = `originals/${userName}.${extension}`;
  const bucket = getBucketName();

  // The user can have an avatar under the other extension, so remove it.
  const existingKeys = await listAvatarsForUserName({ bucket, userName });
  const staleDeletes = existingKeys
    .filter((existingKey) => existingKey !== key)
    .map((staleKey) => deleteAvatar({ bucket, key: staleKey }));
  await Promise.all(staleDeletes);

  await putAvatar({ bucket, key, body: result.buffer, contentType: result.contentType });
}
