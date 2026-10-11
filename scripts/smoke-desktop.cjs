const { app, BrowserWindow } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..');
const main = path.join(root, 'apps/desktop/dist/main/main.js');
const source = fs.readFileSync(main, 'utf8');
const cutoff = source.indexOf('import_electron.app.whenReady()');
assert.ok(cutoff > 0, 'Built startup boundary must be recognized');
const exported = { exports: {} };
vm.runInNewContext(source.slice(0, cutoff) + '\nmodule.exports = { registerIpc, AppService };', {
  require: createRequire(main), module: exported, exports: exported.exports,
  __dirname: path.dirname(main), process, console, setInterval, clearInterval, setTimeout, clearTimeout,
}, { filename: main });
assert.ok(process.env.CHEESEKIT_SMOKE_USER_DATA, 'Use the owned smoke-test launcher');
app.setPath('userData', process.env.CHEESEKIT_SMOKE_USER_DATA);
app.commandLine.appendSwitch('disable-gpu');

app.whenReady().then(async () => {
  let window;
  const service = new exported.exports.AppService();
  let externalAttempts = 0;
  const rendererErrors = [];
  try {
    exported.exports.registerIpc(service);
    await service.start();
    window = new BrowserWindow({ show: false, webPreferences: {
      preload: path.join(root, 'apps/desktop/dist/main/preload.js'),
      nodeIntegration: false, contextIsolation: true, sandbox: true,
    } });
    window.webContents.session.webRequest.onBeforeRequest((details, callback) => {
      const external = /^https?:/i.test(details.url);
      if (external) externalAttempts += 1;
      callback({ cancel: external });
    });
    window.webContents.on('console-message', (event) => {
      if (event.level === 'error') rendererErrors.push(event.message);
    });
    await window.loadFile(path.join(root, 'apps/desktop/dist/renderer/index.html'));
    const invoke = (expression) => window.webContents.executeJavaScript(expression);
    assert.equal(await invoke('typeof window.cheeseKit.getSnapshot'), 'function');
    const first = await invoke('window.cheeseKit.getSnapshot()');
    assert.equal(first.appStatus, 'ready');
    assert.equal(first.connection.status, 'connected');
    assert.equal((await invoke('window.cheeseKit.setManzaiEnabled(true)')).activeToolCount, 1);
    const stopped = await invoke('window.cheeseKit.emergencyStop()');
    assert.equal(stopped.queue.paused, true);
    assert.equal(stopped.queue.emergencyStopped, true);
    assert.equal(stopped.activeToolCount, 0);
    const resumed = await invoke('window.cheeseKit.resumeAfterEmergency()');
    assert.equal(resumed.queue.emergencyStopped, false);
    assert.equal(resumed.queue.paused, false);
    assert.ok(await invoke('document.getElementById("root").textContent.length > 0'));
    assert.equal(externalAttempts, 0);
    assert.deepEqual(rendererErrors, []);
    console.log(JSON.stringify({ electron: process.versions.electron, assertions: 12,
      production: ['compiled IPC registration', 'AppService', 'sandboxed preload', 'built renderer'],
      hiddenWindow: true, externalAttempts, rendererErrors,
      limits: 'Standalone harness does not execute production main startup or before-quit hooks.' }));
  } finally {
    await service.shutdown();
    window?.destroy();
    app.quit();
  }
}).catch(error => { console.error(error); app.exit(1); });
