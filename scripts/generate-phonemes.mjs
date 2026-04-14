#!/usr/bin/env node
/**
 * Generate phoneme audio files using OpenAI TTS.
 *
 * Usage:
 *   OPENAI_API_KEY=sk-... node scripts/generate-phonemes.mjs
 *
 * Options:
 *   --all        Regenerate all phonemes (default: only missing ones)
 *   --voice      OpenAI voice to use (default: shimmer)
 *   --phoneme X  Generate a single phoneme
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const AUDIO_DIR = path.join(__dirname, '..', 'public', 'audio', 'phonemes');

// All 44 English phonemes used in Orton-Gillingham instruction.
// Single letters use their letter as the filename; digraphs/vowel teams use
// their common spelling (e.g. sh.mp3, oo_long.mp3).
const PHONEME_ORDER = [
  // --- Consonants (single letters) ---
  's', 'a', 'm', 't', 'p', 'n', 'i', 'c',
  'b', 'f', 'l', 'o', 'h', 'd', 'g', 'e',
  'r', 'u', 'k', 'w', 'j', 'y', 'x', 'q', 'z', 'v',
  // --- Consonant digraphs / extras ---
  'sh',   // /ʃ/  ship
  'ch',   // /tʃ/ chip
  'th',   // /θ/  think (unvoiced)
  'th_v', // /ð/  this (voiced)
  'ng',   // /ŋ/  ring
  'zh',   // /ʒ/  measure
  'wh',   // /ʍ/  when
  // --- Short vowels (already covered by single letters above) ---
  // a=cat, e=bed, i=sit, o=hot, u=cup
  // --- Long vowels ---
  'long_a', // /eɪ/ cake
  'long_e', // /iː/ feet
  'long_i', // /aɪ/ kite
  'long_o', // /oʊ/ home
  'long_u', // /juː/ cute
  // --- R-controlled vowels ---
  'ar',  // /ɑːr/ car
  'er',  // /ɜːr/ her, bird, fur
  'or',  // /ɔːr/ for
  // --- Diphthongs & other vowels ---
  'oi',      // /ɔɪ/ oil, boy
  'ow',      // /aʊ/ cow, out
  'oo_long', // /uː/ moon
  'oo_short',// /ʊ/  book
  'aw',      // /ɔː/ law, all
];

// Prompts tuned for isolated phoneme sounds a child would hear in an OG lesson.
const PHONEME_PROMPTS = {
  // --- Single-letter consonants ---
  s: 'sss',
  m: 'mmm',
  t: 'tuh',
  p: 'puh',
  n: 'nnn',
  c: 'kuh',
  b: 'buh',
  f: 'fff',
  l: 'lll',
  h: 'huh',
  d: 'duh',
  g: 'guh',
  r: 'rrr',
  k: 'kuh',
  w: 'wuh',
  j: 'juh',
  y: 'yuh',
  x: 'ks',
  q: 'kwuh',
  z: 'zzz',
  v: 'vvv',
  // --- Short vowels ---
  a: 'aah',
  e: 'eh',
  i: 'ih',
  o: 'ahh',
  u: 'uh',
  // --- Consonant digraphs ---
  sh: 'shh',
  ch: 'chuh',
  th: 'thhh',
  th_v: 'thuh',
  ng: 'nng',
  zh: 'zhuh',
  wh: 'whuh',
  // --- Long vowels ---
  long_a: 'ay',
  long_e: 'ee',
  long_i: 'eye',
  long_o: 'oh',
  long_u: 'you',
  // --- R-controlled vowels ---
  ar: 'ar',
  er: 'er',
  or: 'or',
  // --- Diphthongs & other vowels ---
  oi: 'oy',
  ow: 'ow',
  oo_long: 'ooo',
  oo_short: 'ookh',
  aw: 'aww',
};

// --- CLI args ---
const args = process.argv.slice(2);
const regenerateAll = args.includes('--all');
const voiceIdx = args.indexOf('--voice');
const voice = voiceIdx !== -1 ? args[voiceIdx + 1] : 'shimmer';
const singleIdx = args.indexOf('--phoneme');
const singlePhoneme = singleIdx !== -1 ? args[singleIdx + 1] : null;

config({ path: path.join(__dirname, '..', '.env') });

const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey || apiKey === 'your-key-here') {
  console.error('Error: Set OPENAI_API_KEY in .env');
  process.exit(1);
}

async function generatePhoneme(phoneme) {
  const prompt = PHONEME_PROMPTS[phoneme];
  if (!prompt) {
    console.warn(`  ⚠ No prompt defined for "${phoneme}", skipping.`);
    return false;
  }

  const res = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'tts-1-hd',
      input: prompt,
      voice,
      response_format: 'mp3',
      speed: 0.85,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error(`  ✗ Failed for "${phoneme}": ${res.status} ${err}`);
    return false;
  }

  const buffer = Buffer.from(await res.arrayBuffer());
  const outPath = path.join(AUDIO_DIR, `${phoneme}.mp3`);
  fs.writeFileSync(outPath, buffer);
  console.log(`  ✓ ${phoneme}.mp3 (${(buffer.length / 1024).toFixed(1)} KB)`);
  return true;
}

async function main() {
  fs.mkdirSync(AUDIO_DIR, { recursive: true });

  const phonemes = singlePhoneme ? [singlePhoneme] : PHONEME_ORDER;
  const toGenerate = regenerateAll
    ? phonemes
    : phonemes.filter((p) => !fs.existsSync(path.join(AUDIO_DIR, `${p}.mp3`)));

  if (toGenerate.length === 0) {
    console.log('All phoneme audio files already exist. Use --all to regenerate.');
    return;
  }

  console.log(`Generating ${toGenerate.length} phoneme(s) with voice "${voice}"...\n`);

  let success = 0;
  let fail = 0;

  for (const phoneme of toGenerate) {
    const ok = await generatePhoneme(phoneme);
    if (ok) success++;
    else fail++;
    // Small delay to respect rate limits
    await new Promise((r) => setTimeout(r, 250));
  }

  console.log(`\nDone: ${success} generated, ${fail} failed.`);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
