const { app, BrowserWindow, globalShortcut, ipcMain, Menu, protocol } = require('electron');
const fs = require('node:fs/promises');
const { existsSync } = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const APP_ORIGIN = 'app://minimax.local';
const DEFAULT_SHORTCUT = 'Shift+Alt+M';
const MAX_BODY_BYTES = 100 * 1024 * 1024;

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'app',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true,
    },
  },
]);

let mainWindow = null;
let activeShortcut = '';

function distRoot() {
  return path.join(app.getAppPath(), 'dist');
}

function configPath() {
  return path.join(app.getPath('userData'), 'desktop-config.json');
}

function libraryRoot() {
  return path.join(app.getPath('userData'), '.mmx-library');
}

function recordsPath() {
  return path.join(libraryRoot(), 'records.json');
}

function filesRoot() {
  return path.join(libraryRoot(), 'files');
}

async function readDesktopConfig() {
  try {
    return JSON.parse(await fs.readFile(configPath(), 'utf8'));
  } catch {
    return { shortcut: DEFAULT_SHORTCUT };
  }
}

async function writeDesktopConfig(config) {
  await fs.mkdir(path.dirname(configPath()), { recursive: true });
  await fs.writeFile(configPath(), JSON.stringify(config, null, 2));
}

async function mergeDesktopConfig(patch) {
  await writeDesktopConfig({
    ...(await readDesktopConfig()),
    ...patch,
  });
}

function showAndMaximize() {
  if (!mainWindow) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.maximize();
  mainWindow.focus();
  if (process.platform === 'darwin') app.focus({ steal: true });
}

async function registerConfiguredShortcut(shortcut) {
  globalShortcut.unregisterAll();
  activeShortcut = '';

  const accelerator = (shortcut || DEFAULT_SHORTCUT).trim();
  const registered = globalShortcut.register(accelerator, showAndMaximize);
  if (!registered) {
    const fallbackRegistered = accelerator === DEFAULT_SHORTCUT
      ? false
      : globalShortcut.register(DEFAULT_SHORTCUT, showAndMaximize);
    if (!fallbackRegistered) {
      return { ok: false, shortcut: '', error: `快捷键 ${accelerator} 注册失败，可能已被系统或其他应用占用。` };
    }
    activeShortcut = DEFAULT_SHORTCUT;
    await mergeDesktopConfig({ shortcut: DEFAULT_SHORTCUT });
    return { ok: false, shortcut: DEFAULT_SHORTCUT, error: `快捷键 ${accelerator} 注册失败，已回退到 ${DEFAULT_SHORTCUT}。` };
  }

  activeShortcut = accelerator;
  await mergeDesktopConfig({ shortcut: accelerator });
  return { ok: true, shortcut: accelerator };
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 960,
    minHeight: 640,
    show: false,
    title: 'Minimax 纪',
    icon: path.join(app.getAppPath(), 'build', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow.once('ready-to-show', () => {
    showAndMaximize();
  });

  void mainWindow.loadURL(`${APP_ORIGIN}/`);
}

async function handleAppProtocol(request) {
  const url = new URL(request.url);
  if (url.pathname.startsWith('/api/')) return proxyApiRequest(request, url);
  if (url.pathname.startsWith('/local-library/')) return handleLocalLibraryRequest(request, url);
  return serveStaticAsset(url);
}

async function serveStaticAsset(url) {
  const requestedPath = !url.pathname || url.pathname === '/' ? '/index.html' : decodeURIComponent(url.pathname);
  const resolved = path.resolve(distRoot(), `.${requestedPath}`);
  const root = path.resolve(distRoot());
  const filePath = resolved.startsWith(root) && existsSync(resolved) ? resolved : path.join(root, 'index.html');
  const data = await fs.readFile(filePath);
  return new Response(data, {
    headers: {
      'content-type': mimeFromPath(filePath),
      'cache-control': filePath.endsWith('index.html') ? 'no-store' : 'public, max-age=31536000, immutable',
    },
  });
}

async function proxyApiRequest(request, url) {
  const target = new URL(url.pathname.replace(/^\/api/, '') + url.search, 'https://api.minimaxi.com');
  const headers = new Headers(request.headers);
  headers.delete('host');
  headers.delete('origin');
  headers.delete('referer');

  const init = {
    method: request.method,
    headers,
    redirect: 'follow',
  };
  if (!['GET', 'HEAD'].includes(request.method)) {
    init.body = Buffer.from(await request.arrayBuffer());
  }

  return fetch(target, init);
}

async function handleLocalLibraryRequest(request, url) {
  try {
    if (request.method === 'GET' && url.pathname === '/local-library/records') {
      return jsonResponse(200, await readRecords());
    }

    if (request.method === 'POST' && url.pathname === '/local-library/records') {
      const body = await readJsonBody(request);
      return jsonResponse(200, await createRecord(body));
    }

    if (request.method === 'DELETE' && url.pathname.startsWith('/local-library/records/')) {
      const id = decodeURIComponent(url.pathname.replace('/local-library/records/', ''));
      const deleted = await deleteRecord(id);
      return jsonResponse(deleted ? 200 : 404, { deleted });
    }

    if (request.method === 'GET' && url.pathname.startsWith('/local-library/files/')) {
      const relative = decodeURIComponent(url.pathname.replace('/local-library/files/', ''));
      const filePath = path.resolve(filesRoot(), relative);
      if (!filePath.startsWith(filesRoot()) || !existsSync(filePath)) {
        return new Response('not found', { status: 404 });
      }
      const data = await fs.readFile(filePath);
      return new Response(data, {
        headers: {
          'content-type': mimeFromPath(filePath),
          'cache-control': 'no-store',
        },
      });
    }
  } catch (error) {
    return jsonResponse(500, { error: error instanceof Error ? error.message : 'local library error' });
  }

  return new Response('not found', { status: 404 });
}

async function readRecords() {
  try {
    const parsed = JSON.parse(await fs.readFile(recordsPath(), 'utf8'));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeRecords(records) {
  await fs.mkdir(libraryRoot(), { recursive: true });
  await fs.writeFile(recordsPath(), JSON.stringify(records, null, 2));
}

async function createRecord(body) {
  const kind = normalizeKind(body?.kind);
  const prompt = typeof body?.prompt === 'string' ? body.prompt : '';
  const response = body?.response;
  const durationMs = normalizeDurationMs(body?.durationMs);
  const createdAt = new Date().toISOString();
  const id = createRecordId(kind, prompt, response, createdAt);
  const media = await persistMedia(kind, id, response);
  const record = {
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

function normalizeDurationMs(value) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return undefined;
  return Math.round(value);
}

async function deleteRecord(id) {
  if (!id) return false;
  const records = await readRecords();
  const record = records.find(item => item.id === id);
  if (!record) return false;

  await writeRecords(records.filter(item => item.id !== id));
  await Promise.all(record.media.map(async item => {
    const filePath = path.resolve(filesRoot(), item.file);
    if (!filePath.startsWith(filesRoot())) return;
    await fs.rm(filePath, { force: true });
  }));
  return true;
}

function normalizeKind(value) {
  if (value === 'image' || value === 'audio' || value === 'video') return value;
  throw new Error('kind must be image, audio, or video');
}

async function persistMedia(kind, recordId, response) {
  const sources = extractMediaSources(kind, response);
  const media = [];
  await fs.mkdir(path.join(filesRoot(), kind), { recursive: true });

  for (let index = 0; index < sources.length; index += 1) {
    const source = sources[index];
    const parsed = await parseMediaSource(source, kind);
    if (!parsed) continue;

    const file = `${kind}/${recordId}-${index + 1}.${parsed.ext}`;
    await fs.writeFile(path.join(filesRoot(), file), parsed.data);
    media.push({
      source,
      file,
      url: `/local-library/files/${file}`,
      mime: parsed.mime,
    });
  }

  return media;
}

function extractMediaSources(kind, value) {
  const sources = [];
  const mediaKeys = new Set(mediaKeysForKind(kind));
  const seen = new Set();
  const queue = [{ value, allowEncoded: true }];

  while (queue.length > 0) {
    const item = queue.shift();
    if (!item) continue;
    const { value: current, allowEncoded } = item;
    if (seen.has(current)) continue;
    seen.add(current);

    if (typeof current === 'string') {
      if (looksLikeMediaSource(kind, current, allowEncoded) && !sources.includes(current)) sources.push(current);
      continue;
    }

    if (!current || typeof current !== 'object') continue;
    if (Array.isArray(current)) {
      current.forEach(nested => {
        if (typeof nested === 'string' && looksLikeMediaSource(kind, nested, allowEncoded) && !sources.includes(nested)) {
          sources.push(nested);
        } else {
          queue.push({ value: nested, allowEncoded });
        }
      });
      continue;
    }

    Object.entries(current).forEach(([key, nested]) => {
      if (mediaKeys.has(key)) {
        if (typeof nested === 'string' && looksLikeMediaSource(kind, nested, true) && !sources.includes(nested)) {
          sources.push(nested);
        } else {
          queue.push({ value: nested, allowEncoded: true });
        }
        return;
      }
      queue.push({ value: nested, allowEncoded: false });
    });
  }

  return sources.slice(0, 12);
}

function mediaKeysForKind(kind) {
  if (kind === 'image') return ['image_url', 'image_urls', 'imageUrl', 'image', 'url', 'output_url', 'download_url'];
  if (kind === 'video') return ['video_url', 'videoUrl', 'video', 'url', 'output_url', 'download_url'];
  return ['audio', 'audio_url', 'audioUrl', 'url', 'output_url', 'download_url'];
}

function looksLikeMediaSource(kind, value, allowEncoded = true) {
  if (/^https?:\/\//i.test(value) || /^data:/i.test(value)) return true;
  if (!allowEncoded) return false;
  if (kind === 'audio' && isHex(value)) return true;
  return isLikelyBase64(value);
}

async function parseMediaSource(source, kind) {
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

function createRecordId(kind, prompt, response, createdAt) {
  return crypto
    .createHash('sha1')
    .update(JSON.stringify({ kind, prompt, response, createdAt }))
    .digest('hex')
    .slice(0, 16);
}

function fallbackMime(kind, source = '') {
  const ext = path.extname(toPathname(source)).toLowerCase();
  if (ext === '.html') return 'text/html; charset=utf-8';
  if (ext === '.js') return 'text/javascript; charset=utf-8';
  if (ext === '.css') return 'text/css; charset=utf-8';
  if (ext === '.svg') return 'image/svg+xml';
  if (ext === '.json') return 'application/json; charset=utf-8';
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

function extensionForMime(mime, source, kind) {
  const sourceExt = source ? path.extname(toPathname(source)).replace('.', '').toLowerCase() : '';
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

function mimeFromPath(filePath) {
  const relative = path.relative(filesRoot(), filePath);
  const kind = relative.startsWith('image/') ? 'image' : relative.startsWith('video/') ? 'video' : 'audio';
  return fallbackMime(kind, filePath);
}

function toPathname(source) {
  try {
    return new URL(source || 'http://local/file').pathname;
  } catch {
    return source;
  }
}

function isHex(value) {
  return value.length >= 32 && value.length % 2 === 0 && /^[\da-f]+$/i.test(value);
}

function isLikelyBase64(value) {
  return value.length >= 32 && /^[A-Za-z0-9+/=\s]+$/.test(value);
}

async function readJsonBody(request) {
  const text = await request.text();
  if (Buffer.byteLength(text) > MAX_BODY_BYTES) throw new Error('request body too large');
  return JSON.parse(text || '{}');
}

function jsonResponse(status, data) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

app.setName('Minimax 纪');

app.whenReady().then(async () => {
  Menu.setApplicationMenu(null);
  protocol.handle('app', handleAppProtocol);

  ipcMain.handle('desktop:get-config', async () => ({
    ...(await readDesktopConfig()),
    activeShortcut,
    defaultShortcut: DEFAULT_SHORTCUT,
    platform: process.platform,
  }));

  ipcMain.handle('desktop:set-shortcut', async (_event, shortcut) => registerConfiguredShortcut(shortcut));
  ipcMain.handle('desktop:set-api-token', async (_event, token) => {
    const apiToken = typeof token === 'string' ? token.trim() : '';
    await mergeDesktopConfig({ apiToken });
    return { ok: true, hasApiToken: Boolean(apiToken) };
  });

  createWindow();
  const config = await readDesktopConfig();
  await registerConfiguredShortcut(config.shortcut || DEFAULT_SHORTCUT);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
    showAndMaximize();
  });
});

app.on('window-all-closed', () => {
  app.quit();
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});
