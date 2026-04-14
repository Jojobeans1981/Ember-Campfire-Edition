#!/usr/bin/env node
/**
 * Generate phoneme audio files using TTS engines.
 *
 * Engines:
 *   --engine google   Google Cloud TTS with SSML <phoneme> tags (IPA) — best fidelity
 *   --engine openai   OpenAI TTS (legacy, direct text transcription)
 *
 * Usage:
 *   node scripts/generate-phonemes.mjs --engine google --phoneme r
 *   node scripts/generate-phonemes.mjs --engine google --all
 *   node scripts/generate-phonemes.mjs --engine google --audit --phoneme r
 *
 * Environment:
 *   GOOGLE_TTS_API_KEY=...   Required for --engine google
 *   OPENAI_API_KEY=...       Required for --engine openai
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const AUDIO_DIR = path.join(__dirname, '..', 'public', 'audio', 'phonemes');

// ────────────────────────────────────────────────────────────
// Phoneme order — all 44+ English phonemes for OG instruction
// ────────────────────────────────────────────────────────────
const PHONEME_ORDER = [
  's', 'a', 'm', 't', 'p', 'n', 'i', 'c',
  'b', 'f', 'l', 'o', 'h', 'd', 'g', 'e',
  'r', 'u', 'k', 'w', 'j', 'y', 'x', 'q', 'z', 'v',
  'sh', 'ch', 'th', 'th_v', 'ng', 'zh', 'wh',
  'long_a', 'long_e', 'long_i', 'long_o', 'long_u',
  'ar', 'er', 'or',
  'oi', 'ow', 'oo_long', 'oo_short', 'aw',
];

// ────────────────────────────────────────────────────────────
// Google Cloud TTS — IPA phoneme map
// ────────────────────────────────────────────────────────────
// Each entry maps to the IPA symbol(s) for that phoneme.
// Google Cloud TTS SSML: <phoneme alphabet="ipa" ph="...">_</phoneme>
//
// For very short consonants (stops like /p/, /t/, /b/) we append a schwa
// so the output is audible (e.g. /pə/) — matching how OG teachers model them.
const IPA_MAP = {
  // --- Single-letter consonants ---
  s:  's',       // continuant — can sustain
  m:  'm',       // continuant
  t:  'tə',      // stop — needs schwa release
  p:  'pə',      // stop
  n:  'n',       // continuant
  c:  'kə',      // stop (hard c)
  b:  'bə',      // stop
  f:  'f',       // continuant
  l:  'l',       // continuant
  h:  'hə',      // aspirate
  d:  'də',      // stop
  g:  'ɡə',      // stop (voiced velar)
  r:  'ɹ',       // approximant — THE problem child
  k:  'kə',      // stop
  w:  'wə',      // glide
  j:  'dʒə',     // affricate
  y:  'jə',      // glide (palatal)
  x:  'ks',      // cluster
  q:  'kwə',     // cluster
  z:  'z',       // continuant
  v:  'v',       // continuant
  // --- Short vowels ---
  a:  'æ',       // cat
  e:  'ɛ',       // bed
  i:  'ɪ',       // sit
  o:  'ɑ',       // hot
  u:  'ʌ',       // cup
  // --- Consonant digraphs ---
  sh:   'ʃ',     // ship — continuant
  ch:   'tʃə',   // chip — affricate + schwa
  th:   'θ',     // think — continuant (unvoiced)
  th_v: 'ð',     // this — continuant (voiced)
  ng:   'ŋ',     // ring — nasal continuant
  zh:   'ʒ',     // measure — continuant
  wh:   'ʍə',    // when — voiceless glide
  // --- Long vowels ---
  long_a: 'eɪ',  // cake
  long_e: 'iː',  // feet
  long_i: 'aɪ',  // kite
  long_o: 'oʊ',  // home
  long_u: 'juː', // cute
  // --- R-controlled vowels ---
  ar: 'ɑɹ',      // car
  er: 'ɝ',       // her / bird / fur
  or: 'ɔɹ',      // for
  // --- Diphthongs & other vowels ---
  oi:      'ɔɪ',  // oil
  ow:      'aʊ',  // cow
  oo_long: 'uː',  // moon
  oo_short:'ʊ',   // book
  aw:      'ɔː',  // law
};

// Google voice config — en-US Neural2/Studio voices sound natural for kids
const GOOGLE_VOICE = {
  languageCode: 'en-US',
  name: 'en-US-Studio-O',       // Studio female, warm tone
  // Alternatives to try:
  //   'en-US-Neural2-F'         // Neural2 female
  //   'en-US-Studio-Q'          // Studio male
};

const GOOGLE_AUDIO_CONFIG = {
  audioEncoding: 'MP3',
  speakingRate: 0.9,            // slightly slower for clarity
  pitch: 0,                     // neutral pitch
};

// ────────────────────────────────────────────────────────────
// Google TTS: audit mode — vary voice, rate, and IPA framing
// ────────────────────────────────────────────────────────────
const GOOGLE_AUDIT_STRATEGIES = {
  r: [
    { label: 'studio-o-default',  ipa: 'ɹ',   voiceName: 'en-US-Studio-O',  rate: 0.9  },
    { label: 'studio-o-slow',     ipa: 'ɹ',   voiceName: 'en-US-Studio-O',  rate: 0.7  },
    { label: 'studio-o-schwa',    ipa: 'ɹə',  voiceName: 'en-US-Studio-O',  rate: 0.9  },
    { label: 'neural2-f-default', ipa: 'ɹ',   voiceName: 'en-US-Neural2-F', rate: 0.9  },
    { label: 'neural2-f-schwa',   ipa: 'ɹə',  voiceName: 'en-US-Neural2-F', rate: 0.9  },
    { label: 'neural2-h-default', ipa: 'ɹ',   voiceName: 'en-US-Neural2-H', rate: 0.9  },
    { label: 'neural2-h-schwa',   ipa: 'ɹə',  voiceName: 'en-US-Neural2-H', rate: 0.9  },
    { label: 'studio-q-default',  ipa: 'ɹ',   voiceName: 'en-US-Studio-Q',  rate: 0.9  },
  ],
};

// ────────────────────────────────────────────────────────────
// OpenAI TTS — legacy text prompts (kept for fallback)
// ────────────────────────────────────────────────────────────
const OPENAI_PROMPTS = {
  s: 'sss', m: 'mmm', t: 'tuh', p: 'puh', n: 'nnn', c: 'kuh',
  b: 'buh', f: 'fff', l: 'lll', h: 'huh', d: 'duh', g: 'guh',
  r: 'rrr', k: 'kuh', w: 'wuh', j: 'juh', y: 'yuh', x: 'ks',
  q: 'kwuh', z: 'zzz', v: 'vvv',
  a: 'aah', e: 'eh', i: 'ih', o: 'ahh', u: 'uh',
  sh: 'shh', ch: 'chuh', th: 'thhh', th_v: 'thuh', ng: 'nng',
  zh: 'zhuh', wh: 'whuh',
  long_a: 'ay', long_e: 'ee', long_i: 'eye', long_o: 'oh', long_u: 'you',
  ar: 'ar', er: 'er', or: 'or',
  oi: 'oy', ow: 'ow', oo_long: 'ooo', oo_short: 'ookh', aw: 'aww',
};

// ────────────────────────────────────────────────────────────
// CLI args
// ────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const regenerateAll = args.includes('--all');
const auditMode = args.includes('--audit');

const engineIdx = args.indexOf('--engine');
const engine = engineIdx !== -1 ? args[engineIdx + 1] : 'google';

const voiceIdx = args.indexOf('--voice');
const openaiVoice = voiceIdx !== -1 ? args[voiceIdx + 1] : 'shimmer';

const singleIdx = args.indexOf('--phoneme');
const singlePhoneme = singleIdx !== -1 ? args[singleIdx + 1] : null;

config({ path: path.join(__dirname, '..', '.env') });

// Validate API key for chosen engine
function getApiKey() {
  if (engine === 'google') {
    const key = process.env.GOOGLE_TTS_API_KEY;
    if (!key || key === 'your-key-here') {
      console.error('Error: Set GOOGLE_TTS_API_KEY in .env');
      console.error('Get one at: https://console.cloud.google.com/apis/credentials');
      console.error('Enable "Cloud Text-to-Speech API" in your GCP project.');
      process.exit(1);
    }
    return key;
  } else {
    const key = process.env.OPENAI_API_KEY;
    if (!key || key === 'your-key-here') {
      console.error('Error: Set OPENAI_API_KEY in .env');
      process.exit(1);
    }
    return key;
  }
}

const apiKey = getApiKey();

// ────────────────────────────────────────────────────────────
// Google Cloud TTS generation
// ────────────────────────────────────────────────────────────
function buildSSML(ipa) {
  // Wrap IPA in SSML <phoneme> tag. The visible text is a placeholder;
  // the engine uses only the IPA from the `ph` attribute.
  return `<speak><phoneme alphabet="ipa" ph="${ipa}">.</phoneme></speak>`;
}

async function generateWithGoogle(phoneme, { ipa, voiceName, speakingRate } = {}) {
  const phonemeIpa = ipa || IPA_MAP[phoneme];
  if (!phonemeIpa) {
    console.warn(`  ⚠ No IPA mapping for "${phoneme}", skipping.`);
    return null;
  }

  const ssml = buildSSML(phonemeIpa);
  const voiceConfig = {
    languageCode: 'en-US',
    name: voiceName || GOOGLE_VOICE.name,
  };
  const audioConfig = {
    ...GOOGLE_AUDIO_CONFIG,
    ...(speakingRate != null ? { speakingRate } : {}),
  };

  const url = `https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      input: { ssml },
      voice: voiceConfig,
      audioConfig,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error(`  ✗ Google TTS failed for "${phoneme}": ${res.status} ${err}`);
    return null;
  }

  const json = await res.json();
  // Google returns base64-encoded audio in audioContent
  return Buffer.from(json.audioContent, 'base64');
}

// ────────────────────────────────────────────────────────────
// OpenAI TTS generation (legacy)
// ────────────────────────────────────────────────────────────
async function generateWithOpenAI(phoneme) {
  const prompt = OPENAI_PROMPTS[phoneme];
  if (!prompt) {
    console.warn(`  ⚠ No prompt defined for "${phoneme}", skipping.`);
    return null;
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
      voice: openaiVoice,
      response_format: 'mp3',
      speed: 0.85,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error(`  ✗ OpenAI TTS failed for "${phoneme}": ${res.status} ${err}`);
    return null;
  }

  return Buffer.from(await res.arrayBuffer());
}

// ────────────────────────────────────────────────────────────
// Unified generate function
// ────────────────────────────────────────────────────────────
async function generatePhoneme(phoneme) {
  const buffer = engine === 'google'
    ? await generateWithGoogle(phoneme)
    : await generateWithOpenAI(phoneme);

  if (!buffer) return false;

  const outPath = path.join(AUDIO_DIR, `${phoneme}.mp3`);
  fs.writeFileSync(outPath, buffer);
  console.log(`  ✓ ${phoneme}.mp3 (${(buffer.length / 1024).toFixed(1)} KB)`);
  return true;
}

// ────────────────────────────────────────────────────────────
// Audit mode — generate multiple candidates for A/B comparison
// ────────────────────────────────────────────────────────────
async function runAudit(phoneme) {
  const strategies = engine === 'google'
    ? GOOGLE_AUDIT_STRATEGIES[phoneme]
    : null;

  if (!strategies) {
    console.error(`No audit strategies defined for "${phoneme}" with engine "${engine}".`);
    if (engine === 'google') {
      console.error(`Available: ${Object.keys(GOOGLE_AUDIT_STRATEGIES).join(', ')}`);
    }
    process.exit(1);
  }

  const auditDir = path.join(AUDIO_DIR, 'audit', phoneme);
  fs.mkdirSync(auditDir, { recursive: true });

  console.log(`\n🔍 Audit mode [${engine}]: generating ${strategies.length} candidates for "${phoneme}"\n`);

  let success = 0;
  for (const strat of strategies) {
    const buffer = await generateWithGoogle(phoneme, {
      ipa: strat.ipa,
      voiceName: strat.voiceName,
      speakingRate: strat.rate,
    });

    if (buffer) {
      const outPath = path.join(auditDir, `${strat.label}.mp3`);
      fs.writeFileSync(outPath, buffer);
      console.log(`  ✓ ${strat.label}.mp3  ipa="${strat.ipa}"  voice=${strat.voiceName}  rate=${strat.rate}  (${(buffer.length / 1024).toFixed(1)} KB)`);
      success++;
    }

    await new Promise((r) => setTimeout(r, 300));
  }

  console.log(`\n✅ ${success}/${strategies.length} candidates saved to:`);
  console.log(`   ${auditDir}/`);
  console.log(`\nListen to each file, then pick the best combo of IPA + voice + rate.`);
  console.log(`Update IPA_MAP / GOOGLE_VOICE / GOOGLE_AUDIO_CONFIG with the winner.`);
}

// ────────────────────────────────────────────────────────────
// Main
// ────────────────────────────────────────────────────────────
async function main() {
  fs.mkdirSync(AUDIO_DIR, { recursive: true });

  console.log(`Engine: ${engine}`);

  // --- Audit mode ---
  if (auditMode) {
    if (!singlePhoneme) {
      console.error('Audit mode requires --phoneme <name>. Example: --audit --phoneme r');
      process.exit(1);
    }
    await runAudit(singlePhoneme);
    return;
  }

  // --- Normal generation ---
  const phonemes = singlePhoneme ? [singlePhoneme] : PHONEME_ORDER;
  const toGenerate = regenerateAll
    ? phonemes
    : phonemes.filter((p) => !fs.existsSync(path.join(AUDIO_DIR, `${p}.mp3`)));

  if (toGenerate.length === 0) {
    console.log('All phoneme audio files already exist. Use --all to regenerate.');
    return;
  }

  console.log(`Generating ${toGenerate.length} phoneme(s)...\n`);

  let success = 0;
  let fail = 0;

  for (const phoneme of toGenerate) {
    const ok = await generatePhoneme(phoneme);
    if (ok) success++;
    else fail++;
    await new Promise((r) => setTimeout(r, 250));
  }

  console.log(`\nDone: ${success} generated, ${fail} failed.`);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
