import { Jimp } from 'jimp';

type SupportedMime = 'image/jpeg' | 'image/png';

function isSupportedMime(value: string): value is SupportedMime {
  return value === 'image/jpeg' || value === 'image/png';
}

export async function toBlackAndWhite(buffer: Buffer, contentType: string): Promise<Buffer> {
  const image = await Jimp.read(buffer);
  image.greyscale();
  const mime: SupportedMime = isSupportedMime(contentType) ? contentType : 'image/png';
  return Buffer.from(await image.getBuffer(mime));
}
