/** Capture only actual simulator pixels. No fake messages, screens, or AI requests. */
const { execFileSync, spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const output = path.resolve('artifacts/appstore');
const selection = JSON.parse(fs.readFileSync(path.join(output, 'capture-device.json'), 'utf8'));
const products = path.resolve('ios/build/Build/Products');
const appPaths = fs.readdirSync(products, { withFileTypes: true })
  .filter(entry => entry.isDirectory() && entry.name.endsWith('simulator'))
  .flatMap(entry => fs.readdirSync(path.join(products, entry.name), { withFileTypes: true })
    .filter(app => app.isDirectory() && app.name.endsWith('.app'))
    .map(app => path.join(products, entry.name, app.name)));
if (appPaths.length !== 1) throw new Error(`Expected one simulator app, found ${appPaths.length}.`);
const simctl = (...args) => execFileSync('xcrun', ['simctl', ...args], { stdio: 'inherit' });

async function recordPreview() {
  const video = path.join(output, 'Sahika_AppPreview_Raw_20s.mp4');
  const log = fs.openSync(path.join(output, 'recording.log'), 'w');
  const recorder = spawn('xcrun', ['simctl', 'io', selection.udid, 'recordVideo', '--codec', 'h264', '--mask', 'ignored', video], { stdio: ['ignore', log, log] });
  let stop;
  let hardStop;
  try {
    const recording = new Promise((resolve, reject) => {
      recorder.once('error', reject);
      recorder.once('close', (code, signal) => {
        if ((code === 0 || code === 130 || signal === 'SIGINT') && fs.existsSync(video) && fs.statSync(video).size > 0) resolve();
        else reject(new Error(`Recording failed: exit ${code}, signal ${signal}.`));
      });
      stop = setTimeout(() => recorder.kill('SIGINT'), 20_000);
      hardStop = setTimeout(() => { recorder.kill('SIGKILL'); reject(new Error('Simulator recording did not stop.')); }, 35_000);
    });
    const preview = new Promise((resolve, reject) => {
      const flow = spawn('maestro', ['test', '--test-output-dir', path.join(output, 'preview-maestro'), '.maestro/appstore-preview.yml'], { stdio: 'inherit' });
      flow.once('error', reject);
      flow.once('close', code => code === 0 ? resolve() : reject(new Error(`Preview mode changes failed: exit ${code}.`)));
    });
    const results = await Promise.allSettled([recording, preview]);
    const failures = results.filter(result => result.status === 'rejected').map(result => result.reason);
    if (failures.length) throw new AggregateError(failures, 'Recording or preview navigation failed.');
  } finally {
    clearTimeout(stop);
    clearTimeout(hardStop);
    if (recorder.exitCode === null && recorder.signalCode === null) recorder.kill('SIGINT');
    fs.closeSync(log);
  }
}

async function capture() {
  const failures = [];
  try {
    simctl('install', selection.udid, appPaths[0]);
    simctl('status_bar', selection.udid, 'override', '--time', '9:41');
    try {
      execFileSync('maestro', ['test', '--test-output-dir', path.join(output, 'maestro'), '.maestro/appstore-capture.yml'], { stdio: 'inherit' });
    } catch (error) {
      failures.push(`Screenshots: ${error.message}`);
      console.error('Screenshot flow failed; continuing with actual screen recording and diagnostic pixels.');
    }
    try { await recordPreview(); }
    catch (error) { failures.push(`Preview: ${error.message}`); }
  } finally {
    try { simctl('io', selection.udid, 'screenshot', path.join(output, '99-final-state-diagnostic.png')); }
    catch (error) { failures.push(`Diagnostic screenshot: ${error.message}`); }
    fs.writeFileSync(path.join(output, 'capture-manifest.json'), JSON.stringify({
      bundleIdentifier: 'com.pulsevet.sahika',
      device: selection,
      appPath: appPaths[0],
      sourceArchiveUrl: 'https://expo.dev/artifacts/eas/bmMUO6LUBPshQFdGb_zrbDT5eU10ggKx1HKo6Pw_HQI.tar.gz',
      capturedAt: new Date().toISOString(),
      video: 'Sahika_AppPreview_Raw_20s.mp4',
      rawVideoRequiresAppStoreEncoding: true,
      failures,
      notes: 'Actual simulator screenshots and a 20-second recording switching between voice and text modes. No message sent and no voice session started. Diagnostic pixels may show a failure and require visual review.',
    }, null, 2));
  }
  if (failures.length) throw new Error(failures.join('\n'));
}

capture().catch(error => { console.error(error); process.exitCode = 1; });
