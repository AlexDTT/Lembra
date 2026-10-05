import { deflateSync } from 'node:zlib';
import { Buffer } from 'node:buffer';
import { mkdirSync, writeFileSync } from 'node:fs';

// Small deterministic PNG generator. The central L sits inside the maskable safe area.
function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, bytes) {
  const name = Buffer.from(type);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(bytes.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([name, bytes])));
  return Buffer.concat([length, name, bytes, crc]);
}
mkdirSync('public/icons', { recursive: true });
for (const [name, size] of [
  ['icon-192', 192],
  ['icon-512', 512],
  ['maskable-512', 512],
]) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size);
  header.writeUInt32BE(size, 4);
  header[8] = 8;
  header[9] = 2;
  const pixels = Buffer.alloc((size * 3 + 1) * size);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const isL =
        (x > size * 0.34 &&
          x < size * 0.45 &&
          y > size * 0.28 &&
          y < size * 0.72) ||
        (x > size * 0.34 &&
          x < size * 0.67 &&
          y > size * 0.61 &&
          y < size * 0.72);
      const offset = y * (size * 3 + 1) + 1 + x * 3;
      pixels.set(isL ? [255, 255, 255] : [23, 107, 91], offset);
    }
  writeFileSync(
    `public/icons/${name}.png`,
    Buffer.concat([
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
      chunk('IHDR', header),
      chunk('IDAT', deflateSync(pixels)),
      chunk('IEND', Buffer.alloc(0)),
    ]),
  );
}
