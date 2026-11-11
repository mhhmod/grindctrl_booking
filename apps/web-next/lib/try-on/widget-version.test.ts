// @vitest-environment node
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';

/** The tag is the hash of exactly the bytes it caches. No manifest to forget
 * to update: editing either asset requires updating both loader tags. */
const source = (name: string) => readFileSync(`public/widget/v1/${name}.js`, 'utf8');
// Git may check out CRLF on Windows; deploys must use the same logical bytes.
function tag(...names: string[]) {
  const hash = createHash('sha256');
  for (const name of names) hash.update(source(name).replace(/\r\n/g, '\n'));
  return hash.digest('hex').slice(0, 12);
}

it('versions the hosted engine and paste adapter by their combined content', () => {
  const version = tag('tryon-engine', 'tryon-paste');
  expect(source('messenger')).toContain("name + '?v=" + version + "'");
  expect(source('tryon-woo')).toContain('tryon-engine.js?v=' + version);
});

/* The engine loads the Pick a spot chrome by its own content tag, so editing
   pick-spot.js changes the engine's bytes and therefore the tag above too. */
it('versions the Pick a spot edit chrome by its content', () => {
  expect(source('tryon-engine')).toContain("'pick-spot.js?v=" + tag('pick-spot') + "'");
});

it('versions the support runtime loaded by the stable loader', () => {
  expect(source('loader')).toContain("var RUNTIME_VERSION = '" + tag('runtime') + "'");
});
