'use strict';

const path = require('path');

const MEDIA_BY_PAPER_SIZE = {
  a4: 'a4',
  letter: 'letter',
  legal: 'legal',
  a3: 'a3',
};

const QUALITY_BY_NAME = {
  draft: 3,
  normal: 4,
  high: 5,
};

function option(args, value) {
  args.push('-o', value);
}

function buildLpArgs({
  printerName,
  fileName,
  mimeType,
  copies,
  duplex,
  printOptions,
}) {
  const args = [
    '-d',
    printerName,
    '-n',
    String(copies),
    '-t',
    path.basename(fileName),
  ];

  const sides = duplex === 'long'
    ? 'two-sided-long-edge'
    : duplex === 'short'
      ? 'two-sided-short-edge'
      : 'one-sided';
  option(args, `sides=${sides}`);

  option(args, `media=${MEDIA_BY_PAPER_SIZE[printOptions.paperSize] || 'a4'}`);

  const monochrome = printOptions.colorMode === 'grayscale';
  option(args, `print-color-mode=${monochrome ? 'monochrome' : 'color'}`);
  // PPD-backed queues commonly expose ColorModel instead of print-color-mode.
  option(args, `ColorModel=${monochrome ? 'Gray' : 'RGB'}`);

  const landscape = printOptions.orientation === 'landscape';
  option(args, `orientation-requested=${landscape ? 4 : 3}`);
  // Some legacy image filters treat the presence of this option as true,
  // regardless of a "false" value, so omit it entirely for portrait jobs.
  if (landscape) option(args, 'landscape');

  option(args, `number-up=${printOptions.pagesPerSheet}`);
  option(args, `print-quality=${QUALITY_BY_NAME[printOptions.quality] || 4}`);

  if (printOptions.pageRanges) option(args, `page-ranges=${printOptions.pageRanges}`);

  if (printOptions.scale === 'fit') {
    option(args, 'print-scaling=fit');
  } else {
    option(args, `scaling=${printOptions.scale}`);
  }

  if (/^[a-z0-9.+-]+\/[a-z0-9.+-]+$/i.test(String(mimeType || ''))) {
    option(args, `document-format=${mimeType}`);
  }
  args.push('-');
  return args;
}

module.exports = { buildLpArgs };
