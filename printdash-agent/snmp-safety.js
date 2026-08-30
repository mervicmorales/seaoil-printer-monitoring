'use strict';

function safeError(error) {
  const rawMessage = error && typeof error.message === 'string' ? error.message : 'Unknown SNMP error';
  return {
    name: error && typeof error.name === 'string' ? error.name : 'UnknownError',
    message: rawMessage.replace(/[\r\n\t]/g, ' ').replace(/community\s*[=:]\s*\S+/ig, 'community=[redacted]').slice(0, 300),
  };
}

function attachSnmpSessionErrorHandler(session, context, onError, logger = console.warn) {
  session.on('error', error => {
    const safe = safeError(error);
    logger(`[SNMP] Poll failed printer=${context.printerIdentifier || 'unknown'} ip=${context.ip} operation=${context.operation} error=${safe.name} message=${safe.message}`);
    onError(error);
  });
}

async function isolatePrinterPoll(poll, printer, onFailure) {
  try {
    return await poll(printer);
  } catch (error) {
    return onFailure(printer, error);
  }
}

module.exports = { attachSnmpSessionErrorHandler, isolatePrinterPoll, safeError };
