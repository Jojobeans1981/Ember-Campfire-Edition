#!/usr/bin/env node
/**
 * Generate ElevenLabs TTS audio for every prose entry in
 * scripts/tts-inventory.json. Idempotent: entries are keyed by a content
 * hash, so re-runs only generate what's new or changed.
 *
 * Usage:
 *   node scripts/generate-tts.mjs                 # dry run (default)
 *   node scripts/generate-tts.mjs --run           # actually call the API
 *   node scripts/generate-tts.mjs --run --limit 5 # generate only 5 new clips
 *   node scripts/generate-tts.mjs --voice ID --model MODEL --run
 *
 * Requires (when --run):
 *   ELEVENLABS_API_KEY in .env
 *   ELEVENLABS_VOICE_ID in .env, or --voice CLI arg
 *   ELEVENLABS_MODEL_ID in .env (optional, defaults to eleven_multilingual_v2)
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import 'dotenv/config';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

const INVENTORY_PATH = path.join(repoRoot, 'scripts/tts-inventory.json');
const MANIFEST_PATH = path.join(repoRoot, 'src/data/tts-manifest.json');
const AUDIO_OUT_DIR = path.join(repoRoot, 'public/audio/tts');
const PUBLIC_AUDIO_PREFIX = '/audio/tts'; // served by Vite

// Multilingual v2 is the highest-quality model. Lines containing IPA
// tokens never reach this script (they're excluded by the inventory
// generator and played via public/audio/phonemes/context/ instead), so
// we no longer need a tag-honoring model here.
const DEFAULT_MODEL = 'eleven_multilingual_v2';
const API_BASE = 'https://api.elevenlabs.io/v1/text-to-speech';

// Small pause between API calls to stay polite / avoid burst rate limits.
// ElevenLabs rate limit is concurrent-request based, not per-second, but a
// short delay also smooths over transient 429s.
const REQUEST_DELAY_MS = 250;

function parseArgs(argv) {
  const args = { dryRun: true, limit: Infinity, voice: null, model: null, match: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--run') args.dryRun = false;
    else if (a === '--dry-run') args.dryRun = true;
    else if (a === '--limit') args.limit = Number(argv[++i]);
    else if (a === '--voice') args.voice = argv[++i];
    else if (a === '--model') args.model = argv[++i];
    else if (a === '--match') args.match.push(argv[++i]);
    else if (a === '--help' || a === '-h') {
      console.log(
        'Usage: node scripts/generate-tts.mjs [--run] [--limit N] [--match SUBSTR] [--voice ID] [--model ID]'
      );
      process.exit(0);
    } else {
      console.warn(`Unknown arg: ${a}`);
    }
  }
  return args;
}

function hashText(text) {
  return crypto.createHash('sha1').update(text, 'utf8').digest('hex').slice(0, 12);
}

async function readJson(file, fallback) {
  try {
    const raw = await fs.readFile(file, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    if (err.code === 'ENOENT') return fallback;
    throw err;
  }
}

async function writeJsonAtomic(file, data) {
  const tmp = `${file}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(data, null, 2) + '\n', 'utf8');
  await fs.rename(tmp, file);
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function callElevenLabs({ apiKey, voiceId, modelId, text }) {
  const url = `${API_BASE}/${voiceId}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'xi-api-key': apiKey,
      'Content-Type': 'application/json',
      accept: 'audio/mpeg',
    },
    body: JSON.stringify({
      text,
      model_id: modelId,
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.75,
        style: 0.2,
        use_speaker_boost: true,
      },
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`ElevenLabs ${res.status} ${res.statusText}: ${body.slice(0, 200)}`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  if (!buf.length) throw new Error('Empty audio response');
  return buf;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const inventory = await readJson(INVENTORY_PATH, null);
  if (!inventory) {
    console.error(`No inventory found at ${INVENTORY_PATH}. Run generate-tts-inventory.mjs first.`);
    process.exit(1);
  }

  const manifest = (await readJson(MANIFEST_PATH, null)) || {
    version: 1,
    voiceId: null,
    modelId: null,
    generatedAt: null,
    entries: {},
  };

  const voiceId = args.voice || process.env.ELEVENLABS_VOICE_ID || manifest.voiceId;
  const modelId = args.model || process.env.ELEVENLABS_MODEL_ID || manifest.modelId || DEFAULT_MODEL;
  const apiKey = process.env.ELEVENLABS_API_KEY;

  // If regenerating with a different voice/model, the cached MP3s are stale.
  const voiceChanged = manifest.voiceId && voiceId && manifest.voiceId !== voiceId;
  const modelChanged = manifest.modelId && modelId && manifest.modelId !== modelId;

  // Plan: figure out what needs to be generated before doing anything.
  const matchFilter = args.match.length
    ? (text) => args.match.some((m) => text.toLowerCase().includes(m.toLowerCase()))
    : () => true;
  const plan = [];
  for (const entry of inventory.entries) {
    if (!matchFilter(entry.text)) continue;
    const hash = hashText(entry.text);
    const existing = manifest.entries[hash];
    const file = path.join(AUDIO_OUT_DIR, `${hash}.mp3`);
    const exists = existing ? await fileExists(file) : false;
    if (existing && exists && !voiceChanged && !modelChanged) {
      continue; // already generated
    }
    plan.push({ hash, text: entry.text, sources: entry.sources, file });
    if (plan.length >= args.limit) break;
  }

  const totalInventoryChars = inventory.entries.reduce((n, e) => n + e.text.length, 0);
  const toGenerateChars = plan.reduce((n, p) => n + p.text.length, 0);

  console.log('TTS generation plan');
  console.log(`  inventory:          ${inventory.entries.length} entries (${totalInventoryChars} chars)`);
  console.log(`  already generated:  ${inventory.entries.length - plan.length}`);
  console.log(`  to generate:        ${plan.length} entries (${toGenerateChars} chars)`);
  console.log(`  voice:              ${voiceId || '(not set)'}`);
  console.log(`  model:              ${modelId}`);
  if (voiceChanged) console.log(`  !! voice changed — will regenerate everything in scope`);
  if (modelChanged) console.log(`  !! model changed — will regenerate everything in scope`);
  console.log(`  mode:               ${args.dryRun ? 'DRY RUN' : 'LIVE'}`);
  console.log('');

  if (args.dryRun) {
    console.log('Dry run complete. Pass --run to actually call the ElevenLabs API.');
    if (plan.length && plan.length <= 10) {
      console.log('\nFirst entries in plan:');
      for (const p of plan) console.log(`  [${p.hash}] ${p.text.slice(0, 80)}`);
    }
    return;
  }

  // LIVE mode — validate config
  if (!apiKey) {
    console.error('ELEVENLABS_API_KEY is not set in .env. Aborting.');
    process.exit(1);
  }
  if (!voiceId) {
    console.error('No voice ID configured. Set ELEVENLABS_VOICE_ID in .env or pass --voice. Aborting.');
    process.exit(1);
  }
  if (!plan.length) {
    console.log('Nothing to do.');
    return;
  }

  await fs.mkdir(AUDIO_OUT_DIR, { recursive: true });
  await fs.mkdir(path.dirname(MANIFEST_PATH), { recursive: true });

  let generated = 0;
  let failed = 0;
  for (const item of plan) {
    process.stdout.write(`  [${generated + failed + 1}/${plan.length}] ${item.hash} ${item.text.slice(0, 50).padEnd(50)} `);
    try {
      const buf = await callElevenLabs({ apiKey, voiceId, modelId, text: item.text });
      await fs.writeFile(item.file, buf);
      manifest.entries[item.hash] = {
        text: item.text,
        file: `${PUBLIC_AUDIO_PREFIX}/${item.hash}.mp3`,
      };
      generated++;
      process.stdout.write(`ok (${buf.length} bytes)\n`);

      // Persist incrementally so a mid-run crash doesn't lose progress.
      manifest.voiceId = voiceId;
      manifest.modelId = modelId;
      manifest.generatedAt = new Date().toISOString();
      await writeJsonAtomic(MANIFEST_PATH, manifest);
    } catch (err) {
      failed++;
      process.stdout.write(`FAIL: ${err.message}\n`);
    }
    if (REQUEST_DELAY_MS) await sleep(REQUEST_DELAY_MS);
  }

  console.log('');
  console.log(`Done. Generated ${generated}, failed ${failed}.`);
  if (failed) process.exit(2);
}

async function fileExists(p) {
  try {
    await fs.stat(p);
    return true;
  } catch {
    return false;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
