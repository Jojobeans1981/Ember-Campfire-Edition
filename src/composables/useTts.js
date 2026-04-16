import manifest from '../data/tts-manifest.json';

const textToFile = new Map();

for (const entry of Object.values(manifest.entries)) {
  const key = normalize(entry.text);
  if (key) textToFile.set(key, entry.file);
}

function normalize(text) {
  if (!text) return '';
  return String(text)
    .replace(/\/[^/]*\//g, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([,.!?])/g, '$1')
    .trim()
    .toLowerCase();
}

export function lookupTtsFile(text) {
  const key = normalize(text);
  return key ? textToFile.get(key) ?? null : null;
}
