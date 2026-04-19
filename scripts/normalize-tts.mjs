#!/usr/bin/env node
/**
 * Normalize TTS MP3s in public/audio/tts/ to match the loudness of the
 * phoneme recordings in public/audio/phonemes/. ElevenLabs output lands
 * around -26 to -28 LUFS; the phoneme clips sit at ~-16 LUFS. This runs
 * ffmpeg's single-pass loudnorm filter over each clip in place so the two
 * asset sets sound the same volume at playback.
 *
 * Usage:
 *   node scripts/normalize-tts.mjs              # dry run (default)
 *   node scripts/normalize-tts.mjs --run        # actually rewrite files
 *   node scripts/normalize-tts.mjs --run --file PATH   # one file only
 *
 * Requires ffmpeg on PATH.
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const AUDIO_DIR = path.join(repoRoot, 'public/audio/tts');

// Target picked to match the phoneme recordings (~-16 LUFS integrated),
// with -1.5 dBTP of headroom so the MP3 re-encode doesn't clip.
const TARGET = { I: -16, TP: -1.5, LRA: 11 };
const MP3_BITRATE = '128k';

function runFfmpeg(args, { captureStderr = false } = {}) {
  return new Promise((resolve, reject) => {
    const proc = spawn('ffmpeg', args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    proc.stderr.on('data', (d) => {
      stderr += d.toString();
    });
    proc.on('error', reject);
    proc.on('close', (code) => {
      if (code === 0) resolve(captureStderr ? stderr : undefined);
      else reject(new Error(`ffmpeg exited ${code}: ${stderr.trim().slice(-300)}`));
    });
  });
}

// Measure integrated loudness via loudnorm's json output, compute the flat
// gain needed to reach target, then apply volume + alimiter. Loudnorm's
// own two-pass mode refuses to exceed the TP budget even in linear mode,
// so clips with isolated peaks (common in ElevenLabs output) undershoot
// by several dB. A simple gain followed by a true-peak limiter hits the
// target reliably and the limiter is inaudible on single-voice speech.
async function measureLoudness(file) {
  const stderr = await runFfmpeg(
    [
      '-hide_banner',
      '-i', file,
      '-af', `loudnorm=I=${TARGET.I}:TP=${TARGET.TP}:LRA=${TARGET.LRA}:print_format=json`,
      '-f', 'null',
      '-',
    ],
    { captureStderr: true }
  );
  const match = stderr.match(/\{[\s\S]*?\}/);
  if (!match) throw new Error('could not find loudnorm json in ffmpeg output');
  return JSON.parse(match[0]);
}

// -1.5 dBTP as a linear amplitude for alimiter's `limit` param.
const TP_LIMIT_LINEAR = Math.pow(10, TARGET.TP / 20);

export async function normalizeFile(file) {
  const m = await measureLoudness(file);
  const inputI = Number(m.input_i);
  if (!Number.isFinite(inputI)) {
    throw new Error(`invalid input_i from loudnorm: ${m.input_i}`);
  }
  // Clamp gain to sane range so a broken measurement can't destroy a clip.
  const rawGain = TARGET.I - inputI;
  const gainDb = Math.max(-20, Math.min(30, rawGain));

  const filter = `volume=${gainDb.toFixed(2)}dB,alimiter=limit=${TP_LIMIT_LINEAR.toFixed(4)}:level=false`;

  const tmp = `${file}.norm.tmp`;
  try {
    await runFfmpeg([
      '-y',
      '-hide_banner',
      '-loglevel', 'error',
      '-i', file,
      '-af', filter,
      '-codec:a', 'libmp3lame',
      '-b:a', MP3_BITRATE,
      '-f', 'mp3',
      tmp,
    ]);
    await fs.rename(tmp, file);
  } catch (err) {
    await fs.unlink(tmp).catch(() => {});
    throw err;
  }
}

function parseArgs(argv) {
  const args = { dryRun: true, file: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--run') args.dryRun = false;
    else if (a === '--dry-run') args.dryRun = true;
    else if (a === '--file') args.file = argv[++i];
    else if (a === '--help' || a === '-h') {
      console.log('Usage: node scripts/normalize-tts.mjs [--run] [--file PATH]');
      process.exit(0);
    } else {
      console.warn(`Unknown arg: ${a}`);
    }
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  let files;
  if (args.file) {
    files = [path.resolve(args.file)];
  } else {
    const entries = await fs.readdir(AUDIO_DIR);
    files = entries
      .filter((f) => f.endsWith('.mp3'))
      .map((f) => path.join(AUDIO_DIR, f))
      .sort();
  }

  console.log('Loudness normalization plan');
  console.log(`  directory: ${AUDIO_DIR}`);
  console.log(`  files:     ${files.length}`);
  console.log(`  target:    I=${TARGET.I} LUFS, TP=${TARGET.TP} dBTP, LRA=${TARGET.LRA}`);
  console.log(`  mode:      ${args.dryRun ? 'DRY RUN' : 'LIVE'}`);
  console.log('');

  if (args.dryRun) {
    console.log('Dry run complete. Pass --run to rewrite files in place.');
    return;
  }

  let done = 0;
  let failed = 0;
  for (const full of files) {
    const name = path.basename(full);
    process.stdout.write(`  [${done + failed + 1}/${files.length}] ${name.padEnd(20)} `);
    try {
      await normalizeFile(full);
      done++;
      process.stdout.write('ok\n');
    } catch (err) {
      failed++;
      process.stdout.write(`FAIL: ${err.message}\n`);
    }
  }

  console.log('');
  console.log(`Done. Normalized ${done}, failed ${failed}.`);
  if (failed) process.exit(2);
}

const isMain = fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
