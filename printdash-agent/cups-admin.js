'use strict';

const { execFile } = require('child_process');

function commandError(error, stderr) {
  const message = String(stderr || error?.message || 'CUPS command failed').trim();
  const wrapped = new Error(message);
  wrapped.cause = error;
  return wrapped;
}

function execute(execFileImpl, command, args) {
  return new Promise((resolve, reject) => {
    execFileImpl(command, args, (error, stdout, stderr) => {
      if (error) return reject(commandError(error, stderr));
      resolve({ stdout, stderr });
    });
  });
}

async function runCupsAdminCommand(command, args, options = {}) {
  const execFileImpl = options.execFileImpl || execFile;
  const getuid = options.getuid === undefined ? process.getuid : options.getuid;

  try {
    return await execute(execFileImpl, command, args);
  } catch (directError) {
    // Root cannot gain any additional CUPS permissions through sudo. Preserve
    // the useful CUPS error instead of replacing it with a sudo error.
    if (typeof getuid === 'function' && getuid() === 0) throw directError;

    try {
      return await execute(execFileImpl, 'sudo', ['-n', command, ...args]);
    } catch (sudoError) {
      if (/password is required|a password is required/i.test(sudoError.message)) {
        throw new Error(
          `${directError.message}. The account running PrintDash needs CUPS administrator access`,
        );
      }
      throw sudoError;
    }
  }
}

module.exports = { runCupsAdminCommand };
