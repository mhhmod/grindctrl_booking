// @vitest-environment node
/* The plugin zip the dashboard offers is committed (the production image has
   no integrations/ folder), so this is what keeps it from drifting from the
   plugin source: edit the plugin, run `npm run build:woo-plugin`. */
import fs from 'node:fs';
import path from 'node:path';
import { crc32, inflateRawSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { PLUGIN_DIR, PLUGIN_SLUG, ZIP_PATH, buildWooPluginZip } from './build-woo-plugin-zip.mjs';

/** Reads the central directory, then inflates each entry through its local header. */
function readZip(zip: Buffer) {
  const end = zip.length - 22;
  expect(zip.readUInt32LE(end)).toBe(0x06054b50);
  const count = zip.readUInt16LE(end + 10);
  let cursor = zip.readUInt32LE(end + 16);
  const entries: { name: string; method: number; crc: number; data: Buffer }[] = [];
  for (let i = 0; i < count; i++) {
    expect(zip.readUInt32LE(cursor)).toBe(0x02014b50);
    const method = zip.readUInt16LE(cursor + 10);
    const crc = zip.readUInt32LE(cursor + 16);
    const packedSize = zip.readUInt32LE(cursor + 20);
    const nameLength = zip.readUInt16LE(cursor + 28);
    const localOffset = zip.readUInt32LE(cursor + 42);
    const name = zip.toString('utf8', cursor + 46, cursor + 46 + nameLength);
    const dataStart = localOffset + 30 + zip.readUInt16LE(localOffset + 26) + zip.readUInt16LE(localOffset + 28);
    entries.push({ name, method, crc, data: inflateRawSync(zip.subarray(dataStart, dataStart + packedSize)) });
    cursor += 46 + nameLength + zip.readUInt16LE(cursor + 30) + zip.readUInt16LE(cursor + 32);
  }
  return entries;
}

describe('grindctrl-store-chat.zip', () => {
  const committed = fs.readFileSync(ZIP_PATH);

  it('is the committed build of the plugin source', () => {
    expect(buildWooPluginZip().equals(committed), 'run `npm run build:woo-plugin` and commit the zip').toBe(true);
  });

  it('holds exactly the plugin files under one top-level folder', () => {
    const sourceFiles = fs
      .readdirSync(PLUGIN_DIR, { recursive: true, withFileTypes: true })
      .filter((entry) => entry.isFile())
      .map((entry) => `${PLUGIN_SLUG}/${path.relative(PLUGIN_DIR, path.join(entry.parentPath, entry.name)).split(path.sep).join('/')}`)
      .sort();
    expect(sourceFiles).toEqual([
      'grindctrl-store-chat/grindctrl-store-chat.php',
      'grindctrl-store-chat/includes/identity.php',
      'grindctrl-store-chat/includes/orders.php',
      'grindctrl-store-chat/includes/privacy.php',
      'grindctrl-store-chat/includes/tryon.php',
      'grindctrl-store-chat/readme.txt',
      'grindctrl-store-chat/uninstall.php',
    ]);
    expect(readZip(committed).map((entry) => entry.name)).toEqual(sourceFiles);
  });

  it('carries each file as it is in the source, with correct checksums', () => {
    for (const entry of readZip(committed)) {
      const source = fs.readFileSync(path.join(PLUGIN_DIR, entry.name.slice(PLUGIN_SLUG.length + 1)), 'utf8');
      expect(entry.method).toBe(8);
      expect(entry.crc).toBe(crc32(entry.data));
      // Line endings are normalised to LF so a Windows checkout builds the same zip.
      expect(entry.data.toString('utf8')).toBe(source.replace(/\r\n/g, '\n'));
    }
  });
});
