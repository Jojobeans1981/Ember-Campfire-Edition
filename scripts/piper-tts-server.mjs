import http from 'node:http';
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { mkdtemp, readFile, rm } from 'node:fs/promises';

const PORT = Number(process.env.PIPER_PORT || 5055);
const HOST = process.env.PIPER_HOST || '127.0.0.1';
const PIPER_BIN = process.env.PIPER_BIN || 'piper';
const PIPER_MODEL = process.env.PIPER_MODEL;
const PIPER_CONFIG = process.env.PIPER_CONFIG;
const MAX_BODY_BYTES = 64 * 1024;

if (!PIPER_MODEL) {
  console.error('Missing PIPER_MODEL. Example:');
  console.error('  $env:PIPER_MODEL="C:\\\\voices\\\\en_US-amy-medium.onnx"');
  process.exit(1);
}

let busy = false;

function json(res, code, payload) {
  res.writeHead(code, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST,OPTIONS,GET',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end(JSON.stringify(payload));
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let bytes = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      bytes += chunk.length;
      if (bytes > MAX_BODY_BYTES) {
        reject(new Error('Payload too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8');
        resolve(raw ? JSON.parse(raw) : {});
      } catch (error) {
        reject(error);
      }
    });
    req.on('error', reject);
  });
}

async function runPiper(text, speed = 1) {
  const tempDir = await mkdtemp(join(tmpdir(), 'ember-piper-'));
  const outputFile = join(tempDir, 'out.wav');
  const args = ['--model', PIPER_MODEL, '--output_file', outputFile];
  if (PIPER_CONFIG) args.push('--config', PIPER_CONFIG);
  const clampedSpeed = Number.isFinite(speed) ? Math.min(1.8, Math.max(0.5, speed)) : 1;
  const lengthScale = (1 / clampedSpeed).toFixed(3);
  args.push('--length_scale', lengthScale);

  try {
    await new Promise((resolve, reject) => {
      const child = spawn(PIPER_BIN, args, { stdio: ['pipe', 'ignore', 'pipe'] });
      let stderr = '';
      child.stderr.on('data', (chunk) => {
        stderr += chunk.toString('utf8');
      });
      child.on('error', reject);
      child.on('close', (code) => {
        if (code === 0) resolve();
        else reject(new Error(stderr || `Piper exited with code ${code}`));
      });
      child.stdin.write(String(text || '').trim());
      child.stdin.end();
    });

    return await readFile(outputFile);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST,OPTIONS,GET',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    res.end();
    return;
  }

  if (req.method === 'GET' && req.url === '/health') {
    json(res, 200, { ok: true, busy });
    return;
  }

  if (req.method !== 'POST' || req.url !== '/speak') {
    json(res, 404, { error: 'Not found' });
    return;
  }

  if (busy) {
    json(res, 429, { error: 'TTS busy, try again' });
    return;
  }

  try {
    busy = true;
    const body = await parseBody(req);
    const text = String(body?.text || '').trim();
    const speed = Number(body?.speed || 1);
    if (!text) {
      json(res, 400, { error: 'Missing text' });
      return;
    }

    const wav = await runPiper(text, speed);
    res.writeHead(200, {
      'Content-Type': 'audio/wav',
      'Content-Length': String(wav.length),
      'Access-Control-Allow-Origin': '*',
    });
    res.end(wav);
  } catch (error) {
    json(res, 500, { error: error?.message || 'Piper synthesis failed' });
  } finally {
    busy = false;
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Piper TTS server listening at http://${HOST}:${PORT}`);
  console.log(`Using model: ${PIPER_MODEL}`);
});
