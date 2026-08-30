'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { attachSnmpSessionErrorHandler, isolatePrinterPoll } = require('./snmp-safety');

test('a malformed-response session error is handled without becoming an uncaught error', () => {
  const session = new EventEmitter();
  const logs = [];
  let failures = 0;
  attachSnmpSessionErrorHandler(session, { printerIdentifier: 'Printer 7', ip: '192.0.2.7', operation: 'get sysDescr' }, () => { failures += 1; }, message => logs.push(message));
  assert.doesNotThrow(() => session.emit('error', Object.assign(new Error('Zero-length integer'), { name: 'InvalidAsn1Error' })));
  assert.equal(failures, 1);
  assert.match(logs[0], /Printer 7/);
  assert.match(logs[0], /192\.0\.2\.7/);
  assert.match(logs[0], /InvalidAsn1Error/);
  assert.doesNotMatch(logs[0], /community/i);
});

test('one rejected printer poll does not prevent remaining printer results', async () => {
  const printers = [{ id: 1 }, { id: 2 }];
  const results = await Promise.all(printers.map(printer => isolatePrinterPoll(
    async current => {
      if (current.id === 1) throw Object.assign(new Error('Zero-length integer'), { name: 'InvalidAsn1Error' });
      return { id: current.id, online: true };
    },
    printer,
    (current, error) => ({ id: current.id, online: false, error: error.name }),
  )));
  assert.deepEqual(results, [
    { id: 1, online: false, error: 'InvalidAsn1Error' },
    { id: 2, online: true },
  ]);
});
