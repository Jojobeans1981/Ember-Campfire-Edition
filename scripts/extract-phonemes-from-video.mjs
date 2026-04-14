#!/usr/bin/env node
/**
 * Extract phoneme audio from a YouTube video teaching the 44 English phonemes.
 *
 * Pipeline:
 *   1. yt-dlp      → download audio from YouTube
 *   2. demucs      → isolate instructor's voice (remove background music)
 *   3. Whisper API → word-level timestamps on the clean vocal track
 *   4. ffmpeg      → slice each phoneme utterance and normalize loudness
 *
 * Each stage is cached — re-running only redoes what's missing.
 *
 * Usage:
 *   node scripts/extract-phonemes-from-video.mjs
 *   node scripts/extract-phonemes-from-video.mjs --force-whisper
 *   node scripts/extract-phonemes-from-video.mjs --dry-run
 *   node scripts/extract-phonemes-from-video.mjs --phoneme r   (extract just one)
 */

import fs from 'fs';
import path from 'path';
import { execSync, spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import { config } from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
config({ path: path.join(ROOT, '.env') });

// ─── Paths ────────────────────────────────────────────────────
const SOURCE_DIR  = path.join(ROOT, 'public', 'audio', 'phonemes', 'source');
const OUTPUT_DIR  = path.join(ROOT, 'public', 'audio', 'phonemes');
const CONTEXT_DIR = path.join(OUTPUT_DIR, 'context');
const VIDEO_URL   = 'https://www.youtube.com/watch?v=wBuA589kfMg';
const AUDIO_WAV   = path.join(SOURCE_DIR, 'phonemes-video.wav');
const VOCALS_WAV  = path.join(SOURCE_DIR, 'separated', 'htdemucs', 'phonemes-video', 'vocals.wav');
const WHISPER_CACHE = path.join(SOURCE_DIR, 'whisper-words.json');

// ─── Sequence of phonemes IN THE ORDER the video presents them ──
// Each entry maps to our output filename (null = skip this utterance).
// The video introduces Q and X via narration (not the "X as in Y" pattern),
// and includes "air"/"ear" R-controlled vowels we don't use.
const VIDEO_SEQUENCE = [
  // Consonants
  'b', 'd', 'f', 'g', 'h', 'j', 'k', 'l', 'm', 'n', 'ng', 'p', 'r',
  's', 'zh', 't', 'v', 'w', 'y', 'z',
  // Digraphs
  'ch', 'sh', 'th_v', 'th',
  // Short vowels
  'a', 'e', 'i', 'o', 'u',
  // Long vowels + others
  'long_a', 'aw', 'long_e', 'long_i', 'long_o', 'long_u',
  'oo_long', 'oo_short', 'ow', 'oi',
  // R-controlled (skip "air" / "ear" — not in our set)
  'ar', 'er', null, null, 'or',
];

// Phonemes we want. Anything in VIDEO_SEQUENCE that's not null will be exported.
const TARGET_PHONEMES = new Set(VIDEO_SEQUENCE.filter(Boolean));

// ─── Per-phoneme padding tuning ───────────────────────────────
// Continuants (/s/ /m/ /f/ …) extend naturally — pad the END more so we
// don't cut them off early. Stops (/t/ /p/ /k/) are brief — less padding.
// Defaults apply if not listed.
const PADDING = {
  default:  { pre: 0.08, post: 0.20 },   // 80 ms before, 200 ms after
  stops:    { pre: 0.06, post: 0.12 },
  longish:  { pre: 0.08, post: 0.35 },
};
const STOP_PHONEMES      = new Set(['p', 't', 'k', 'b', 'd', 'g']);
const LONGISH_PHONEMES   = new Set([
  's','m','n','f','l','r','z','v','sh','th','th_v','ng','zh',
  'long_a','long_e','long_i','long_o','long_u','ar','er','or','oi','ow','aw','oo_long','oo_short',
]);

function getPadding(phoneme) {
  if (STOP_PHONEMES.has(phoneme))    return PADDING.stops;
  if (LONGISH_PHONEMES.has(phoneme)) return PADDING.longish;
  return PADDING.default;
}

// ─── Per-phoneme isolated-clip overrides ─────────────────────
// Applied ONLY to the isolated phoneme-only clip, not the context clip.
// Used when Whisper's token boundaries don't match the actual phoneme sound.
//   startDelta: shift start (negative = earlier)
//   endDelta:   shift end   (negative = earlier; positive extends into "as")
const PHONEME_OVERRIDES = {
  ar:     { startDelta: -0.15 },                    // beginning was cut off
  aw:     { endDelta:   +0.20 },                    // tail was cut off
  long_i: { endDelta:   -0.25 },                    // too long, hit "as in"
  ng:     { startDelta: -0.10, endDelta: +0.05 },   // needed more on both ends
  oi:     { endDelta:   -0.20 },                    // too long, hit "as"
};

// ─── Per-phoneme context clip overrides ──────────────────────
// Whisper's word boundaries aren't always accurate for example phrases.
// These deltas (in seconds) are applied AFTER normal computation to tune
// clips that sounded too short or too long during review.
//   startDelta: shift context start (negative = earlier)
//   endDelta:   shift context end   (negative = earlier)
const CONTEXT_OVERRIDES = {
  ar: { startDelta: -0.30 },  // "as in car" — beginning was cut off
  d:  { endDelta:   -0.50 },  // "as in dinosaur" — was picking up next /f/
  er: { endDelta:   +0.60 },  // "herd, bird, and surf" — needed more tail
  ow: { endDelta:   +0.30 },  // "as in cow" — needed more /au/ diphthong tail
  z:  { endDelta:   -1.80 },  // "as in zip" — 4 s cap was 1-2 s too long
};

// ─── CLI args ─────────────────────────────────────────────────
const args = process.argv.slice(2);
const dryRun        = args.includes('--dry-run');
const forceWhisper  = args.includes('--force-whisper');
const forceDemucs   = args.includes('--force-demucs');
const phonemeIdx    = args.indexOf('--phoneme');
const singlePhoneme = phonemeIdx !== -1 ? args[phonemeIdx + 1] : null;

// ─── Helpers ──────────────────────────────────────────────────
function sh(cmd, opts = {}) {
  return execSync(cmd, { stdio: 'inherit', ...opts });
}
function shQuiet(cmd) {
  return execSync(cmd, { stdio: 'pipe' }).toString();
}
function exists(p) { return fs.existsSync(p); }

// ─── Step 1: download audio ───────────────────────────────────
function ensureAudio() {
  if (exists(AUDIO_WAV)) {
    console.log(`✓ Audio already downloaded: ${path.relative(ROOT, AUDIO_WAV)}`);
    return;
  }
  console.log('⬇  Downloading audio via yt-dlp…');
  fs.mkdirSync(SOURCE_DIR, { recursive: true });
  sh(
    `yt-dlp -x --audio-format wav --audio-quality 0 -o '${path.join(SOURCE_DIR, 'phonemes-video.%(ext)s')}' '${VIDEO_URL}'`
  );
}

// ─── Step 2: demucs vocal isolation ───────────────────────────
function ensureVocals() {
  if (exists(VOCALS_WAV) && !forceDemucs) {
    console.log(`✓ Vocal track already exists: ${path.relative(ROOT, VOCALS_WAV)}`);
    return;
  }
  console.log('🎤 Running Demucs to isolate vocals (this takes ~90 s)…');
  const separatedDir = path.join(SOURCE_DIR, 'separated');
  sh(
    `python3 -m demucs --two-stems=vocals -o '${separatedDir}' '${AUDIO_WAV}'`,
    { cwd: SOURCE_DIR }
  );
  if (!exists(VOCALS_WAV)) {
    throw new Error(`Demucs did not produce expected output at ${VOCALS_WAV}`);
  }
}

// ─── Step 3: Whisper word-level transcription ─────────────────
async function ensureWhisperTranscript() {
  if (exists(WHISPER_CACHE) && !forceWhisper) {
    console.log(`✓ Whisper transcript cached: ${path.relative(ROOT, WHISPER_CACHE)}`);
    return JSON.parse(fs.readFileSync(WHISPER_CACHE, 'utf8'));
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY missing from .env');

  console.log('📝 Transcribing vocal track with Whisper (word-level)…');

  // Whisper API has a 25 MB upload limit — re-encode as 128kbps MP3 for upload
  const tmpMp3 = path.join(SOURCE_DIR, 'vocals-for-whisper.mp3');
  sh(`ffmpeg -y -i '${VOCALS_WAV}' -c:a libmp3lame -b:a 128k '${tmpMp3}' 2>/dev/null`);

  const form = new FormData();
  form.append('file', new Blob([fs.readFileSync(tmpMp3)]), 'vocals.mp3');
  form.append('model', 'whisper-1');
  form.append('response_format', 'verbose_json');
  form.append('timestamp_granularities[]', 'word');

  const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });
  if (!res.ok) {
    throw new Error(`Whisper API failed: ${res.status} ${await res.text()}`);
  }
  const json = await res.json();
  fs.writeFileSync(WHISPER_CACHE, JSON.stringify(json, null, 2));
  fs.unlinkSync(tmpMp3);
  console.log(`✓ Cached transcript (${json.words?.length ?? 0} words)`);
  return json;
}

// ─── Step 4: find phoneme utterances via "X as in Y" pattern ──
// Whisper transcribes the phoneme sound as a short token (usually 1-3 chars)
// and "as" comes immediately after. We find every "<token> as" occurrence
// in the transcript after the intro (>74s), in order, and map positionally
// to VIDEO_SEQUENCE.
function findPhonemeUtterances(whisper) {
  const words = whisper.words || [];
  const utterances = [];

  for (let i = 0; i < words.length - 1; i++) {
    const cur  = words[i];
    const next = words[i + 1];
    const nextWord = next.word.trim().toLowerCase().replace(/[.,!?]/g, '');
    // Look for "<something> as" where the next-next word is "in"
    if (nextWord !== 'as') continue;
    const after = words[i + 2];
    if (!after) continue;
    const afterWord = after.word.trim().toLowerCase().replace(/[.,!?]/g, '');
    if (afterWord !== 'in') continue;

    // Filter intro ("as I say the sound", "such as", etc.) and outro
    // ("make sure students hear you model …") by requiring utterances to
    // fall within the phoneme demonstration window.
    if (cur.start < 70) continue;
    if (cur.start > 300) continue;

    utterances.push({
      token: cur.word.trim(),
      start: cur.start,
      end:   cur.end,
      asStart: next.start,    // start of "as" = definitive end of the phoneme
    });
  }

  return utterances;
}

// ─── Step 5: extract a clip via ffmpeg ────────────────────────
// Extracts from the clean vocal track, loudness-normalizes, writes MP3.
function extractClip(outPath, startSec, endSec, label) {
  if (dryRun) {
    console.log(`  [dry] ${label}  ${startSec.toFixed(3)}-${endSec.toFixed(3)}s  (${((endSec - startSec) * 1000).toFixed(0)} ms)`);
    return;
  }

  const filter = 'loudnorm=I=-16:TP=-1.5:LRA=11';
  const cmd = [
    'ffmpeg', '-y',
    '-ss', startSec.toFixed(3),
    '-to', endSec.toFixed(3),
    '-i', `'${VOCALS_WAV}'`,
    '-af', `'${filter}'`,
    '-c:a', 'libmp3lame', '-b:a', '192k',
    `'${outPath}'`,
    '2>/dev/null',
  ].join(' ');
  execSync(cmd);

  const size = fs.statSync(outPath).size;
  console.log(`  ✓ ${label}  ${startSec.toFixed(2)}-${endSec.toFixed(2)}s  (${(size / 1024).toFixed(1)} KB)`);
}

// ─── Main ─────────────────────────────────────────────────────
async function main() {
  fs.mkdirSync(SOURCE_DIR, { recursive: true });
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.mkdirSync(CONTEXT_DIR, { recursive: true });

  ensureAudio();
  ensureVocals();
  const whisper = await ensureWhisperTranscript();

  console.log('\n🔍 Matching phoneme utterances to video sequence…');
  const utterances = findPhonemeUtterances(whisper);
  console.log(`   Found ${utterances.length} "<token> as in …" utterances`);
  console.log(`   Video sequence expects ${VIDEO_SEQUENCE.length} entries`);

  if (utterances.length !== VIDEO_SEQUENCE.length) {
    console.warn(`\n⚠  Mismatch between utterances (${utterances.length}) and video sequence (${VIDEO_SEQUENCE.length}).`);
    console.warn('   Listing all detected utterances for inspection:');
    utterances.forEach((u, i) => {
      const expected = VIDEO_SEQUENCE[i] ?? '?';
      console.warn(`   ${String(i).padStart(2)}  ${u.start.toFixed(2)}s  "${u.token}"  → expected: ${expected}`);
    });
    console.warn('\nFix VIDEO_SEQUENCE in the script or investigate the transcript,');
    console.warn('then re-run. Aborting export to avoid writing wrong files.');
    process.exit(1);
  }

  console.log('\n🎬 Extracting phoneme clips:');
  let exported = 0;
  let skipped = 0;

  // Minimum clip duration — vowels and short utterances where Whisper gave
  // near-zero duration need this to avoid 40 ms clips that cut the phoneme.
  const MIN_DURATION = 0.40;    // 400 ms minimum
  const MAX_PRE_EXTEND = 0.35;  // never extend more than 350 ms before utt.start
  // Gap to leave before the NEXT utterance when building the context clip.
  // Whisper's detection of the next phoneme's onset is often late by 300-400 ms,
  // so we stop well before its reported start to avoid bleeding.
  const CONTEXT_NEXT_GAP = 0.4;

  for (let i = 0; i < VIDEO_SEQUENCE.length; i++) {
    const phoneme = VIDEO_SEQUENCE[i];
    const utt = utterances[i];
    const prevUtt = utterances[i - 1];
    const nextUtt = utterances[i + 1];

    if (!phoneme) {
      console.log(`  – skipping (${utt.start.toFixed(2)}s, token="${utt.token}") — not in target set`);
      skipped++;
      continue;
    }

    if (singlePhoneme && phoneme !== singlePhoneme) continue;
    if (!TARGET_PHONEMES.has(phoneme)) { skipped++; continue; }

    const pad = getPadding(phoneme);

    // --- Phoneme-only clip ---
    // Initial window from Whisper timings + per-phoneme padding.
    let phStart = Math.max(0, utt.start - pad.pre);
    const hardEnd = utt.asStart - 0.04;
    const softEnd = utt.end + pad.post;
    let phEnd = Math.min(hardEnd, softEnd);

    // Enforce minimum duration. When Whisper assigned near-zero duration to
    // the phoneme token, its reported start is mid-sound — extend backwards
    // to capture the full phoneme. Bounded by (a) MAX_PRE_EXTEND and
    // (b) the previous utterance's position (never bleed into the prior
    // "X as in Y" phrase).
    if (phEnd - phStart < MIN_DURATION) {
      const needed = MIN_DURATION - (phEnd - phStart);
      const prevFloor = prevUtt
        ? prevUtt.asStart + 1.0  // leave ~1s for prev "as in Y" to finish
        : 0;
      const extendBy = Math.min(needed, MAX_PRE_EXTEND);
      phStart = Math.max(prevFloor, phStart - extendBy);
    }

    // Apply per-phoneme isolated-clip overrides to LOCAL copies so the
    // context clip below still uses the unmodified phStart / phEnd.
    let isoStart = phStart;
    let isoEnd   = phEnd;
    const phOverride = PHONEME_OVERRIDES[phoneme];
    if (phOverride) {
      if (phOverride.startDelta) isoStart = Math.max(0, isoStart + phOverride.startDelta);
      if (phOverride.endDelta)   isoEnd   = isoEnd + phOverride.endDelta;
      if (isoEnd <= isoStart) isoEnd = isoStart + 0.1;
    }

    extractClip(
      path.join(OUTPUT_DIR, `${phoneme}.mp3`),
      isoStart, isoEnd,
      `${phoneme}.mp3`
    );

    // --- Context clip ("X as in Y") ---
    // End: well before the next utterance starts. Whisper's onset detection
    // for the next phoneme is often late by 300-400 ms, so we give a larger
    // gap to ensure we don't pick up the next phoneme's sound.
    const MAX_CONTEXT_SEC = 4.0;
    const nextStart = nextUtt ? nextUtt.start - CONTEXT_NEXT_GAP : utt.start + MAX_CONTEXT_SEC;

    let contextStart = phStart;
    let contextEnd = Math.min(nextStart, utt.start + MAX_CONTEXT_SEC);

    // Apply per-phoneme overrides for clips that needed hand-tuning.
    const override = CONTEXT_OVERRIDES[phoneme];
    if (override) {
      if (override.startDelta) contextStart = Math.max(0, contextStart + override.startDelta);
      if (override.endDelta)   contextEnd   = contextEnd + override.endDelta;
      // Safety: never bleed into the next utterance even if the override
      // tries to push past it.
      if (nextUtt) contextEnd = Math.min(contextEnd, nextUtt.start - 0.05);
    }

    extractClip(
      path.join(CONTEXT_DIR, `${phoneme}.mp3`),
      contextStart, contextEnd,
      `context/${phoneme}.mp3`
    );

    exported++;
  }

  console.log(`\nDone: ${exported} exported, ${skipped} skipped.`);
  if (!dryRun && !singlePhoneme) {
    console.log(`\nFiles written to: ${path.relative(ROOT, OUTPUT_DIR)}`);
    console.log('Listen to a few (especially r, s, zh, th_v) and tell me which need re-tuning.');
  }
}

main().catch((err) => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
