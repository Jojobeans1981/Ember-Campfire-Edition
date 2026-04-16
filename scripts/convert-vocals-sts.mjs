#!/usr/bin/env node
/**
 * Full-file speech-to-speech conversion of the phonemes-video vocals
 * track to our chosen ElevenLabs voice. STS preserves source timing, so
 * the output can be cut with the same Whisper timestamps and hand-tuned
 * overrides used for the original vocals.wav.
 *
 * Pipeline:
 *   1. Re-encode vocals.wav → 128 kbps MP3 (upload size, not quality)
 *   2. Split into chunks ≤ 300 s (ElevenLabs STS input cap) on natural
 *      silences so micro-drift is absorbed by quiet regions
 *   3. POST each chunk to ElevenLabs STS
 *   4. Concat converted chunks into one MP3
 *   5. Save under public/audio/phonemes/source/converted/<voice_id>/
 *
 * Each stage is cached — re-runs only redo what's missing unless --force.
 *
 * Usage:
 *   node scripts/convert-vocals-sts.mjs
 *   node scripts/convert-vocals-sts.mjs --voice <id>
 *   node scripts/convert-vocals-sts.mjs --force
 */

import { promises as fs } from 'node:fs';
import { existsSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import 'dotenv/config';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

const VOCALS_WAV = path.join(
  repoRoot,
  'public/audio/phonemes/source/separated/htdemucs/phonemes-video/vocals.wav'
);
const UPLOAD_MP3 = path.join(
  repoRoot,
  'public/audio/phonemes/source/vocals-upload.mp3'
);
const CONVERTED_ROOT = path.join(
  repoRoot,
  'public/audio/phonemes/source/converted'
);

const DEFAULT_MODEL = 'eleven_english_sts_v2';
const API_BASE = 'https://api.elevenlabs.io/v1/speech-to-speech';

// ElevenLabs STS caps input at 300 s. Source is ~329 s, so split into
// chunks at natural silences. 126.69 s is the midpoint of a 2.02 s gap
// after "…treasure." — determined via whisper-words.json gap analysis.
// Placing cuts inside silences absorbs any micro-drift in STS output.
const STS_MAX_SECONDS = 300;
const CHUNK_BOUNDARIES = [0, 126.69];

function parseArgs(argv) {
  const args = { voice: null, model: null, force: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--voice') args.voice = argv[++i];
    else if (a === '--model') args.model = argv[++i];
    else if (a === '--force') args.force = true;
    else if (a === '--help' || a === '-h') {
      console.log('Usage: node scripts/convert-vocals-sts.mjs [--voice ID] [--model ID] [--force]');
      process.exit(0);
    }
  }
  return args;
}

function encodeUploadMp3(force) {
  if (existsSync(UPLOAD_MP3) && !force) {
    console.log(`✓ upload MP3 cached: ${path.relative(repoRoot, UPLOAD_MP3)}`);
    return;
  }
  if (!existsSync(VOCALS_WAV)) {
    throw new Error(`source vocals.wav not found at ${VOCALS_WAV}`);
  }
  console.log('⬇  re-encoding vocals.wav → 128 kbps MP3 for upload…');
  execSync(
    `ffmpeg -y -i '${VOCALS_WAV}' -c:a libmp3lame -b:a 128k '${UPLOAD_MP3}' 2>/dev/null`
  );
}

function getAudioDurationSec(file) {
  const out = execSync(
    `ffprobe -v error -show_entries format=duration -of default=nw=1:nk=1 '${file}'`,
    { stdio: ['ignore', 'pipe', 'ignore'] }
  ).toString().trim();
  const d = Number(out);
  if (!Number.isFinite(d)) throw new Error(`ffprobe could not read duration of ${file}`);
  return d;
}

async function stsOneChunk({ apiKey, voiceId, modelId, chunkPath }) {
  const inBuf = await fs.readFile(chunkPath);
  const form = new FormData();
  form.append(
    'audio',
    new Blob([inBuf], { type: 'audio/mpeg' }),
    path.basename(chunkPath)
  );
  form.append('model_id', modelId);
  form.append(
    'voice_settings',
    JSON.stringify({
      stability: 0.5,
      similarity_boost: 0.85,
      style: 0.0,
      use_speaker_boost: true,
    })
  );

  const res = await fetch(`${API_BASE}/${voiceId}`, {
    method: 'POST',
    headers: { 'xi-api-key': apiKey, accept: 'audio/mpeg' },
    body: form,
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`ElevenLabs ${res.status} ${res.statusText}: ${body.slice(0, 500)}`);
  }
  const outBuf = Buffer.from(await res.arrayBuffer());
  if (!outBuf.length) throw new Error('empty STS response body');
  return outBuf;
}

async function runSts({ apiKey, voiceId, modelId, outPath }) {
  const totalDuration = getAudioDurationSec(UPLOAD_MP3);
  const boundaries = [...CHUNK_BOUNDARIES, totalDuration];

  console.log(`🎙  STS → ${voiceId}  (${boundaries.length - 1} chunks, model ${modelId})`);

  for (let i = 0; i < boundaries.length - 1; i++) {
    const len = boundaries[i + 1] - boundaries[i];
    if (len > STS_MAX_SECONDS) {
      throw new Error(
        `chunk ${i} is ${len.toFixed(1)}s, exceeds ${STS_MAX_SECONDS}s cap — adjust CHUNK_BOUNDARIES`
      );
    }
  }

  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sts-convert-'));
  const convertedChunks = [];
  try {
    for (let i = 0; i < boundaries.length - 1; i++) {
      const start = boundaries[i];
      const end = boundaries[i + 1];
      const chunkPath = path.join(tmpDir, `chunk-${i}.mp3`);
      execSync(
        `ffmpeg -y -ss ${start.toFixed(3)} -to ${end.toFixed(3)} -i '${UPLOAD_MP3}' -c copy '${chunkPath}' 2>/dev/null`
      );
      const chunkSize = (await fs.stat(chunkPath)).size;
      console.log(
        `  chunk ${i}  ${start.toFixed(2)}-${end.toFixed(2)}s  (${(chunkSize / 1024 / 1024).toFixed(2)} MB) → STS…`
      );
      const outBuf = await stsOneChunk({ apiKey, voiceId, modelId, chunkPath });
      const convertedPath = path.join(tmpDir, `converted-${i}.mp3`);
      await fs.writeFile(convertedPath, outBuf);
      convertedChunks.push(convertedPath);
      console.log(`    ✓ ${(outBuf.length / 1024 / 1024).toFixed(2)} MB back`);
    }

    const listPath = path.join(tmpDir, 'concat-list.txt');
    await fs.writeFile(
      listPath,
      convertedChunks.map((p) => `file '${p}'`).join('\n') + '\n',
      'utf8'
    );
    await fs.mkdir(path.dirname(outPath), { recursive: true });
    execSync(
      `ffmpeg -y -f concat -safe 0 -i '${listPath}' -c copy '${outPath}' 2>/dev/null`
    );
    const outSize = (await fs.stat(outPath)).size;
    const outDuration = getAudioDurationSec(outPath);
    console.log(
      `✓ wrote ${path.relative(repoRoot, outPath)} (${(outSize / 1024 / 1024).toFixed(2)} MB, ${outDuration.toFixed(2)}s)`
    );
    if (Math.abs(outDuration - totalDuration) > 1.0) {
      console.warn(
        `  ⚠ duration drift: source ${totalDuration.toFixed(2)}s, converted ${outDuration.toFixed(2)}s`
      );
      console.warn('    phoneme cuts may be misaligned — listen and re-tune if needed.');
    }
  } finally {
    try {
      for (const f of await fs.readdir(tmpDir)) await fs.unlink(path.join(tmpDir, f));
      await fs.rmdir(tmpDir);
    } catch {}
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const apiKey = process.env.ELEVENLABS_API_KEY;
  const voiceId = args.voice || process.env.ELEVENLABS_VOICE_ID;
  const modelId = args.model || DEFAULT_MODEL;

  if (!apiKey) {
    console.error('ELEVENLABS_API_KEY missing from .env.');
    process.exit(1);
  }
  if (!voiceId) {
    console.error('No voice ID (.env ELEVENLABS_VOICE_ID or --voice).');
    process.exit(1);
  }

  encodeUploadMp3(args.force);

  const outPath = path.join(CONVERTED_ROOT, voiceId, 'vocals.mp3');
  if (existsSync(outPath) && !args.force) {
    console.log(`✓ converted vocals already exist: ${path.relative(repoRoot, outPath)}`);
    console.log('  pass --force to regenerate.');
    console.log('');
    console.log('Next step:');
    console.log(`  node scripts/extract-phonemes-from-video.mjs \\`);
    console.log(`    --source-audio '${path.relative(repoRoot, outPath)}' \\`);
    console.log(`    --output-dir public/audio/phonemes/jasmine`);
    return;
  }

  await runSts({ apiKey, voiceId, modelId, outPath });

  console.log('');
  console.log('Next step — cut per-phoneme clips with the existing hand-tuned overrides:');
  console.log(`  node scripts/extract-phonemes-from-video.mjs \\`);
  console.log(`    --source-audio '${path.relative(repoRoot, outPath)}' \\`);
  console.log(`    --output-dir public/audio/phonemes/jasmine`);
}

main().catch((err) => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
