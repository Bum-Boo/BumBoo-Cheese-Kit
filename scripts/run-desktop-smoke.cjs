const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const assert = require('node:assert/strict');

const prefix = path.join(os.tmpdir(), 'cheesekit-desktop-smoke-');
const folder = fs.mkdtempSync(prefix);
const environment = { ...process.env, CHEESEKIT_SMOKE_USER_DATA: folder };
delete environment.ELECTRON_RUN_AS_NODE;
try {
  const result = spawnSync(require('electron'), [path.join(__dirname, 'smoke-desktop.cjs')], {
    env: environment, windowsHide: true, encoding: 'utf8', timeout: 30_000,
  });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.error) throw result.error;
  assert.equal(result.signal, null, `Smoke process ended on ${result.signal}`);
  assert.equal(result.status, 0, 'Desktop smoke test failed');
} finally {
  assert.ok(path.resolve(folder).startsWith(path.resolve(prefix)), 'Cleanup must stay in the owned temporary directory');
  fs.rmSync(folder, { recursive: true, force: true });
}
