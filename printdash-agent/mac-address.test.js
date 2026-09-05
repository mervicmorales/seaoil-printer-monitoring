'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeMacAddress, readPrinterMacAddress } = require('./mac-address');

test('normalizes supported MAC formats and rejects unusable addresses', () => {
  for (const value of ['00:1a:2b:3c:4d:5e', '00-1A-2B-3C-4D-5E', '001a.2b3c.4d5e', '001a2b3c4d5e', Buffer.from('001a2b3c4d5e', 'hex')]) {
    assert.equal(normalizeMacAddress(value), '00:1A:2B:3C:4D:5E');
  }
  for (const value of [null, '', 'unknown', '00:00:00:00:00:00', 'FF:FF:FF:FF:FF:FF', '01:00:5E:00:00:01', '00:11-22:33:44:55', Buffer.alloc(0)]) assert.equal(normalizeMacAddress(value), null);
});

test('uses the interface associated with the printer IP, not interface 1', async () => {
  const requested = [];
  const result = await readPrinterMacAddress('192.0.2.10', async ([oid]) => {
    requested.push(oid);
    return { [oid]: requested.length === 1 ? 7 : Buffer.from('001a2b3c4d5e', 'hex') };
  }, async () => { throw new Error('Unexpected walk'); });
  assert.equal(result, '00:1A:2B:3C:4D:5E');
  assert.deepEqual(requested, ['1.3.6.1.2.1.4.20.1.2.192.0.2.10', '1.3.6.1.2.1.2.2.1.6.7']);
});

test('falls back only to an unambiguous interface MAC', async () => {
  const get = async () => ({});
  assert.equal(await readPrinterMacAddress('192.0.2.10', get, async () => [{value: ''}, {value: '00:1A:2B:3C:4D:5E'}]), '00:1A:2B:3C:4D:5E');
  assert.equal(await readPrinterMacAddress('192.0.2.10', get, async () => [{value: '00:1A:2B:3C:4D:5E'}, {value: '00:1A:2B:3C:4D:60'}]), null);
  assert.equal(await readPrinterMacAddress('192.0.2.10', get, async () => []), null);
});

test('SNMP failures leave optional MAC unknown', async () => {
  assert.equal(await readPrinterMacAddress('192.0.2.10', async () => { throw new Error('Timeout'); }, async () => []), null);
});
