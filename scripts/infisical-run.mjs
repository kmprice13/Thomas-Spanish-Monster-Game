/**
 * Fetches secrets from Infisical using machine identity, then runs generate-audio.mjs.
 *
 * Usage:
 *   INFISICAL_CLIENT_ID=... INFISICAL_CLIENT_SECRET=... node scripts/infisical-run.mjs
 *
 * Optional:
 *   INFISICAL_PROJECT_ID=...  (auto-discovered if you only have one project)
 *   INFISICAL_ENV=prod        (defaults to prod)
 */
import { spawn } from 'child_process';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const DOMAIN       = 'https://secrets.tfp.pizza';
const CLIENT_ID     = process.env.INFISICAL_CLIENT_ID;
const CLIENT_SECRET = process.env.INFISICAL_CLIENT_SECRET;
const ENV_SLUG      = process.env.INFISICAL_ENV ?? 'prod';

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('Set INFISICAL_CLIENT_ID and INFISICAL_CLIENT_SECRET before running.');
  process.exit(1);
}

// ── 1. Authenticate ───────────────────────────────────────────────────────────
const authRes = await fetch(`${DOMAIN}/api/v1/auth/universal-auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ clientId: CLIENT_ID, clientSecret: CLIENT_SECRET }),
});
if (!authRes.ok) {
  console.error('Infisical auth failed:', await authRes.text());
  process.exit(1);
}
const { accessToken } = await authRes.json();
console.log('✓ Authenticated with Infisical');

// ── 2. Resolve project ID ─────────────────────────────────────────────────────
let projectId = process.env.INFISICAL_PROJECT_ID ?? null;

if (!projectId) {
  const wsRes = await fetch(`${DOMAIN}/api/v2/workspace`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (wsRes.ok) {
    const { workspaces = [] } = await wsRes.json();
    if (workspaces.length === 1) {
      projectId = workspaces[0].id;
      console.log(`✓ Project: ${workspaces[0].name} (${projectId})`);
    } else if (workspaces.length > 1) {
      console.log('Multiple projects found — set INFISICAL_PROJECT_ID to one of:');
      for (const ws of workspaces) console.log(`  ${ws.id}  ${ws.name}`);
      process.exit(1);
    }
  }
}

if (!projectId) {
  console.error('Could not determine project ID. Set INFISICAL_PROJECT_ID=...');
  process.exit(1);
}

// ── 3. Fetch secrets ──────────────────────────────────────────────────────────
const secRes = await fetch(
  `${DOMAIN}/api/v3/secrets/raw?workspaceId=${projectId}&environment=${ENV_SLUG}&secretPath=/`,
  { headers: { Authorization: `Bearer ${accessToken}` } },
);
if (!secRes.ok) {
  console.error('Failed to fetch secrets:', await secRes.text());
  process.exit(1);
}
const { secrets = [] } = await secRes.json();

const env = { ...process.env };
for (const s of secrets) env[s.secretKey] = s.secretValue;

const needed = ['ELEVENLABS_API_KEY', 'ELEVENLABS_VOICE_ID'];
const missing = needed.filter(k => !env[k]);
if (missing.length) {
  console.error(`Missing secrets in Infisical: ${missing.join(', ')}`);
  console.error('Make sure these are stored in the project under the prod environment.');
  process.exit(1);
}
console.log(`✓ Fetched ${secrets.length} secrets — ${needed.join(', ')} found`);

// ── 4. Run generate-audio.mjs with secrets injected ──────────────────────────
const child = spawn('node', [join(__dirname, 'generate-audio.mjs')], {
  env,
  stdio: 'inherit',
});
child.on('exit', code => process.exit(code ?? 0));
