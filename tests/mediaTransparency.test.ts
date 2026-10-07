import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { hasTransparentBackground } from '../lib/media-transparency';

test('detects actual transparent pixels, not merely an alpha channel', async () => {
  const opaqueRgba = await sharp({ create: { width: 2, height: 2, channels: 4, background: '#ff0000ff' } }).png().toBuffer();
  const transparentRgba = await sharp({ create: { width: 2, height: 2, channels: 4, background: '#ff000080' } }).png().toBuffer();
  const opaqueRgb = await sharp({ create: { width: 2, height: 2, channels: 3, background: '#ff0000' } }).jpeg().toBuffer();

  assert.equal(await hasTransparentBackground(opaqueRgba), false);
  assert.equal(await hasTransparentBackground(transparentRgba), true);
  assert.equal(await hasTransparentBackground(opaqueRgb), false);
});