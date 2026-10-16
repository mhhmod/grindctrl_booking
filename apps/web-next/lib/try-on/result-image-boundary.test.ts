// @vitest-environment node
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/* Phase zero item 2, the third promise: the store sees a look only when the
   shopper sends it. Today only the try-on routes, the embed and the studio
   touch a finished look, and no dashboard or Shopify admin code reads one.
   This keeps it that way, and keeps looks out of the storefront scripts that
   run in the merchant's own page, where session replay records the DOM. */

const APP_ROOT = path.resolve(__dirname, '..', '..');
const EXTENSION_ASSETS = path.resolve(APP_ROOT, '..', 'grindctrl-tryon', 'extensions', 'tryon-block', 'assets');
const LOOK_MARKERS = /resultImageUrl|result_storage_path|result_persisted_at|tryon-results/;
const ALLOWED_PREFIXES = ['app/api/try-on/', 'components/try-on/', 'lib/try-on/'];

function sourceFiles(dir: string): string[] {
  const found: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) {
      found.push(...sourceFiles(full));
    } else if (/\.(ts|tsx|js|mjs)$/.test(name) && !/\.test\.(ts|tsx)$/.test(name)) {
      found.push(full);
    }
  }
  return found;
}

describe('who can read a finished look', () => {
  it('is only the try-on routes, the embed and the studio', () => {
    const readers = ['app', 'components', 'lib']
      .flatMap((dir) => sourceFiles(path.join(APP_ROOT, dir)))
      .filter((file) => LOOK_MARKERS.test(readFileSync(file, 'utf8')))
      .map((file) => path.relative(APP_ROOT, file).split(path.sep).join('/'));

    expect(readers.length).toBeGreaterThan(0);
    expect(readers.filter((file) => !ALLOWED_PREFIXES.some((prefix) => file.startsWith(prefix)))).toEqual([]);
  });

  it('never includes the storefront scripts that run in the merchant page', () => {
    const scripts = sourceFiles(EXTENSION_ASSETS);
    expect(scripts.length).toBeGreaterThan(0);
    for (const file of scripts) {
      const source = readFileSync(file, 'utf8');
      expect(source, path.basename(file)).not.toMatch(LOOK_MARKERS);
      expect(source, path.basename(file)).not.toMatch(/data:image\//);
    }
  });
});
