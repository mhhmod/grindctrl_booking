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
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { crc32, deflateRawSync } from 'node:zlib';

const HERE = path.dirname(fileURLToPath(import.meta.url));

export const PLUGIN_SLUG = 'grindctrl-store-chat';
export const PLUGIN_DIR = path.resolve(HERE, '../../../integrations/woocommerce', PLUGIN_SLUG);
export const ZIP_PATH = path.resolve(HERE, '../public/downloads', `${PLUGIN_SLUG}.zip`);
export const RELEASE_PATH = path.resolve(HERE, '../lib/woo/plugin-release.ts');

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

const escapeHtml = (text) => text.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);

/** Read public release fields from the same sources that go into the archive. */
export function pluginRelease(zip, dir = PLUGIN_DIR, date = new Date()) {
  const header = readFileSync(path.join(dir, `${PLUGIN_SLUG}.php`), 'utf8');
  const readme = readFileSync(path.join(dir, 'readme.txt'), 'utf8').replace(/\r\n/g, '\n');
  const field = (source, name) => {
    const value = new RegExp(`^\\s*(?:\\*\\s*)?${name}:\\s*(\\S+)`, 'm').exec(source)?.[1];
    if (!value) throw new Error(`Missing plugin release field: ${name}`);
    return value;
  };
  const version = field(header, 'Version');
  const changelog = readme.split(/^== Changelog ==\s*$/m)[1]?.split(/^== /m)[0]?.trim();
  if (!changelog || !changelog.includes(`= ${version} =`)) throw new Error('Missing current plugin changelog');
  const changelogHtml = changelog.split('\n').filter((line) => line.trim()).map((line) => {
    const heading = /^= (.+) =$/.exec(line);
    return heading ? `<h4>${escapeHtml(heading[1])}</h4>` : `<p>${escapeHtml(line.replace(/^\* /, ''))}</p>`;
  }).join('\n');
  return {
    version,
    package: `https://grindctrl.cloud/downloads/${PLUGIN_SLUG}.zip?v=${version}`,
    sha256: createHash('sha256').update(zip).digest('hex'),
    requires: field(header, 'Requires at least'),
    requires_php: field(header, 'Requires PHP'),
    tested: field(readme, 'Tested up to'),
    wc_tested: field(header, 'WC tested up to'),
    last_updated: date.toISOString().slice(0, 10),
    homepage: field(header, 'Plugin URI'),
    changelog_html: changelogHtml,
  };
}

export function writeWooPluginRelease({ dir = PLUGIN_DIR, zipPath = ZIP_PATH, releasePath = RELEASE_PATH, date = new Date() } = {}) {
  const zip = buildWooPluginZip(dir);
  const release = pluginRelease(zip, dir, date);
  mkdirSync(path.dirname(zipPath), { recursive: true });
  mkdirSync(path.dirname(releasePath), { recursive: true });
  writeFileSync(zipPath, zip);
  writeFileSync(releasePath, `// Generated by scripts/build-woo-plugin-zip.mjs. Rebuild after editing the plugin.\nexport const WOO_PLUGIN_RELEASE = ${JSON.stringify(release, null, 2)} as const;\n`);
  return { zip, release };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { zip } = writeWooPluginRelease();
  console.log(`${path.relative(process.cwd(), ZIP_PATH)}: ${zip.length} bytes; ${path.relative(process.cwd(), RELEASE_PATH)}`);
}
