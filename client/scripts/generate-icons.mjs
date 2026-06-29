// Generates minimal valid PNG icons for PWA manifest.
// Replace these with proper branded icons before production release.
import { writeFileSync } from 'fs';
import { join } from 'path';
import { deflateSync } from 'zlib';

// Minimal 192x192 green-square PNG (valid PNG structure)
function generatePNG(size, colorHex) {
  const r = parseInt(colorHex.slice(1, 3), 16);
  const g = parseInt(colorHex.slice(3, 5), 16);
  const b = parseInt(colorHex.slice(5, 7), 16);
  
  // PNG signature
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  
  // IHDR chunk
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(size, 0);  // width
  ihdrData.writeUInt32BE(size, 4);  // height
  ihdrData.writeUInt8(8, 8);         // bit depth
  ihdrData.writeUInt8(2, 9);         // color type (RGB)
  ihdrData.writeUInt8(0, 10);        // compression
  ihdrData.writeUInt8(0, 11);        // filter
  ihdrData.writeUInt8(0, 12);        // interlace
  
  const ihdr = createChunk('IHDR', ihdrData);
  
  // IDAT chunk — raw pixel data (filter byte + RGB per row)
  const rawRows = [];
  for (let y = 0; y < size; y++) {
    rawRows.push(0); // filter byte: none
    for (let x = 0; x < size; x++) {
      rawRows.push(r, g, b);
    }
  }
  
  const compressed = deflateSync(Buffer.from(rawRows));
  const idat = createChunk('IDAT', compressed);
  
  // IEND chunk
  const iend = createChunk('IEND', Buffer.alloc(0));
  
  return Buffer.concat([signature, ihdr, idat, iend]);
}

function createChunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const typeBuffer = Buffer.from(type, 'ascii');
  const crc = crc32(Buffer.concat([typeBuffer, data]));
  const crcBuffer = Buffer.alloc(4);
  crcBuffer.writeUInt32BE(crc, 0);
  return Buffer.concat([length, typeBuffer, data, crcBuffer]);
}

function crc32(buf) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xEDB88320 : 0);
    }
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

const publicDir = join(import.meta.dirname, '..', 'public');

const icon192 = generatePNG(192, '#0F3B2C');
const icon512 = generatePNG(512, '#0F3B2C');

writeFileSync(join(publicDir, 'pwa-192x192.png'), icon192);
writeFileSync(join(publicDir, 'pwa-512x512.png'), icon512);

console.log('PWA icons generated in public/');
console.log('  pwa-192x192.png —', icon192.length, 'bytes');
console.log('  pwa-512x512.png —', icon512.length, 'bytes');
console.log('Replace these with your branded app icon before Play Store submission.');
