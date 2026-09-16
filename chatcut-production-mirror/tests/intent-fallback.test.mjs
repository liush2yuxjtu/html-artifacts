import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

test('mirror build guarantees intent.html even when the source artifact is omitted from deployment input', async () => {
  const source = await fs.readFile(new URL('../scripts/mirror.mjs', import.meta.url), 'utf8');
  assert.match(source, /FALLBACK_INTENT_HTML/);
  assert.match(source, /if \(!copiedIntent\) await writeText\('intent\.html', FALLBACK_INTENT_HTML\)/);
});
