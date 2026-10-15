/** Build tooling only: select an App Store screenshot size without changing app UI. */
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const output = path.resolve('artifacts/appstore');
fs.mkdirSync(output, { recursive: true });
const simctl = (...args) => execFileSync('xcrun', ['simctl', ...args], { encoding: 'utf8' });
const devices = JSON.parse(simctl('list', 'devices', 'available', '--json'));
const runtimes = JSON.parse(simctl('list', 'runtimes', '--json'));
const types = JSON.parse(simctl('list', 'devicetypes', '--json'));
const preferred = [
  { name: 'iPhone 16 Pro', width: 1206, height: 2622 },
  { name: 'iPhone 15 Pro', width: 1179, height: 2556 },
  { name: 'iPhone 14 Pro', width: 1179, height: 2556 },
];
const available = Object.values(devices.devices).flat().filter(device => device.isAvailable);
let selection;
for (const candidate of preferred) {
  const existing = available.find(device => device.name === candidate.name);
  if (existing) { selection = { ...candidate, udid: existing.udid }; break; }
}
if (!selection) {
  const runtime = runtimes.runtimes
    .filter(item => item.isAvailable && item.identifier.includes('.iOS-'))
    .sort((left, right) => right.version.localeCompare(left.version, undefined, { numeric: true }))[0];
  const candidate = preferred.find(item => types.devicetypes.some(type => type.name === item.name));
  const type = candidate && types.devicetypes.find(item => item.name === candidate.name);
  if (!runtime || !candidate || !type) throw new Error('No supported App Store screenshot iPhone/runtime is installed.');
  const udid = simctl('create', 'Sahika App Store Capture', type.identifier, runtime.identifier).trim();
  selection = { ...candidate, udid, runtime: runtime.identifier };
}
fs.writeFileSync(path.join(output, 'simulator-diagnostics.json'), JSON.stringify({ selection, devices, runtimes, types }, null, 2));
fs.writeFileSync(path.join(output, 'capture-device.json'), JSON.stringify(selection, null, 2));
console.error(`Capturing ${selection.name}: expected ${selection.width}x${selection.height}`);
process.stdout.write(selection.udid);
