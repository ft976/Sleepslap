import { AUDIO_MANIFEST, type AudioKey } from './types';

export interface ZipInputEntry {
  name: string;
  data: Uint8Array;
}

export interface ZipParsedEntry {
  name: string;
  data: Uint8Array;
}

const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) !== 0 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c >>> 0;
  }
  return table;
})();

export function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    crc = CRC32_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/**
 * Builds an uncompressed (STORE method 0) ZIP archive byte buffer.
 * Pure TypeScript, zero external dependencies, compatible with macOS/Windows/Linux/Android/iOS.
 */
export function createZipBytes(entries: ZipInputEntry[]): Uint8Array {
  const encoder = new TextEncoder();
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBytes = encoder.encode(entry.name);
    const data = entry.data;
    const crc = crc32(data);

    // Local file header (30 bytes + filename)
    const localHeader = new Uint8Array(30 + nameBytes.length);
    const ldv = new DataView(localHeader.buffer);
    ldv.setUint32(0, 0x04034b50, true);
    ldv.setUint16(4, 20, true); // version needed
    ldv.setUint16(6, 0x0800, true); // UTF-8 flag
    ldv.setUint16(8, 0, true); // STORE compression
    ldv.setUint16(10, 0, true);
    ldv.setUint16(12, 0, true);
    ldv.setUint32(14, crc, true);
    ldv.setUint32(18, data.length, true);
    ldv.setUint32(22, data.length, true);
    ldv.setUint16(26, nameBytes.length, true);
    ldv.setUint16(28, 0, true);
    localHeader.set(nameBytes, 30);

    localParts.push(localHeader, data);

    // Central directory header (46 bytes + filename)
    const centralHeader = new Uint8Array(46 + nameBytes.length);
    const cdv = new DataView(centralHeader.buffer);
    cdv.setUint32(0, 0x02014b50, true);
    cdv.setUint16(4, 20, true);
    cdv.setUint16(6, 20, true);
    cdv.setUint16(8, 0x0800, true);
    cdv.setUint16(10, 0, true);
    cdv.setUint16(12, 0, true);
    cdv.setUint16(14, 0, true);
    cdv.setUint32(16, crc, true);
    cdv.setUint32(20, data.length, true);
    cdv.setUint32(24, data.length, true);
    cdv.setUint16(28, nameBytes.length, true);
    cdv.setUint16(30, 0, true);
    cdv.setUint16(32, 0, true);
    cdv.setUint16(34, 0, true);
    cdv.setUint16(36, 0, true);
    cdv.setUint32(38, 0, true);
    cdv.setUint32(42, offset, true);
    centralHeader.set(nameBytes, 46);

    centralParts.push(centralHeader);
    offset += localHeader.length + data.length;
  }

  let centralSize = 0;
  for (const part of centralParts) {
    centralSize += part.length;
  }

  const eocd = new Uint8Array(22);
  const edv = new DataView(eocd.buffer);
  edv.setUint32(0, 0x06054b50, true);
  edv.setUint16(4, 0, true);
  edv.setUint16(6, 0, true);
  edv.setUint16(8, entries.length, true);
  edv.setUint16(10, entries.length, true);
  edv.setUint32(12, centralSize, true);
  edv.setUint32(16, offset, true);
  edv.setUint16(20, 0, true);

  const totalSize = offset + centralSize + eocd.length;
  const result = new Uint8Array(totalSize);
  let cursor = 0;
  for (const p of localParts) {
    result.set(p, cursor);
    cursor += p.length;
  }
  for (const p of centralParts) {
    result.set(p, cursor);
    cursor += p.length;
  }
  result.set(eocd, cursor);

  return result;
}

export function createZipBlob(entries: ZipInputEntry[]): Blob {
  const bytes = createZipBytes(entries);
  const buffer = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength
  ) as ArrayBuffer;
  return new Blob([buffer], { type: 'application/zip' });
}

/**
 * Parses uncompressed (STORE) entries—and attempts DeflateRaw when supported—from a ZIP buffer.
 */
export async function parseZipEntries(
  buffer: ArrayBuffer
): Promise<ZipParsedEntry[]> {
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);
  const decoder = new TextDecoder();
  const entries: ZipParsedEntry[] = [];

  // Locate End of Central Directory (EOCD)
  let eocdOffset = -1;
  const minSearch = Math.max(0, bytes.length - 65558);
  for (let i = bytes.length - 22; i >= minSearch; i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocdOffset = i;
      break;
    }
  }

  if (eocdOffset < 0) {
    throw new Error('Invalid ZIP archive');
  }

  const totalEntries = view.getUint16(eocdOffset + 10, true);
  let cdOffset = view.getUint32(eocdOffset + 16, true);

  for (let idx = 0; idx < totalEntries; idx++) {
    if (cdOffset + 46 > bytes.length || view.getUint32(cdOffset, true) !== 0x02014b50) {
      break;
    }
    const method = view.getUint16(cdOffset + 10, true);
    const compSize = view.getUint32(cdOffset + 20, true);
    const nameLen = view.getUint16(cdOffset + 28, true);
    const extraLen = view.getUint16(cdOffset + 30, true);
    const commentLen = view.getUint16(cdOffset + 32, true);
    const localOffset = view.getUint32(cdOffset + 42, true);

    const name = decoder.decode(bytes.subarray(cdOffset + 46, cdOffset + 46 + nameLen));
    cdOffset += 46 + nameLen + extraLen + commentLen;

    if (name.endsWith('/') || name.startsWith('__MACOSX/')) {
      continue;
    }

    if (localOffset + 30 > bytes.length || view.getUint32(localOffset, true) !== 0x04034b50) {
      continue;
    }
    const localNameLen = view.getUint16(localOffset + 26, true);
    const localExtraLen = view.getUint16(localOffset + 28, true);
    const dataStart = localOffset + 30 + localNameLen + localExtraLen;
    const rawSlice = bytes.subarray(dataStart, dataStart + compSize);

    if (method === 0) {
      entries.push({ name, data: rawSlice.slice() });
    } else if (method === 8 && typeof DecompressionStream !== 'undefined') {
      try {
        const ds = new DecompressionStream('deflate-raw');
        const copy = new Uint8Array(rawSlice.length);
        copy.set(rawSlice);
        const stream = new Blob([copy]).stream().pipeThrough(ds);
        const decompressed = new Uint8Array(await new Response(stream).arrayBuffer());
        entries.push({ name, data: decompressed });
      } catch {
        // Skip unsupported compressed entry
      }
    }
  }

  return entries;
}

/**
 * Matches a dropped or zipped audio filename (with path/extension) to a game AudioKey.
 */
export function matchAudioFilenameToKey(filename: string): AudioKey | null {
  const base = filename.split('/').pop()?.split('\\').pop() ?? filename;
  const stem = base
    .replace(/\.[^.]+$/, '')
    .toLowerCase()
    .replace(/[\s-]+/g, '_');

  if (!stem) return null;

  // Direct key match (e.g., cruising_1, slap_sfx, hit_punchline, miss_reaction, gameover_audio)
  if (stem in AUDIO_MANIFEST) {
    return stem as AudioKey;
  }

  // Manifest filename stem match (e.g., mkb_amitabh_bachchan_fa595f97)
  for (const entry of Object.values(AUDIO_MANIFEST)) {
    const manifestStem = entry.filename.replace(/\.[^.]+$/, '').toLowerCase();
    if (stem === manifestStem) {
      return entry.key;
    }
  }

  // Friendly aliases (cruising1, cruise_3, 1..8, slap, hit, punchline, miss, gameover, lose, amitabh)
  const cruiseMatch = stem.match(/^(?:cruising|cruise|roast|line)_?([1-8])$/);
  if (cruiseMatch) {
    return `cruising_${cruiseMatch[1]}` as AudioKey;
  }
  if (/^[1-8]$/.test(stem)) {
    return `cruising_${stem}` as AudioKey;
  }
  if (stem.includes('slap') || stem.includes('sfx') || stem.includes('punch_sfx')) {
    return 'slap_sfx';
  }
  if (stem.includes('hit') || stem.includes('punchline')) {
    return 'hit_punchline';
  }
  if (stem.includes('miss') || stem.includes('whoosh')) {
    return 'miss_reaction';
  }
  if (
    stem.includes('gameover') ||
    stem.includes('game_over') ||
    stem.includes('lose') ||
    stem.includes('amitabh') ||
    stem.includes('mkb')
  ) {
    return 'gameover_audio';
  }

  return null;
}
