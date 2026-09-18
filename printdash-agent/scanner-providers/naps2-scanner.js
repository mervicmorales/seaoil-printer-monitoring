const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { generatedScanPath, validateScanFile } = require('./scan-output');

const MAX_DIAGNOSTIC_BYTES = 32 * 1024;
const DEFAULT_TIMEOUT_MS = 180000;

function resolveNaps2Command(options = {}) {
  const platform = options.platform || process.platform;
  const override = options.override || process.env.NAPS2_CONSOLE_PATH;
  if (override) {
    if (!path.isAbsolute(override) || /[\r\n\0]/.test(override)) throw new Error('NAPS2_CONSOLE_PATH must be an absolute path without control characters.');
    return { command: override, prefixArgs: [] };
  }
  if (platform === 'win32') return { command: 'C:\\Program Files\\NAPS2\\NAPS2.Console.exe', prefixArgs: [] };
  if (platform === 'darwin') return { command: '/Applications/NAPS2.app/Contents/MacOS/NAPS2', prefixArgs: ['console'] };
  return null;
}

function buildScanArgs(mapping, outputPath, scanOptions = {}) {
  const source = scanOptions.source === 'adf-duplex' ? 'duplex' : scanOptions.source === 'adf' ? 'feeder' : 'glass';
  const dpi = Number.isInteger(scanOptions.dpi) && scanOptions.dpi >= 75 && scanOptions.dpi <= 1200 ? scanOptions.dpi : 300;
  return [
    '--noprofile', '--driver', mapping.driver, '--device', mapping.device,
    '--source', source, '--dpi', String(dpi), '--bitdepth', 'color',
    '--pagesize', 'a4', '--output', outputPath, '--force',
  ];
}

function buildListArgs(driver) {
  return ['--noprofile', '--listdevices', '--driver', driver];
}

function parseDeviceList(output) {
  return String(output || '').split(/\r?\n/).map((line) => line.trim()).filter((line) => line && !/^devices?:?$/i.test(line));
}

function safeDiagnostic(value) {
  return String(value || '')
    .replace(/(password|token|secret|authorization)\s*[:=]\s*\S+/gi, '$1=[redacted]')
    .slice(0, MAX_DIAGNOSTIC_BYTES);
}

function runProcess(command, args, options = {}) {
  const spawnProcess = options.spawn || spawn;
  const timeoutMs = options.timeoutMs || DEFAULT_TIMEOUT_MS;
  const activeProcesses = options.activeProcesses || new Set();
  return new Promise((resolve, reject) => {
    let stdout = '';
    let stderr = '';
    let settled = false;
    let timer = null;
    const child = spawnProcess(command, args, { shell: false, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    activeProcesses.add(child);
    const finish = (error, result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      activeProcesses.delete(child);
      if (error) reject(error); else resolve(result);
    };
    child.stdout?.on('data', (chunk) => { stdout = (stdout + chunk).slice(-MAX_DIAGNOSTIC_BYTES); });
    child.stderr?.on('data', (chunk) => { stderr = (stderr + chunk).slice(-MAX_DIAGNOSTIC_BYTES); });
    child.once('error', (error) => finish(error));
    child.once('close', (code, signal) => {
      if (code === 0) return finish(null, { stdout, stderr, code, signal });
      const detail = safeDiagnostic(stderr || stdout || `exit code ${code}`);
      finish(new Error(`NAPS2 command failed: ${detail}`));
    });
    timer = setTimeout(() => {
      try { child.kill(); } catch {}
      finish(new Error(`NAPS2 command timed out after ${timeoutMs}ms.`));
    }, timeoutMs);
    timer.unref?.();
  });
}

function createNaps2Provider(options = {}) {
  const platform = options.platform || process.platform;
  const commandInfo = resolveNaps2Command({ platform, override: options.consolePath });
  const fileSystem = options.fs || fs;
  const activeProcesses = new Set();
  const busyDevices = new Set();
  const run = (args, processOptions = {}) => runProcess(commandInfo.command, [...commandInfo.prefixArgs, ...args], {
    spawn: options.spawn,
    timeoutMs: processOptions.timeoutMs || options.timeoutMs,
    activeProcesses,
  });

  return {
    id: 'naps2',
    supported: Boolean(commandInfo),
    command: commandInfo?.command || null,
    async diagnostics(drivers = []) {
      if (!commandInfo) return { available: false, reason: 'NAPS2 is not supported on this platform.' };
      const available = await fileSystem.promises.access(commandInfo.command, fs.constants.X_OK).then(() => true, () => false);
      const devices = {};
      let version = null;
      if (available) {
        try { version = safeDiagnostic((await run(['--version'], { timeoutMs: 10000 })).stdout).trim() || null; }
        catch {}
        for (const driver of drivers) {
          try { devices[driver] = parseDeviceList((await run(buildListArgs(driver), { timeoutMs: 30000 })).stdout); }
          catch (error) { devices[driver] = { error: safeDiagnostic(error.message) }; }
        }
      }
      return { available, command: commandInfo.command, version, devices };
    },
    async scan(mapping, scanOptions = {}) {
      const deviceKey = `${mapping.driver}:${mapping.device}`;
      if (busyDevices.has(deviceKey)) throw new Error('The selected scanner is already processing a scan.');
      busyDevices.add(deviceKey);
      const outputPath = generatedScanPath(options.scanDirectory, '.pdf');
      try {
        await run(buildScanArgs(mapping, outputPath, scanOptions));
        return await validateScanFile(outputPath, options.scanDirectory, { maxBytes: options.maxBytes });
      } catch (error) {
        try { await fileSystem.promises.unlink(outputPath); } catch {}
        throw error;
      } finally {
        busyDevices.delete(deviceKey);
      }
    },
    async shutdown() {
      for (const child of activeProcesses) {
        try { child.kill(); } catch {}
      }
      activeProcesses.clear();
    },
    async cancelActiveScans() {
      for (const child of activeProcesses) {
        try { child.kill(); } catch {}
      }
    },
  };
}

module.exports = {
  buildListArgs,
  buildScanArgs,
  createNaps2Provider,
  parseDeviceList,
  resolveNaps2Command,
  runProcess,
  safeDiagnostic,
};
