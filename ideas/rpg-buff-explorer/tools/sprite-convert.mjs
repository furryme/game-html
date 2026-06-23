#!/usr/bin/env node
/**
 * sprite-convert.mjs - Convert high-res images to pixel sprite sheets.
 *
 * Pipeline per image:
 *   1. Read high-res PNG (any size, recommended 256x256 - 1024x1024)
 *   2. If multi-frame (wider than target), split into equal frames
 *   3. Resize each frame to target size with nearest-neighbor (no blur)
 *   4. Stitch frames into a sprite sheet PNG
 *
 * Requires: npm install (installs sharp)
 */

import sharp from 'sharp';
import { readFileSync, existsSync, mkdirSync } from 'fs';
import { writeFile } from 'fs/promises';
import { join, basename, dirname, resolve } from 'path';
import { parseArgs } from 'util';

// ---------------------------------------------------------------------------
// CLI parsing
// ---------------------------------------------------------------------------

function parseArgsFromCli() {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      input:     { type: 'string' },
      output:    { type: 'string' },
      manifest:  { type: 'string' },
      size:      { type: 'string' },
      frames:    { type: 'string' },
      help:      { type: 'boolean', short: 'h' },
    },
    strict: false,
    allowPositionals: true,
  });

  if (values.help) {
    printUsage();
    process.exit(0);
  }

  return values;
}

function printUsage() {
  console.log([
    'Usage:',
    '  node sprite-convert.mjs --input <dir|file> --output <dir> --manifest <manifest.json>',
    '  node sprite-convert.mjs --input <file> --output <file> --size <WxH> [--frames N]',
    '',
    'Options:',
    '  --input       Input directory (with --manifest) or single PNG file',
    '  --output      Output directory (batch) or output file path (single)',
    '  --manifest    Path to manifest.json (batch mode)',
    '  --size        Target frame size WxH, e.g. 32x48 (single-file mode)',
    '  --frames      Number of frames to split into (single-file, optional)',
    '  -h, --help    Show this help',
    '',
    'Examples:',
    '  # Batch convert from manifest',
    '  node sprite-convert.mjs --input ./art/ \\',
    '    --output ../js/data/sprite-assets/high-res/ \\',
    '    --manifest ../js/data/sprite-assets/manifest.json',
    '',
    '  # Single file',
    '  node sprite-convert.mjs --input ./art/warrior-idle.png \\',
    '    --output ../js/data/sprite-assets/high-res/player-warrior.png \\',
    '    --size 32x48',
  ].join('\n'));
}

// ---------------------------------------------------------------------------
// Sharp helpers
// ---------------------------------------------------------------------------

/**
 * Resize an image to target size using nearest-neighbor interpolation.
 * Returns sharp PNG buffer.
 */
async function resizeToPng(inputPath, frameW, frameH) {
  return await sharp(inputPath)
    .resize(frameW, frameH, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
      kernel: 'nearest',
    })
    .png({ compressionLevel: 9 })
    .toBuffer();
}

/**
 * Extract one frame and resize it. Returns sharp PNG of one frame.
 * sourceFrameW = width of one frame in the source image.
 */
async function extractAndResizeFrame(srcPath, sourceFrameW, sourceH, frameW, frameH, index) {
  return await sharp(srcPath)
    .extract({ left: index * sourceFrameW, top: 0, width: sourceFrameW, height: sourceH })
    .resize(frameW, frameH, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
      kernel: 'nearest',
    })
    .raw()
    .toBuffer();
}

/**
 * Count total animation frames from a manifest entry.
 */
function countTotalFrames(meta) {
  if (!meta.animations && !meta.combatAnimations) return 0;
  const all = { ...(meta.animations || {}), ...(meta.combatAnimations || {}) };
  let total = 0;
  for (const anim of Object.values(all)) {
    if (anim && Array.isArray(anim.frames)) {
      total += anim.frames.length;
    }
  }
  return total;
}

// ---------------------------------------------------------------------------
// Single image convert
// ---------------------------------------------------------------------------

/**
 * Convert a single high-res PNG to a pixel sprite PNG at target size.
 */
async function convertSprite(srcPath, frameW, frameH, outputPath) {
  const info = await sharp(srcPath).metadata();
  console.log(`  [resize] ${basename(srcPath)} ${info.width}x${info.height} -> ${frameW}x${frameH} (nearest)`);

  const pngBuffer = await resizeToPng(srcPath, frameW, frameH);
  mkdirSync(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, pngBuffer);

  return { file: basename(outputPath), frames: 1, frameW, frameH };
}

// ---------------------------------------------------------------------------
// Sprite sheet (multi-frame) convert
// ---------------------------------------------------------------------------

/**
 * Convert a multi-frame high-res PNG to a sprite sheet.
 * Source image is split into frameCount equal-width frames,
 * each resized to frameW x frameH, then stitched horizontally.
 */
async function convertSpriteSheet(srcPath, frameW, frameH, frameCount, outputPath) {
  const info = await sharp(srcPath).metadata();
  const sourceW = info.width;
  const sourceH = info.height;
  const sourceFrameW = Math.floor(sourceW / frameCount);

  console.log(`  [sheet]  ${basename(srcPath)} ${sourceW}x${sourceH}`);
  console.log(`    -> ${frameCount} frames x ${frameW}x${frameH} (src frame: ${sourceFrameW}x${sourceH})`);

  // Extract and resize each frame to raw RGBA
  const frameBuffers = [];
  for (let i = 0; i < frameCount; i++) {
    const raw = await extractAndResizeFrame(srcPath, sourceFrameW, sourceH, frameW, frameH, i);
    frameBuffers.push(raw);
  }

  // Stitch frames horizontally into one sprite sheet
  const combined = Buffer.concat(frameBuffers);
  const totalW = frameCount * frameW;

  const pngBuffer = await sharp(combined, {
    raw: { width: totalW, height: frameH, channels: 4 },
  })
    .png({ compressionLevel: 9 })
    .toBuffer();

  mkdirSync(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, pngBuffer);

  return { file: basename(outputPath), frames: frameCount, frameW, frameH };
}

// ---------------------------------------------------------------------------
// Batch mode
// ---------------------------------------------------------------------------

async function batchConvert(inputDir, outputDir, manifest) {
  const stats = { done: 0, errors: 0, results: [] };

  for (const [name, meta] of Object.entries(manifest)) {
    const srcFile = join(inputDir, meta.src);

    if (!existsSync(srcFile)) {
      console.warn(`  [skip] ${name}: source not found at ${srcFile}`);
      stats.errors++;
      continue;
    }

    try {
      const frameW = meta.frameW;
      const frameH = meta.frameH;
      const totalFrames = countTotalFrames(meta);
      const outFile = join(outputDir, meta.src);

      let result;
      if (totalFrames > 1) {
        result = await convertSpriteSheet(srcFile, frameW, frameH, totalFrames, outFile);
      } else {
        result = await convertSprite(srcFile, frameW, frameH, outFile);
      }

      stats.done++;
      stats.results.push({ name, ...result });
    } catch (err) {
      console.error(`  [error] ${name}: ${err.message}`);
      stats.errors++;
    }
  }

  return stats;
}

// ---------------------------------------------------------------------------
// Single-file mode
// ---------------------------------------------------------------------------

async function singleConvert(inputFile, outputFile, size, frameCount) {
  const [frameW, frameH] = size.split('x').map(Number);

  if (!frameW || !frameH || frameW <= 0 || frameH <= 0) {
    console.error(`Invalid size: ${size}. Expected WxH (e.g. 32x48)`);
    process.exit(1);
  }

  if (!existsSync(inputFile)) {
    console.error(`Input not found: ${inputFile}`);
    process.exit(1);
  }

  const info = await sharp(inputFile).metadata();
  console.log(`  [info] ${basename(inputFile)} ${info.width}x${info.height}`);

  let fc = frameCount || 1;
  if (!frameCount && info.width > frameW) {
    console.log(`  [warn] source is wider than target -- use --frames N to split into frames`);
  }
  fc = Math.max(1, fc);

  if (fc > 1) {
    return await convertSpriteSheet(inputFile, frameW, frameH, fc, outputFile);
  } else {
    return await convertSprite(inputFile, frameW, frameH, outputFile);
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const args = parseArgsFromCli();

  if (!args.input || !args.output) {
    console.error('Error: --input and --output are required.');
    console.log('');
    printUsage();
    process.exit(1);
  }

  const inputResolved = resolve(args.input);
  const outputResolved = resolve(args.output);

  if (args.manifest) {
    // ---- Batch mode ----
    const manifestPath = resolve(args.manifest);
    if (!existsSync(manifestPath)) {
      console.error(`Manifest not found: ${manifestPath}`);
      process.exit(1);
    }

    const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
    console.log(`Batch convert: ${Object.keys(manifest).length} sprites`);
    console.log(`  input:    ${inputResolved}`);
    console.log(`  output:   ${outputResolved}`);
    console.log(`  manifest: ${manifestPath}`);
    console.log('');

    const stats = await batchConvert(inputResolved, outputResolved, manifest);

    console.log('');
    console.log(`Done: ${stats.done} converted, ${stats.errors} error${stats.errors !== 1 ? 's' : ''}`);
    if (stats.errors > 0) {
      process.exit(1);
    }
  } else {
    // ---- Single file mode ----
    if (!args.size) {
      console.error('Error: --size is required for single-file mode (e.g. 32x48).');
      process.exit(1);
    }

    const frameCount = args.frames ? parseInt(args.frames, 10) : 0;
    const result = await singleConvert(inputResolved, outputResolved, args.size, frameCount);
    console.log(`Done: ${result.file} (${result.frames} frame${result.frames > 1 ? 's' : ''})`);
  }
}

main().catch(err => {
  console.error(`Fatal: ${err.message}`);
  process.exit(1);
});
