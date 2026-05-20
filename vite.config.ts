import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { basename, extname, join, resolve } from 'node:path'
import { defineConfig, loadEnv, type Plugin } from 'vite'
import vue from '@vitejs/plugin-vue'

type LibraryKind = 'image' | 'audio' | 'video';

type LibraryRecord = {
  id: string;
  kind: LibraryKind;
  prompt: string;
  response: unknown;
  media: Array<{
    source: string;
    file: string;
    url: string;
    mime: string;
  }>;
  createdAt: string;
  durationMs?: number;
};

const libraryRoot = resolve(process.cwd(), '.mmx-library');
const recordsPath = join(libraryRoot, 'records.json');
const filesRoot = join(libraryRoot, 'files');

function localLibraryPlugin(): Plugin {
  return {
    name: 'local-library',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        try {
          const url = new URL(req.url || '/', 'http://localhost');
          if (req.method === 'GET' && url.pathname === '/local-library/records') {
            const records = await readRecords();
            sendJson(res, 200, records);
            return;
          }

          if (req.method === 'POST' && url.pathname === '/local-library/records') {
            const body = await readJsonBody(req);
            const record = await createRecord(body);
            sendJson(res, 200, record);
            return;
          }

          if (req.method === 'DELETE' && url.pathname.startsWith('/local-library/records/')) {
            const id = decodeURIComponent(url.pathname.replace('/local-library/records/', ''));
            const deleted = await deleteRecord(id);
            sendJson(res, deleted ? 200 : 404, { deleted });
            return;
          }

          if (req.method === 'GET' && url.pathname.startsWith('/local-library/files/')) {
            const relative = decodeURIComponent(url.pathname.replace('/local-library/files/', ''));
            const filePath = resolve(filesRoot, relative);
            if (!filePath.startsWith(filesRoot) || !existsSync(filePath)) {
              res.statusCode = 404;
              res.end('not found');
              return;
            }

            const data = await readFile(filePath);
            res.setHeader('Content-Type', mimeFromPath(filePath));
            res.setHeader('Cache-Control', 'no-store');
            res.end(data);
            return;
          }
        } catch (error) {
          sendJson(res, 500, {
            error: error instanceof Error ? error.message : 'local library error',
          });
          return;
        }

        next();
      });
    },
  };
}

async function readRecords(): Promise<LibraryRecord[]> {
  try {
    const content = await readFile(recordsPath, 'utf8');
    const parsed = JSON.parse(content);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeRecords(records: LibraryRecord[]) {
  await mkdir(libraryRoot, { recursive: true });
  await writeFile(recordsPath, JSON.stringify(records, null, 2));
}

async function createRecord(body: any): Promise<LibraryRecord> {
  const kind = normalizeKind(body?.kind);
  const prompt = typeof body?.prompt === 'string' ? body.prompt : '';
  const response = body?.response;
  const durationMs = normalizeDurationMs(body?.durationMs);
  const createdAt = new Date().toISOString();
  const id = createRecordId(kind, prompt, response, createdAt);
  const media = await persistMedia(kind, id, response);
  const record: LibraryRecord = {
    id,
    kind,
    prompt,
    response,
    media,
    createdAt,
    ...(typeof durationMs === 'number' ? { durationMs } : {}),
  };
  const records = await readRecords();
  await writeRecords([record, ...records].slice(0, 200));
  return record;
}

function normalizeDurationMs(value: unknown) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return undefined;
  return Math.round(value);
}

async function deleteRecord(id: string): Promise<boolean> {
  if (!id) return false;

  const records = await readRecords();
  const record = records.find(item => item.id === id);
  if (!record) return false;

  await writeRecords(records.filter(item => item.id !== id));
  await Promise.all(record.media.map(async item => {
    const filePath = resolve(filesRoot, item.file);
    if (!filePath.startsWith(filesRoot)) return;
    await rm(filePath, { force: true });
  }));
  return true;
}

function normalizeKind(value: unknown): LibraryKind {
  if (value === 'image' || value === 'audio' || value === 'video') {
    return value;
  }
  throw new Error('kind must be image, audio, or video');
}

async function persistMedia(kind: LibraryKind, recordId: string, response: unknown): Promise<LibraryRecord['media']> {
  const sources = extractMediaSources(kind, response);
  const media: LibraryRecord['media'] = [];
  await mkdir(join(filesRoot, kind), { recursive: true });

  for (let index = 0; index < sources.length; index += 1) {
    const source = sources[index];
    const parsed = await parseMediaSource(source, kind);
    if (!parsed) continue;

    const file = `${kind}/${recordId}-${index + 1}.${parsed.ext}`;
    await writeFile(join(filesRoot, file), parsed.data);
    media.push({
      source,
      file,
      url: `/local-library/files/${file}`,
      mime: parsed.mime,
    });
  }

  return media;
}

function extractMediaSources(kind: LibraryKind, value: unknown): string[] {
  const sources: string[] = [];
  const mediaKeys = new Set(mediaKeysForKind(kind));
  const seen = new Set<unknown>();
  const queue: Array<{ value: unknown; allowEncoded: boolean }> = [{ value, allowEncoded: true }];

  while (queue.length > 0) {
    const item = queue.shift();
    if (!item) continue;
    const { value: current, allowEncoded } = item;
    if (seen.has(current)) continue;
    seen.add(current);

    if (typeof current === 'string') {
      if (looksLikeMediaSource(kind, current, allowEncoded) && !sources.includes(current)) {
        sources.push(current);
      }
      continue;
    }

    if (!current || typeof current !== 'object') continue;
    if (Array.isArray(current)) {
      for (const item of current) {
        if (typeof item === 'string' && looksLikeMediaSource(kind, item, allowEncoded) && !sources.includes(item)) {
          sources.push(item);
        } else {
          queue.push({ value: item, allowEncoded });
        }
      }
      continue;
    }

    for (const [key, nested] of Object.entries(current as Record<string, unknown>)) {
      if (mediaKeys.has(key)) {
        if (typeof nested === 'string' && looksLikeMediaSource(kind, nested, true) && !sources.includes(nested)) {
          sources.push(nested);
        } else {
          queue.push({ value: nested, allowEncoded: true });
        }
        continue;
      }
      queue.push({ value: nested, allowEncoded: false });
    }
  }

  return sources.slice(0, 12);
}

function mediaKeysForKind(kind: LibraryKind) {
  if (kind === 'image') return ['image_url', 'image_urls', 'imageUrl', 'image', 'url', 'output_url', 'download_url'];
  if (kind === 'video') return ['video_url', 'videoUrl', 'video', 'url', 'output_url', 'download_url'];
  return ['audio', 'audio_url', 'audioUrl', 'url', 'output_url', 'download_url'];
}

function looksLikeMediaSource(kind: LibraryKind, value: string, allowEncoded = true) {
  if (/^https?:\/\//i.test(value) || /^data:/i.test(value)) return true;
  if (!allowEncoded) return false;
  if (kind === 'audio' && isHex(value)) return true;
  return isLikelyBase64(value);
}

async function parseMediaSource(source: string, kind: LibraryKind): Promise<{ data: Buffer; mime: string; ext: string } | null> {
  if (/^https?:\/\//i.test(source)) {
    const response = await fetch(source);
    if (!response.ok) return null;
    const mime = response.headers.get('content-type')?.split(';')[0] || fallbackMime(kind, source);
    return {
      data: Buffer.from(await response.arrayBuffer()),
      mime,
      ext: extensionForMime(mime, source, kind),
    };
  }

  const dataUrl = source.match(/^data:([^;,]+)?(;base64)?,(.*)$/i);
  if (dataUrl) {
    const mime = dataUrl[1] || fallbackMime(kind);
    const data = dataUrl[2]
      ? Buffer.from(dataUrl[3] || '', 'base64')
      : Buffer.from(decodeURIComponent(dataUrl[3] || ''), 'utf8');
    return { data, mime, ext: extensionForMime(mime, undefined, kind) };
  }

  if (kind === 'audio' && isHex(source)) {
    const mime = fallbackMime(kind);
    return { data: Buffer.from(source, 'hex'), mime, ext: extensionForMime(mime, undefined, kind) };
  }

  if (isLikelyBase64(source)) {
    const mime = fallbackMime(kind);
    return { data: Buffer.from(source.replace(/\s/g, ''), 'base64'), mime, ext: extensionForMime(mime, undefined, kind) };
  }

  return null;
}

function createRecordId(kind: LibraryKind, prompt: string, response: unknown, createdAt: string) {
  return createHash('sha1')
    .update(JSON.stringify({ kind, prompt, response, createdAt }))
    .digest('hex')
    .slice(0, 16);
}

function fallbackMime(kind: LibraryKind, source = '') {
  const ext = extname(toPathname(source)).toLowerCase();
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.png') return 'image/png';
  if (ext === '.webp') return 'image/webp';
  if (ext === '.mp4') return 'video/mp4';
  if (ext === '.webm') return 'video/webm';
  if (ext === '.wav') return 'audio/wav';
  if (ext === '.flac') return 'audio/flac';
  if (ext === '.mp3') return 'audio/mpeg';
  return kind === 'image' ? 'image/png' : kind === 'video' ? 'video/mp4' : 'audio/mpeg';
}

function extensionForMime(mime: string, source: string | undefined, kind: LibraryKind) {
  const sourceExt = source ? extname(toPathname(source)).replace('.', '').toLowerCase() : '';
  if (sourceExt) return sourceExt === 'jpeg' ? 'jpg' : sourceExt;
  const normalized = mime.toLowerCase();
  if (normalized.includes('jpeg')) return 'jpg';
  if (normalized.includes('png')) return 'png';
  if (normalized.includes('webp')) return 'webp';
  if (normalized.includes('wav')) return 'wav';
  if (normalized.includes('flac')) return 'flac';
  if (normalized.includes('mp4')) return 'mp4';
  if (normalized.includes('webm')) return 'webm';
  if (normalized.includes('mpeg')) return kind === 'audio' ? 'mp3' : 'mpeg';
  return kind === 'image' ? 'png' : kind === 'video' ? 'mp4' : 'mp3';
}

function mimeFromPath(path: string) {
  return fallbackMime(path.startsWith('image/') ? 'image' : path.startsWith('video/') ? 'video' : 'audio', basename(path));
}

function toPathname(source: string) {
  try {
    return new URL(source || 'http://local/file').pathname;
  } catch {
    return source;
  }
}

function isHex(value: string) {
  return value.length >= 32 && value.length % 2 === 0 && /^[\da-f]+$/i.test(value);
}

function isLikelyBase64(value: string) {
  return value.length >= 32 && /^[A-Za-z0-9+/=\s]+$/.test(value);
}

async function readJsonBody(req: any) {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 100 * 1024 * 1024) {
      throw new Error('request body too large');
    }
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
}

function sendJson(res: any, status: number, data: unknown) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(data));
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    base: './',
    plugins: [vue(), localLibraryPlugin()],
    define: {
      'import.meta.env.MINIMAX_TOKEN': JSON.stringify(env.MINIMAX_TOKEN || '')
    },
    server: {
      port: 21234,
      strictPort: true,
      open: true,
      proxy: {
        '/api': {
          target: 'https://api.minimaxi.com',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, '')
        }
      }
    }
  };
})
