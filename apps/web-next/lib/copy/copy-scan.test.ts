// @vitest-environment node
/* The copy scan (phase zero item 32), run in CI with the unit tests: every
   string the app and the theme extension ship, in the source as written,
   has no em dash, and Arabic text uses Western digits. Comments are not
   copy, so only string literals, template text and JSX text are read. */
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { copyProblems, intlLocale, toWesternDigits } from './rules';

const WEB = path.resolve(__dirname, '../..');
const EXTENSION = path.resolve(WEB, '../grindctrl-tryon/extensions/tryon-block');
const ROOTS = [
  path.join(WEB, 'app'),
  path.join(WEB, 'components'),
  path.join(WEB, 'lib'),
  path.join(WEB, 'public/widget'),
  path.join(EXTENSION, 'assets'),
  path.join(EXTENSION, 'blocks'),
  path.join(EXTENSION, 'locales'),
];
const NOT_SHIPPED = /\.(test|spec)\.|[\\/]__tests__[\\/]|test-utils\./;
const SCRIPT = /\.(ts|tsx|js|mjs|jsx)$/;

function files(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return files(full);
    return NOT_SHIPPED.test(full) ? [] : [full];
  });
}

type Finding = string;

function scriptStrings(file: string, report: (line: number, text: string) => void) {
  const source = fs.readFileSync(file, 'utf8');
  const kind = file.endsWith('x') ? ts.ScriptKind.TSX : file.endsWith('.ts') ? ts.ScriptKind.TS : ts.ScriptKind.JS;
  const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, kind);
  const visit = (node: ts.Node) => {
    if (
      ts.isStringLiteral(node) ||
      ts.isNoSubstitutionTemplateLiteral(node) ||
      ts.isTemplateHead(node) ||
      ts.isTemplateMiddle(node) ||
      ts.isTemplateTail(node) ||
      ts.isJsxText(node)
    ) {
      report(sf.getLineAndCharacterOfPosition(node.getStart()).line + 1, node.text);
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
}

function jsonStrings(file: string, report: (line: number, text: string) => void) {
  const walk = (value: unknown) => {
    if (typeof value === 'string') report(0, value);
    else if (Array.isArray(value)) value.forEach(walk);
    else if (value && typeof value === 'object') Object.values(value).forEach(walk);
  };
  walk(JSON.parse(fs.readFileSync(file, 'utf8')));
}

/** Liquid outside its comments: the markup and the schema's settings. */
function liquidStrings(file: string, report: (line: number, text: string) => void) {
  const source = fs.readFileSync(file, 'utf8');
  const uncommented = source.replace(/\{%-?\s*comment\s*-?%\}[\s\S]*?\{%-?\s*endcomment\s*-?%\}/g, (block) =>
    block.replace(/[^\n]/g, ' '),
  );
  uncommented.split('\n').forEach((line, index) => report(index + 1, line));
}

function scan(): Finding[] {
  const findings: Finding[] = [];
  for (const file of ROOTS.flatMap(files)) {
    const report = (line: number, text: string) => {
      for (const problem of copyProblems(text)) {
        findings.push(`${path.relative(path.resolve(WEB, '..'), file)}:${line} ${problem} ${JSON.stringify(text.trim().slice(0, 80))}`);
      }
    };
    if (SCRIPT.test(file)) scriptStrings(file, report);
    else if (file.endsWith('.json')) jsonStrings(file, report);
    else if (file.endsWith('.liquid')) liquidStrings(file, report);
  }
  return findings;
}

describe('the copy scan', () => {
  it('reads the app and the theme extension', () => {
    const scanned = ROOTS.flatMap(files);
    expect(scanned.some((file) => file.endsWith(path.join('lib', 'messenger', 'config.ts')))).toBe(true);
    expect(scanned.some((file) => file.endsWith('tryon.liquid'))).toBe(true);
    expect(scanned.some((file) => file.endsWith('en.default.json'))).toBe(true);
  });

  it('finds no em dash in any shipped string, and no Eastern digit in Arabic', () => {
    expect(scan()).toEqual([]);
  });
});

describe('copy rules', () => {
  it('flags em dashes anywhere and Eastern digits only in Arabic', () => {
    expect(copyProblems('Published — live')).toEqual(['em_dash']);
    expect(copyProblems('آخر ٧ أيام')).toEqual(['eastern_digits']);
    expect(copyProblems('آخر 7 أيام')).toEqual([]);
    expect(copyProblems('Pages 1–3')).toEqual([]);
  });

  it('writes Arabic-Indic and Persian digits as Western ones', () => {
    expect(toWesternDigits('خلال ١–٣ أيام، ١٤ يوماً، ۲۵')).toBe('خلال 1–3 أيام، 14 يوماً، 25');
  });

  it('formats Arabic dates and numbers with Western digits', () => {
    expect(new Intl.NumberFormat(intlLocale('ar')).format(1250)).toMatch(/^1[,٬]?250$/);
    expect(new Intl.DateTimeFormat(intlLocale('ar'), { day: 'numeric', timeZone: 'UTC' }).format(new Date('2026-10-17T00:00:00Z'))).toBe('17');
    expect(intlLocale('en')).toBe('en-US');
  });
});
