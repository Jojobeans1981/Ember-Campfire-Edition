import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { KokoroTTS } from 'kokoro-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const lessonsDir = path.join(rootDir, 'src', 'data', 'ufli', 'lessons');
const audioOutDir = path.join(rootDir, 'public', 'audio', 'teacher');
const manifestOutPath = path.join(rootDir, 'src', 'data', 'teacherVoiceManifest.json');

const REMOTE_MODEL_ID = 'onnx-community/Kokoro-82M-v1.0-ONNX';
const VOICE = 'af_heart';
const SPEED = 0.94;

function normalizeTeacherText(text) {
  return String(text || '')
    .replace(/\/[^/]*\//g, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([,.!?])/g, '$1')
    .trim();
}

function rewriteIntroLine(rawLine) {
  const line = normalizeTeacherText(rawLine);
  if (!line) return '';
  const normalized = line.toLowerCase();
  if (normalized.includes('watch my mouth')) {
    return 'Listen closely to the sound, then try it too.';
  }
  if (normalized.includes('your turn') || normalized.includes('now you try')) {
    return 'Tap "My turn" and say the sound.';
  }
  return line;
}

function pushLine(lines, text) {
  const cleaned = normalizeTeacherText(text);
  if (cleaned) lines.add(cleaned);
}

function buildSlug(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 42) || 'line';
}

async function collectLessonLines() {
  const lines = new Set();
  const names = await fs.readdir(lessonsDir);
  const lessonFiles = names
    .filter((name) => /^lesson-\d+[a-z]?\.json$/i.test(name))
    .sort((a, b) => a.localeCompare(b));

  for (const file of lessonFiles) {
    const raw = await fs.readFile(path.join(lessonsDir, file), 'utf8');
    const lesson = JSON.parse(raw);
    const step5 = lesson?.step5 || {};
    const introScript = Array.isArray(step5.introductionScript) ? step5.introductionScript : [];
    for (const item of introScript) {
      pushLine(lines, rewriteIntroLine(item?.text));
    }

    const readWords = step5?.readWords || {};
    const spellWords = step5?.spellWords || {};
    const buckets = ['iDo', 'weDo', 'youDo'];
    for (const bucket of buckets) {
      for (const word of readWords[bucket] || []) pushLine(lines, word);
      for (const word of spellWords[bucket] || []) pushLine(lines, word);
    }
  }

  return lines;
}

function addMapLines(lines) {
  const friends = ['Panda', 'Fox', 'Lion', 'Kangaroo', 'Your Guardian'];
  for (const friend of friends) {
    pushLine(lines, `${friend}'s reading adventure. ${friend} needs your sounds to light the campfire path. Tap a glowing trail and start the fun! Today's mission: light one new reading stop.`);
  }
}

async function clearOldAudio() {
  await fs.mkdir(audioOutDir, { recursive: true });
  const files = await fs.readdir(audioOutDir);
  await Promise.all(
    files
      .filter((file) => file.toLowerCase().endsWith('.wav'))
      .map((file) => fs.unlink(path.join(audioOutDir, file))),
  );
}

async function writeManifest(entries, modelId) {
  const manifest = {
    version: 1,
    generatedAt: new Date().toISOString(),
    modelId,
    voice: VOICE,
    entries,
  };
  await fs.writeFile(manifestOutPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
}

async function main() {
  const lines = await collectLessonLines();
  addMapLines(lines);
  pushLine(lines, 'Nice job!');

  const orderedLines = Array.from(lines).sort((a, b) => a.localeCompare(b));
  if (!orderedLines.length) {
    throw new Error('No teacher lines found to prebake.');
  }

  console.log(`Preparing ${orderedLines.length} teacher lines...`);
  await clearOldAudio();

  const modelRef = REMOTE_MODEL_ID;
  const tts = await KokoroTTS.from_pretrained(modelRef, {
    dtype: 'q8',
    device: 'cpu',
  });

  const manifestEntries = {};
  let index = 1;
  for (const line of orderedLines) {
    const hash = createHash('sha1').update(line).digest('hex').slice(0, 10);
    const fileName = `${String(index).padStart(3, '0')}-${buildSlug(line)}-${hash}.wav`;
    const outPath = path.join(audioOutDir, fileName);
    const audio = await tts.generate(line, { voice: VOICE, speed: SPEED });
    await audio.save(outPath);
    manifestEntries[line] = `/audio/teacher/${fileName}`;
    console.log(`[${index}/${orderedLines.length}] ${line}`);
    index += 1;
  }

  await writeManifest(manifestEntries, modelRef);
  console.log(`Done. Wrote ${orderedLines.length} files and manifest.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
