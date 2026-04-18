#!/usr/bin/env node
/**
 * Inventory pass for ElevenLabs pre-generated TTS.
 *
 * Scope: Spark Meadow only (lessons 001-010). Walks the in-scope lesson
 * JSON files and collects every string that needs to be voiced at runtime,
 * splitting on IPA tokens (e.g. "/ă/") so phoneme audio from
 * public/audio/phonemes/ is preserved — only the prose segments go into
 * the TTS manifest.
 *
 * Extension points for future work:
 *   - Lesson-authored content (intro scripts, words, sentences, breakdowns)
 *     is picked up automatically by `collectLessonStrings`. Widen
 *     SCOPE_LESSON_IDS to cover more lessons.
 *   - Static UI copy that a component passes to `ember.speak(...)` must
 *     be appended to STATIC_UI_PROMPTS below, otherwise the manifest
 *     lookup returns null and the line plays silently. `useTts.test.js`
 *     asserts coverage for the critical prompts.
 *
 * Writes:
 *   scripts/tts-inventory.json  — deduped prose entries + phoneme refs
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { hasIpaToken } from '../src/utils/ttsSegments.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const lessonsDir = path.join(repoRoot, 'src/data/ufli/lessons');
const outPath = path.join(repoRoot, 'scripts/tts-inventory.json');

// Covers lessons currently reachable in the MVP flow. Shared strings
// (UI prompts, friend lines, adventure intros, campground greetings) are
// always included in full since they fire everywhere. Widen this array
// as more lessons come online.
const SCOPE_LESSON_IDS = ['001', '002'];

const FRIEND_NAMES = ['Fox', 'Lion', 'Panda', 'Kangaroo'];

// ---- Static UI prompts (literal strings from `speak('...')` call sites) ----
const STATIC_UI_PROMPTS = [
  { text: 'Nice job!', source: 'NewConceptStep.vue:146' },
  { text: 'Yes!', source: 'AuditoryDrillStep.vue:125' },
  { text: 'Great!', source: 'VisualDrillStep.vue:109 / SpeechPractice.vue:114' },
  { text: 'Yes! Great reading!', source: 'WordReadingStep.vue:69' },
  { text: "Let's sound it out together.", source: 'WordReadingStep.vue:72' },
  { text: 'Great reading!', source: 'ConnectedTextStep.vue:84 / SentenceReader.vue:106' },
  { text: 'Great spelling!', source: 'WordBuilder.vue:108' },
  { text: 'Try again!', source: 'SpeechPractice.vue:117' },
  { text: 'Try again. Say the whole word.', source: 'BlendingGame.vue:101' },
  { text: 'Can you read this word?', source: 'WordReadingStep.vue:57' },
  {
    text: 'In this section, listen to the sound and tap the matching letter.',
    source: 'AuditoryDrillStep.vue:150',
  },
  {
    text: 'In this section, listen carefully to sounds and words, then blend what you hear.',
    source: 'PhonemicAwarenessStep.vue:91',
  },
  {
    text: 'In this section, listen to the sound, then tap My turn and say it.',
    source: 'VisualDrillStep.vue:134',
  },
  {
    text: 'Connected text. I will read this story with you. Listen first, then take your turn.',
    source: 'StoryReader.vue:22',
  },
  { text: 'Tap each letter.', source: 'BlendingStep.vue:133' },
  { text: 'Now blend them together.', source: 'BlendingStep.vue:146' },
  { text: 'Your turn. Say the whole word.', source: 'BlendingGame.vue:92' },
  {
    text: 'Blend it. Tap each sound from left to right, then say the whole word.',
    source: 'BlendingGame.vue:138',
  },
  { text: 'Tap each sound from left to right.', source: 'BlendingGame.vue:157' },
  {
    text: 'Read the story. I will read each sentence first, then it is your turn.',
    source: 'ConnectedTextStep.vue:96',
  },
  {
    text: 'Say it. Tap hear and say, listen to the sound, then say it clearly into the microphone.',
    source: 'SpeechPractice.vue:132',
  },
  { text: 'Build the word! Tap the hear button to listen.', source: 'WordBuilder.vue:140' },
  {
    text: 'Read the sentence. Tap each word to hear it, then read the whole sentence out loud.',
    source: 'SentenceReader.vue:118',
  },
  { text: 'Tap words to hear them, then tap I can read it.', source: 'SentenceReader.vue:130' },
  {
    text: 'Choose your guardian friend. Then we will start your reading adventure.',
    source: 'App.vue:331',
  },
  { text: 'It says', source: 'useEmber.js:677 (teachPhoneme)' },
  {
    text: "Every campfire starts with an Ember. Let's make reading your fire.",
    source: 'App.vue splash (launch-splash)',
  },

  // --- UI-cleanup pass (lesson-1 audio-only prompts) ---
  { text: "Let's put sounds together to make a word.", source: 'PhonemicAwarenessStep.vue (blend mount)' },
  { text: 'Try it with me.', source: 'PhonemicAwarenessStep.vue (blend closing invite)' },
  { text: 'Listen to the word.', source: 'PhonemicAwarenessStep.vue (segment mount)' },
  { text: 'Listening. Say the sound.', source: 'VisualDrillStep.vue (mic prompt)' },
  { text: 'Great! You said it!', source: 'VisualDrillStep.vue / ConnectedTextStep.vue (success)' },
  { text: 'Try again. Tap the microphone and say the sound.', source: 'VisualDrillStep.vue (retry)' },
  { text: 'Listen to the sound.', source: 'AuditoryDrillStep.vue (listen phase)' },
  { text: 'Tap the letter that matches.', source: 'AuditoryDrillStep.vue (listen phase)' },
  { text: 'Correct!', source: 'AuditoryDrillStep.vue (match success)' },
  { text: 'Tap the sound tiles, then blend it out loud.', source: 'BlendingStep.vue (mount)' },
  { text: 'Say the sound when you are ready.', source: 'NewConceptStep.vue (mic prompt)' },
  { text: 'Listening.', source: 'NewConceptStep.vue / ConnectedTextStep.vue (listening pulse)' },
  { text: 'Nice job! You said it.', source: 'NewConceptStep.vue (success)' },
  { text: 'Try again, then tap my turn.', source: 'NewConceptStep.vue (retry)' },
  { text: "Now let's find that sound in real words.", source: 'NewConceptStep.vue (read phase bridge, fallback)' },
  { text: 'Listen for that sound at the start of these words.', source: 'NewConceptStep.vue (position: initial)' },
  { text: 'Listen for that sound in the middle of these words.', source: 'NewConceptStep.vue (position: medial)' },
  { text: 'Listen for that sound at the end of these words.', source: 'NewConceptStep.vue (position: final)' },
  { text: 'Tap any word to hear it again.', source: 'NewConceptStep.vue (review mode)' },
  { text: 'Tap each word to practice it.', source: 'NewConceptStep.vue (spell phase)' },
  { text: 'Listen closely to the sound, then try it too.', source: 'NewConceptStep.vue (script intro)' },
  { text: 'Tap my turn and say the sound.', source: 'NewConceptStep.vue (script prompt)' },
  { text: 'Now you try.', source: 'NewConceptStep.vue (intro handoff to mic)' },
  { text: 'This is a tricky word. The tricky part is underlined.', source: 'IrregularWordsStep.vue (mount)' },
  { text: 'Tap the speaker to hear me read, then tap the microphone for your turn.', source: 'ConnectedTextStep.vue (mount)' },
  { text: 'Try again. Tap the microphone and read it out loud.', source: 'ConnectedTextStep.vue (retry)' },

  // --- Lesson progress step labels (spoken on step transition in LessonPlayer) ---
  { text: 'Hear sounds.', source: 'LessonPlayer.vue (step1 transition)' },
  { text: 'See the letter.', source: 'LessonPlayer.vue (step2 transition)' },
  { text: 'Match the sound.', source: 'LessonPlayer.vue (step3 transition)' },
  { text: 'Blend sounds.', source: 'LessonPlayer.vue (step4 transition)' },
  { text: 'Learn the letter.', source: 'LessonPlayer.vue (step5 transition)' },
  { text: 'Word work.', source: 'LessonPlayer.vue (step6 transition)' },
  { text: 'Tricky words.', source: 'LessonPlayer.vue (step7 transition)' },
  { text: 'Read sentences.', source: 'LessonPlayer.vue (step8 transition)' },

  // --- Lesson completion + map intro (CampgroundMap + LessonPlayer) ---
  { text: 'You finished the lesson! Great learning.', source: 'LessonPlayer.vue (lesson complete)' },
  { text: "Fox's trail map is ready. Follow the campground trail to the campfire by lighting each reading stop.", source: 'CampgroundMap.vue (speakMapIntro Fox)' },
  { text: "Lion's trail map is ready. Follow the campground trail to the campfire by lighting each reading stop.", source: 'CampgroundMap.vue (speakMapIntro Lion)' },
  { text: "Panda's trail map is ready. Follow the campground trail to the campfire by lighting each reading stop.", source: 'CampgroundMap.vue (speakMapIntro Panda)' },
  { text: "Kangaroo's trail map is ready. Follow the campground trail to the campfire by lighting each reading stop.", source: 'CampgroundMap.vue (speakMapIntro Kangaroo)' },
  { text: "Your Guardian's trail map is ready. Follow the campground trail to the campfire by lighting each reading stop.", source: 'CampgroundMap.vue (speakMapIntro fallback)' },
];

// ---- Friend hype lines + generic hype lines (App.vue:269-292) ----
const FRIEND_HYPE_LINES = {
  Fox: [
    'Fox says you are on a spark streak. Keep going!',
    'You and Fox are flying. Next stop!',
  ],
  Lion: [
    'Lion says wow, that was powerful reading.',
    'Lion is cheering. One more big win!',
  ],
  Panda: [
    'Panda says that was cozy and amazing.',
    'Panda is smiling. Let us light another stop!',
  ],
  Kangaroo: [
    'Kangaroo says boing, awesome work!',
    'Kangaroo is ready for the next leap!',
  ],
};
const GENERIC_HYPE_LINES = [
  'That was awesome. Ready for another one?',
  'You are on fire. Let us keep the streak going!',
  'Big kid energy. Next challenge!',
];

// ---- Adventure intro stories per friend (App.vue:385-390) ----
const STORY_BY_FRIEND = {
  Fox: 'Fox found glow-tracks in Spark Meadow. Each sound you say lights another track. Help Fox reach the giant story campfire!',
  Lion: 'Lion heard tiny letters whispering in the wind. Each sound you say gives Lion a brave roar-boost toward the story campfire!',
  Panda: 'Panda discovered sleepy spark-bamboo. Each sound you say wakes the next spark and opens the path to the story campfire!',
  Kangaroo: 'Kangaroo spotted bouncing ember dots. Each sound you say launches the next leap toward the story campfire!',
};
const FALLBACK_STORY =
  "Your guardian is ready. Each sound you say lights the path to tonight's story campfire!";

// ---- Lesson hub status labels (UfliLessonHub.vue:153) ----
const STATUS_LABELS = ['Ready to Learn', 'Practicing', 'Story Time!', 'Complete!', 'Locked'];

async function loadScopedLessons() {
  const all = await fs.readdir(lessonsDir);
  const lessons = [];
  for (const id of SCOPE_LESSON_IDS) {
    const file = `lesson-${id}.json`;
    if (!all.includes(file)) {
      console.warn(`  ! missing ${file} (skipped)`);
      continue;
    }
    const raw = await fs.readFile(path.join(lessonsDir, file), 'utf8');
    lessons.push({ id, file, data: JSON.parse(raw) });
  }
  return lessons;
}

/**
 * Push a spoken line to the TTS inventory — unless it contains an IPA
 * token like "/ă/". Lines with IPA are "learn the sound" moments; they
 * play via public/audio/phonemes/context/<key>.mp3 at runtime and must
 * be excluded from TTS so we don't generate a duplicate (mispronounced)
 * version.
 */
function stripIpaForTts(text) {
  return String(text ?? '')
    .replace(/\/[^/]*\//g, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([,.!?])/g, '$1')
    .trim();
}

function ingestSpokenLine(line, sourceLabel, textOut, skippedIpa) {
  const text = String(line ?? '').trim();
  if (!text) return;
  if (hasIpaToken(text)) {
    // Phoneme audio plays the sound at runtime, but the surrounding prose
    // still needs Jasmine. Emit the IPA-stripped version so the manifest
    // lookup in useTts.js matches — the runtime strips IPA before lookup
    // using the same rules.
    skippedIpa.push({ text, source: sourceLabel });
    const prose = stripIpaForTts(text);
    if (prose) textOut.push({ text: prose, source: `${sourceLabel} (IPA-stripped)` });
    return;
  }
  textOut.push({ text, source: sourceLabel });
}

function collectLessonStrings(lessons) {
  const entries = [];
  const skippedIpa = []; // [{text, source}] — lines excluded because they contain IPA
  const words = new Set();
  const graphemes = new Set();

  for (const { id, data } of lessons) {
    const tag = `lesson-${id}`;

    for (const b of data.step1?.blend || []) words.add(b.word);
    for (const s of data.step1?.segment || []) words.add(s.word);

    // The letter the lesson is teaching — step2/step3 items may only carry
    // old (review) letters, so pick up the top-level grapheme and each
    // graphemePlacements entry explicitly. NewConceptStep speaks
    // "This is the letter X." for this grapheme on mount.
    if (typeof data.grapheme === 'string') graphemes.add(data.grapheme);
    for (const p of data.step5?.graphemePlacements || []) {
      if (typeof p?.grapheme === 'string') graphemes.add(p.grapheme);
    }
    for (const it of data.step2?.items || []) graphemes.add(it.grapheme);
    for (const it of data.step3?.items || []) {
      for (const g of it.graphemes || []) graphemes.add(g);
    }

    for (const w of data.step4?.wordChain || []) words.add(w);
    for (const w of data.step6?.wordChain || []) words.add(w);

    for (const line of data.step5?.introductionScript || []) {
      ingestSpokenLine(line.text, `${tag} step5.introductionScript`, entries, skippedIpa);
    }

    // Articulation instruction spoken on sound-phase entry, prefixed with
    // "To make that sound, " and lower-cased first letter — must match
    // NewConceptStep.demoSoundAndPrompt exactly.
    const articulation = String(data.step5?.articulatoryGesture || '').trim();
    if (articulation) {
      const prefixed = `To make that sound, ${articulation.charAt(0).toLowerCase()}${articulation.slice(1)}`;
      ingestSpokenLine(prefixed, `${tag} step5.articulatoryGesture`, entries, skippedIpa);
    }
    for (const bucket of ['iDo', 'weDo', 'youDo']) {
      for (const w of data.step5?.readWords?.[bucket] || []) words.add(w);
      for (const w of data.step5?.spellWords?.[bucket] || []) words.add(w);
    }
    // Example words surfaced as tap-to-hear chips when readWords is empty
    // (see NewConceptStep.vue placementExamples fallback).
    for (const p of data.step5?.graphemePlacements || []) {
      for (const w of p?.examples || []) words.add(w);
    }

    for (const r of data.step7?.review || []) words.add(r.word);
    for (const t of data.step7?.teach || []) words.add(t.word);

    for (const s of data.step8?.readSentences || []) {
      ingestSpokenLine(s, `${tag} step8.readSentences`, entries, skippedIpa);
    }
    for (const s of data.step8?.spellSentences || []) {
      ingestSpokenLine(s, `${tag} step8.spellSentences`, entries, skippedIpa);
    }

    for (const w of data.wordList || []) words.add(w);
    for (const w of data.highFrequencyWords?.dolch || []) words.add(w);
    for (const w of data.highFrequencyWords?.fry || []) words.add(w);
  }

  // Bare words + templated phrases spoken at runtime for each blend word.
  //   "The word is X."  — spoken by PhonemicAwarenessStep segment phase
  // The blend phase now says just the bare word after the "Try it with me."
  // invite, so no wrapper-sentence entry is needed for it.
  for (const w of words) {
    entries.push({ text: w, source: 'word-list (bare)' });
    entries.push({ text: `The word is ${w}.`, source: 'word-list (The word is X.)' });
  }

  // teachPhoneme letter announcements — graphemes uppercased at runtime
  for (const g of graphemes) {
    const L = String(g).toUpperCase();
    entries.push({ text: `This is the letter ${L}.`, source: 'teachPhoneme (grapheme)' });
    entries.push({ text: `Can you say ${L}?`, source: 'teachPhoneme (grapheme)' });
    // Wrong-answer announcement for AuditoryDrillStep / VisualDrillStep when
    // the kid picks a non-matching letter — spoken instead of shown on screen.
    entries.push({ text: `It was the letter ${L}.`, source: 'auditory/visual drill wrong' });
  }

  return { entries, skippedIpa, stats: { words: words.size, graphemes: graphemes.size } };
}

function collectFriendStrings() {
  const entries = [];
  for (const name of FRIEND_NAMES) {
    for (const line of FRIEND_HYPE_LINES[name] || []) {
      entries.push({ text: line, source: `hypeLines.${name}` });
    }
  }
  for (const line of GENERIC_HYPE_LINES) {
    entries.push({ text: line, source: 'hypeLines.generic' });
  }

  for (const name of FRIEND_NAMES) {
    const story = STORY_BY_FRIEND[name];
    entries.push({
      text: `${name} and the spark trail. ${story}`,
      source: `adventureIntro.${name}`,
    });
  }
  entries.push({
    text: `Your guardian and the spark trail. ${FALLBACK_STORY}`,
    source: 'adventureIntro.fallback',
  });

  const greeting = (name) =>
    `${name}'s reading adventure. ${name} needs your sounds to light the campfire path. Tap a glowing trail and start the fun! Today's mission: light one new reading stop.`;
  for (const name of FRIEND_NAMES) {
    entries.push({ text: greeting(name), source: `campgroundMap.${name}` });
  }
  entries.push({ text: greeting('Your Guardian'), source: 'campgroundMap.fallback' });

  return entries;
}

function collectLessonHubAnnouncements(lessons) {
  const entries = [];
  for (const { data } of lessons) {
    const num = data.lessonNumber;
    // Lesson titles look like "a /ă/" — the IPA token is for visual
    // display on the hub card, not for speech. Strip it (and any
    // trailing whitespace) before building the spoken announcement.
    const title = String(data.title || '')
      .replace(/\/[^/]+\//g, '')
      .replace(/\s{2,}/g, ' ')
      .trim();
    const base = `Lesson ${num}. ${title} `;
    const tail = 'Tap Lesson to learn sounds, then play the activity cards.';
    entries.push({ text: `${base}${tail}`, source: `lessonHub.${num}.noStatus` });
    for (const label of STATUS_LABELS) {
      entries.push({
        text: `${base}${label}. ${tail}`,
        source: `lessonHub.${num}.${label}`,
      });
    }
  }
  return entries;
}

function dedupe(entries) {
  const byText = new Map();
  for (const e of entries) {
    if (!e.text) continue;
    if (!byText.has(e.text)) {
      byText.set(e.text, { text: e.text, sources: [] });
    }
    const existing = byText.get(e.text);
    if (e.source && !existing.sources.includes(e.source)) {
      existing.sources.push(e.source);
    }
  }
  return [...byText.values()].sort((a, b) => a.text.localeCompare(b.text));
}

async function main() {
  const lessons = await loadScopedLessons();
  if (!lessons.length) {
    console.error('No lessons in scope were found. Aborting.');
    process.exit(1);
  }

  const lessonResults = collectLessonStrings(lessons);
  const all = [
    ...STATIC_UI_PROMPTS,
    ...collectFriendStrings(),
    ...collectLessonHubAnnouncements(lessons),
    ...lessonResults.entries,
  ];
  const deduped = dedupe(all);
  const totalChars = deduped.reduce((n, e) => n + e.text.length, 0);

  const skippedIpa = lessonResults.skippedIpa;

  const output = {
    generatedAt: new Date().toISOString(),
    scope: {
      lessonIds: SCOPE_LESSON_IDS,
      lessonsScanned: lessons.length,
    },
    entryCount: deduped.length,
    totalCharacters: totalChars,
    skippedIpa,
    entries: deduped,
  };

  await fs.writeFile(outPath, JSON.stringify(output, null, 2) + '\n', 'utf8');

  console.log(`Wrote ${outPath}`);
  console.log(`  lessons scanned: ${lessons.length}  (${SCOPE_LESSON_IDS.join(', ')})`);
  console.log(`  unique entries:  ${deduped.length}`);
  console.log(`  total chars:     ${totalChars}`);
  console.log(`  skipped (IPA):   ${skippedIpa.length} lines — play via public/audio/phonemes/context/ at runtime`);
  if (skippedIpa.length) {
    for (const s of skippedIpa.slice(0, 10)) {
      console.log(`    · ${s.text}`);
    }
    if (skippedIpa.length > 10) console.log(`    · …and ${skippedIpa.length - 10} more`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
