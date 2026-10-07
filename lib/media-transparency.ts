import sharp from 'sharp';

export async function hasTransparentBackground(source: Buffer): Promise<boolean> {
  const image = sharp(source, { pages: 1 });
  const metadata = await image.metadata();
  if (!metadata.hasAlpha) return false;

  const { channels } = await image.stats();
  return channels[3].min < 255;
}

export async function checkMediaTransparencyFromUrl(url: string): Promise<boolean> {
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) throw new Error(`Failed to fetch source image: ${response.status}`);
  return hasTransparentBackground(Buffer.from(await response.arrayBuffer()));
}