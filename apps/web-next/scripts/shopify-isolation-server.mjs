// Local browser fixture only. Never run against merchant credentials.
import { cpSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
if (process.env.GC_SHOPIFY_MULTI_APP_TEST !== '1'
  || process.env.SHOPIFY_API_KEY || process.env.SHOPIFY_API_SECRET
  || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.OPENROUTER_API_KEY || process.env.GROQ_API_KEY) {
  throw new Error('Dedicated credential-free Shopify test configuration required');
}
const standalone = resolve('.next/standalone');
cpSync('public', resolve(standalone, 'public'), { recursive: true });
cpSync('.next/static', resolve(standalone, '.next/static'), { recursive: true });
await import(pathToFileURL(resolve(standalone, 'server.js')).href);
