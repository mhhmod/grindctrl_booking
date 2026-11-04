/* Builds public/downloads/grindctrl-store-chat.zip from
   integrations/woocommerce/grindctrl-store-chat, so the dashboard can offer
   the WordPress plugin as a download. The production image only contains
   apps/web-next, which is why the zip is committed rather than built there.

   The archive is deterministic: sorted entries, a fixed DOS timestamp, fixed
   attributes and line endings normalised to LF (a Windows checkout turns the
   sources into CRLF; git stores LF). scripts/build-woo-plugin-zip.test.ts
   fails when the committed zip no longer matches this builder's output.

   Usage, from apps/web-next:  npm run build:woo-plugin
*/

import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { crc32, deflateRawSync } from 'node:zlib';

const HERE = path.dirname(fileURLToPath(import.meta.url));

export const PLUGIN_SLUG = 'grindctrl-store-chat';
export const PLUGIN_DIR = path.resolve(HERE, '../../../integrations/woocommerce', PLUGIN_SLUG);
export const ZIP_PATH = path.resolve(HERE, '../public/downloads', `${PLUGIN_SLUG}.zip`);

const TEXT_FILE = /\.(php|txt|md|css|js|json|pot)$/i;
// 1980-01-01 00:00:00, the earliest time a zip can carry.
const DOS_TIME = 0;
const DOS_DATE = (1 << 5) | 1;
// Unix regular file, 0644.
const EXTERNAL_ATTRIBUTES = (0o100644 << 16) >>> 0;

/** The plugin's files as zip entries under `grindctrl-store-chat/`, sorted by name. */
export function readPluginSources(dir = PLUGIN_DIR) {
  return readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => {
      const full = path.join(entry.parentPath, entry.name);
      const raw = readFileSync(full);
      const data = TEXT_FILE.test(entry.name) ? Buffer.from(raw.toString('utf8').replace(/\r\n/g, '\n'), 'utf8') : raw;
      return { name: `${PLUGIN_SLUG}/${path.relative(dir, full).split(path.sep).join('/')}`, data };
    })
    .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
}

/** @param {{ name: string, data: Buffer }[]} entries already sorted */
export function buildZip(entries) {
  const locals = [];
  const centrals = [];
  let offset = 0;

  for (const { name, data } of entries) {
    const nameBytes = Buffer.from(name, 'utf8');
    const packed = deflateRawSync(data, { level: 9 });
    const crc = crc32(data);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4); // version needed
    local.writeUInt16LE(0x0800, 6); // names are UTF-8
    local.writeUInt16LE(8, 8); // deflate
    local.writeUInt16LE(DOS_TIME, 10);
    local.writeUInt16LE(DOS_DATE, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(packed.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBytes.length, 26);
    locals.push(local, nameBytes, packed);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE((3 << 8) | 20, 4); // made by: Unix, 2.0
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(8, 10);
    central.writeUInt16LE(DOS_TIME, 12);
    central.writeUInt16LE(DOS_DATE, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(packed.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBytes.length, 28);
    central.writeUInt32LE(EXTERNAL_ATTRIBUTES, 38);
    central.writeUInt32LE(offset, 42);
    centrals.push(central, nameBytes);

    offset += local.length + nameBytes.length + packed.length;
  }

  const directory = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);

  return Buffer.concat([...locals, directory, end]);
}

export function buildWooPluginZip(dir = PLUGIN_DIR) {
  return buildZip(readPluginSources(dir));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const zip = buildWooPluginZip();
  mkdirSync(path.dirname(ZIP_PATH), { recursive: true });
  writeFileSync(ZIP_PATH, zip);
  console.log(`${path.relative(process.cwd(), ZIP_PATH)}: ${zip.length} bytes`);
}
