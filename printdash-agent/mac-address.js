'use strict';

const { isIP } = require('net');
const PHYSICAL_ADDRESS_OID = '1.3.6.1.2.1.2.2.1.6';

function normalizeMacAddress(value) {
  if (Buffer.isBuffer(value)) value = value.length === 6 ? value.toString('hex') : '';
  if (typeof value !== 'string') return null;
  const text = value.trim();
  if (!/^(?:[\da-f]{12}|(?:[\da-f]{2}:){5}[\da-f]{2}|(?:[\da-f]{2}-){5}[\da-f]{2}|(?:[\da-f]{4}\.){2}[\da-f]{4})$/i.test(text)) return null;
  const hex = text.replace(/[:.-]/g, '').toUpperCase();
  if (hex === '000000000000' || (parseInt(hex.slice(0, 2), 16) & 1) !== 0) return null;
  return hex.match(/.{2}/g).join(':');
}

async function readPrinterMacAddress(ip, getOptional, walk) {
  try {
    if (isIP(ip) === 4) {
      const indexOid = `1.3.6.1.2.1.4.20.1.2.${ip}`;
      const indexes = await getOptional([indexOid]);
      const index = Number(indexes[indexOid]);
      if (Number.isSafeInteger(index) && index > 0) {
        const macOid = `${PHYSICAL_ADDRESS_OID}.${index}`;
        const values = await getOptional([macOid]);
        return normalizeMacAddress(values[macOid]);
      }
    }
    // Without an IP/interface mapping, only use an unambiguous address.
    const rows = await walk(PHYSICAL_ADDRESS_OID);
    const addresses = [...new Set(rows.map(row => normalizeMacAddress(row.value)).filter(Boolean))];
    return addresses.length === 1 ? addresses[0] : null;
  } catch {
    // Optional identity data must never turn a successful printer poll into a failure.
    return null;
  }
}

module.exports = { normalizeMacAddress, readPrinterMacAddress };
