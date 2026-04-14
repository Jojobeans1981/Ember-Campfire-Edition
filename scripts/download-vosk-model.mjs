import { existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, '..');
const targetDir = resolve(rootDir, 'public', 'models');
const targetFile = resolve(targetDir, 'vosk-model-small-en-us-0.15.tar.gz');
const modelUrl = 'https://ccoreilly.github.io/vosk-browser/models/vosk-model-small-en-us-0.15.tar.gz';
const minBytes = 5 * 1024 * 1024;

async function download(url, destination) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Download failed: ${response.status} ${response.statusText}`);
  }
  const body = await response.arrayBuffer();
  writeFileSync(destination, Buffer.from(body));
}

async function main() {
  mkdirSync(targetDir, { recursive: true });

  if (existsSync(targetFile)) {
    const size = statSync(targetFile).size;
    if (size >= minBytes) {
      console.log(`Vosk model already present: ${targetFile}`);
      console.log(`Size: ${(size / (1024 * 1024)).toFixed(1)} MB`);
      return;
    }
    console.log('Existing model file is too small, re-downloading...');
  }

  console.log('Downloading Vosk model archive (free, offline capable)...');
  console.log(`Source: ${modelUrl}`);
  await download(modelUrl, targetFile);

  const size = statSync(targetFile).size;
  if (size < minBytes) {
    throw new Error(`Downloaded file looks incomplete (${size} bytes): ${targetFile}`);
  }

  console.log(`Saved: ${targetFile}`);
  console.log(`Size: ${(size / (1024 * 1024)).toFixed(1)} MB`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
