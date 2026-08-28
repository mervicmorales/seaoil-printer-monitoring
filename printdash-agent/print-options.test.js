'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { buildLpArgs } = require('./print-options');

function optionsFrom(args) {
  const options = [];
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === '-o') options.push(args[index + 1]);
  }
  return options;
}

function argsFor(overrides = {}) {
  return buildLpArgs({
    printerName: 'Office_Printer',
    fileName: '../portrait photo.jpg',
    mimeType: 'image/jpeg',
    copies: 2,
    duplex: 'none',
    printOptions: {
      pageRanges: null,
      colorMode: 'color',
      paperSize: 'a4',
      orientation: 'portrait',
      pagesPerSheet: 1,
      quality: 'normal',
      scale: 'fit',
      ...overrides.printOptions,
    },
    ...overrides,
  });
}

test('maps copies, color, paper, portrait, quality, scale, and MIME type', () => {
  const args = argsFor();
  const options = optionsFrom(args);
  assert.deepEqual(args.slice(0, 6), ['-d', 'Office_Printer', '-n', '2', '-t', 'portrait photo.jpg']);
  assert.ok(options.includes('sides=one-sided'));
  assert.ok(options.includes('media=a4'));
  assert.ok(options.includes('print-color-mode=color'));
  assert.ok(options.includes('ColorModel=RGB'));
  assert.ok(options.includes('orientation-requested=3'));
  assert.ok(!options.some((value) => value.startsWith('landscape')));
  assert.ok(options.includes('number-up=1'));
  assert.ok(options.includes('print-quality=4'));
  assert.ok(options.includes('print-scaling=fit'));
  assert.ok(!options.includes('fit-to-page'));
  assert.ok(options.includes('document-format=image/jpeg'));
  assert.equal(args.at(-1), '-');
});

test('maps custom pages, grayscale, duplex, landscape, pages per sheet, and percent scale', () => {
  const options = optionsFrom(argsFor({
    duplex: 'short',
    printOptions: {
      pageRanges: '1-3,5',
      colorMode: 'grayscale',
      paperSize: 'legal',
      orientation: 'landscape',
      pagesPerSheet: 4,
      quality: 'high',
      scale: '75',
    },
  }));
  assert.ok(options.includes('page-ranges=1-3,5'));
  assert.ok(options.includes('print-color-mode=monochrome'));
  assert.ok(options.includes('ColorModel=Gray'));
  assert.ok(options.includes('media=legal'));
  assert.ok(options.includes('sides=two-sided-short-edge'));
  assert.ok(options.includes('orientation-requested=4'));
  assert.ok(options.includes('landscape'));
  assert.ok(options.includes('number-up=4'));
  assert.ok(options.includes('print-quality=5'));
  assert.ok(options.includes('scaling=75'));
});

test('maps long-edge duplex, alternate paper sizes, and draft quality', () => {
  const options = optionsFrom(argsFor({
    duplex: 'long',
    printOptions: {
      paperSize: 'a3',
      quality: 'draft',
      scale: '100',
    },
  }));
  assert.ok(options.includes('sides=two-sided-long-edge'));
  assert.ok(options.includes('media=a3'));
  assert.ok(options.includes('print-quality=3'));
  assert.ok(options.includes('scaling=100'));
});
