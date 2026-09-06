'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { runCupsAdminCommand } = require('./cups-admin');

function fakeExec(results, calls) {
  return (command, args, callback) => {
    calls.push([command, args]);
    const result = results.shift();
    callback(result.error || null, result.stdout || '', result.stderr || '');
  };
}

test('runs CUPS administration directly when the service account has permission', async () => {
  const calls = [];
  await runCupsAdminCommand('/usr/sbin/lpadmin', ['-p', 'Office'], {
    execFileImpl: fakeExec([{ stdout: 'ok' }], calls),
    getuid: () => 501,
  });

  assert.deepEqual(calls, [[
    '/usr/sbin/lpadmin',
    ['-p', 'Office'],
  ]]);
});

test('falls back to restricted non-interactive sudo for container deployments', async () => {
  const calls = [];
  await runCupsAdminCommand('/usr/sbin/lpadmin', ['-p', 'Office'], {
    execFileImpl: fakeExec([
      { error: new Error('unauthorized'), stderr: 'Unauthorized' },
      { stdout: 'ok' },
    ], calls),
    getuid: () => 1000,
  });

  assert.deepEqual(calls, [
    ['/usr/sbin/lpadmin', ['-p', 'Office']],
    ['sudo', ['-n', '/usr/sbin/lpadmin', '-p', 'Office']],
  ]);
});

test('reports missing CUPS rights without exposing a sudo password prompt', async () => {
  const calls = [];
  await assert.rejects(
    runCupsAdminCommand('/usr/sbin/lpadmin', ['-p', 'Office'], {
      execFileImpl: fakeExec([
        { error: new Error('unauthorized'), stderr: 'Unauthorized' },
        { error: new Error('sudo failed'), stderr: 'sudo: a password is required' },
      ], calls),
      getuid: () => 1000,
    }),
    /account running PrintDash needs CUPS administrator access/,
  );
});
