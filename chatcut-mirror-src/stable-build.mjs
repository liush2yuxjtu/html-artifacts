import { spawnSync } from 'node:child_process';

const attempts = 8;
const retryable = /(?:fetch failed|asset fetch failed)\s+(?:404|408|409|410|425|429|5\d\d)|ECONN|ETIMEDOUT|socket|network|fetch failed/i;

function run(script) {
  const result = spawnSync(process.execPath, [script], {
    encoding: 'utf8',
    env: { ...process.env, CHATCUT_MIRROR_ATTEMPT: String(currentAttempt) },
  });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.status !== 0) {
    const combined = `${result.stdout || ''}\n${result.stderr || ''}`;
    const error = new Error(`${script} failed with exit code ${result.status}`);
    error.output = combined;
    throw error;
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

let currentAttempt = 0;
let lastError = null;
for (currentAttempt = 1; currentAttempt <= attempts; currentAttempt += 1) {
  try {
    console.log(`\n[stable-build] snapshot attempt ${currentAttempt}/${attempts}`);
    run('chatcut-mirror-src/build.mjs');
    run('chatcut-mirror-src/localize-runtime.mjs');
    console.log(`[stable-build] consistent production snapshot captured on attempt ${currentAttempt}`);
    lastError = null;
    break;
  } catch (error) {
    lastError = error;
    const output = `${error?.message || error}\n${error?.output || ''}`;
    const canRetry = retryable.test(output) && currentAttempt < attempts;
    if (!canRetry) throw error;
    const delay = Math.min(14000, 1500 + currentAttempt * 1750);
    console.warn(`[stable-build] production assets changed during capture; retrying from fresh HTML in ${delay}ms`);
    await sleep(delay);
  }
}

if (lastError) throw lastError;
