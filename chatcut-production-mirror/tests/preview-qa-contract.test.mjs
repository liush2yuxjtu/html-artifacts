import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const source = fs.readFileSync(new URL('../scripts/preview-qa.cjs', import.meta.url), 'utf8');

test('preview QA supports Vercel automation bypass and trusted OIDC', () => {
  assert.match(source, /VERCEL_AUTOMATION_BYPASS_SECRET/);
  assert.match(source, /x-vercel-protection-bypass/);
  assert.match(source, /x-vercel-set-bypass-cookie/);
  assert.match(source, /VERCEL_TRUSTED_OIDC_TOKEN/);
  assert.match(source, /x-vercel-trusted-oidc-idp-token/);
});

test('preview QA exercises required acceptance routes and one visible interaction', () => {
  assert.match(source, /'\/intent\.html'/);
  assert.match(source, /'\/features\/ai-motion-graphics'/);
  assert.match(source, /Apply editing prompt/);
  assert.match(source, /ccDemoSession/);
  assert.match(source, /mobile homepage/);
});

test('preview QA fails closed on Vercel auth and 404 states', () => {
  assert.match(source, /vercel\\\.com\\\/login/);
  assert.match(source, /Log in to Vercel/);
  assert.match(source, /404\\s\+NOT_FOUND/);
  assert.match(source, /pageErrors\.length === 0/);
  assert.match(source, /consoleErrors\.length === 0/);
});
