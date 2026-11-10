// @vitest-environment node
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';

/** The tag is the hash of exactly the bytes it caches. No manifest to forget
 * to update: editing either asset requires updating both loader tags. */
it('versions the hosted engine and paste adapter by their combined content', () => {
  const source = (name: string) => readFileSync(`public/widget/v1/${name}.js`, 'utf8');
  // Git may check out CRLF on Windows; deploys must use the same logical bytes.
  const hash = createHash('sha256');
  for (const name of ['tryon-engine', 'tryon-paste']) hash.update(source(name).replace(/\r\n/g, '\n'));
  const version = hash.digest('hex').slice(0, 12);
  expect(source('messenger')).toContain("name + '?v=" + version + "'");
  expect(source('tryon-woo')).toContain('tryon-engine.js?v=' + version);
});
