#!/usr/bin/env node
/* shopify-account — list and switch the Shopify CLI's active account.
 *
 * The CLI has no `auth switch` (gh does). Its only documented way to change
 * account is `auth login`, and the worry that it drops the other session is
 * what this exists to avoid: the CLI already stores every account it has
 * logged into, side by side, and `currentSessionId` merely points at one.
 * Switching is therefore a pointer change, and nothing is signed out.
 *
 * Symptom this fixes:
 *   "You are not a member of the requested organization" (HTTP 403)
 * from any `shopify app ...` command, when the active account is simply a
 * different one of yours than the app's org belongs to.
 *
 *   node scripts/shopify-account.mjs            # list
 *   node scripts/shopify-account.mjs <email>    # switch (prefix match)
 *
 * Writes a timestamped .bak next to the config before changing anything.
 */

import { readFileSync, writeFileSync, copyFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir, platform } from 'node:os';

/* conf (which the CLI uses) picks its base directory per platform. */
function configDir(pkg) {
  const home = homedir();
  if (platform() === 'win32') return join(process.env.APPDATA ?? join(home, 'AppData', 'Roaming'), pkg, 'Config');
  if (platform() === 'darwin') return join(home, 'Library', 'Preferences', pkg);
  return join(process.env.XDG_CONFIG_HOME ?? join(home, '.config'), pkg);
}

const SESSION_FILE = join(configDir('shopify-cli-kit-nodejs'), 'config.json');
const ACCOUNT_FILE = join(configDir('shopify-app-account-info-nodejs'), 'config.json');

function readJson(path, fallback = null) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return fallback;
  }
}

const store = readJson(SESSION_FILE);
if (!store?.sessionStore) {
  console.error(`No Shopify CLI session found at ${SESSION_FILE}\nRun \`shopify auth login\` once first.`);
  process.exit(1);
}

// Keyed by identity FQDN (accounts.shopify.com), then by account uuid.
const byFqdn = JSON.parse(store.sessionStore);
const sessions = Object.values(byFqdn).flatMap((accounts) => Object.keys(accounts));
const accountInfo = readJson(ACCOUNT_FILE, {}) ?? {};

// Emails only; the tokens in sessionStore are never read or printed.
const emailOf = (uuid) => accountInfo[uuid]?.info?.email ?? '(unknown email)';

const wanted = process.argv[2];
if (!wanted) {
  console.log('Shopify CLI accounts (* = active):\n');
  for (const uuid of sessions) {
    console.log(`  ${uuid === store.currentSessionId ? '*' : ' '} ${emailOf(uuid).padEnd(28)} ${uuid}`);
  }
  console.log('\nSwitch with: node scripts/shopify-account.mjs <email>');
  process.exit(0);
}

const needle = wanted.toLowerCase();
const matches = sessions.filter(
  (uuid) => emailOf(uuid).toLowerCase().startsWith(needle) || uuid.startsWith(needle),
);
if (matches.length !== 1) {
  console.error(
    matches.length === 0
      ? `No stored account matches "${wanted}". Run without arguments to list them.`
      : `"${wanted}" matches ${matches.length} accounts; be more specific.`,
  );
  process.exit(1);
}

const [target] = matches;
if (target === store.currentSessionId) {
  console.log(`Already active: ${emailOf(target)}`);
  process.exit(0);
}

const backup = `${SESSION_FILE}.bak-${Date.now()}`;
copyFileSync(SESSION_FILE, backup);
store.currentSessionId = target;
writeFileSync(SESSION_FILE, JSON.stringify(store), 'utf8');

console.log(`Switched to ${emailOf(target)}`);
console.log(`Still signed in: ${sessions.map(emailOf).join(', ')}`);
console.log(`Backup: ${backup}`);
