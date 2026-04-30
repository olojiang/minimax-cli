type MediaKind = 'image' | 'audio' | 'video';
type ParsedMedia = { type: 'blob'; blob: Blob; mime: string } | { type: 'url'; url: string; mime: string };

interface MediaExportOptions {
  kind: MediaKind;
  prompt: string;
  fallbackId?: string;
}

const MIME_BY_KIND: Record<MediaKind, string> = {
  image: 'image/png',
  audio: 'audio/mpeg',
  video: 'video/mp4'
};

const EXT_BY_MIME: Record<string, string> = {
  'audio/mpeg': 'mp3',
  'audio/mp3': 'mp3',
  'audio/wav': 'wav',
  'audio/x-wav': 'wav',
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/webp': 'webp',
  'video/mp4': 'mp4',
  'video/mpeg': 'mpeg',
  'video/webm': 'webm',
  'application/octet-stream': 'bin'
};

const MEDIA_KEYS: Record<MediaKind, string[]> = {
  image: ['image_url', 'imageUrl', 'image', 'url', 'output_url', 'download_url'],
  audio: ['audio', 'audio_url', 'audioUrl', 'url', 'output_url', 'download_url'],
  video: ['video_url', 'videoUrl', 'video', 'url', 'output_url', 'download_url']
};

export function downloadMediaFromResponse(response: unknown, options: MediaExportOptions) {
  const candidate = findMediaCandidate(response, options.kind);
  if (!candidate) return false;

  const parsed = parseMediaCandidate(candidate, MIME_BY_KIND[options.kind]);
  if (!parsed) return false;

  const filename = buildFilename(options.kind, options.prompt, parsed.mime, options.fallbackId);
  if (parsed.type === 'url') {
    downloadUrl(parsed.url, filename);
    return true;
  }

  downloadBlob(parsed.blob, filename);
  return true;
}

export function buildMediaObjectUrlFromHex(hex: string, mime = 'audio/mpeg') {
  return URL.createObjectURL(hexToBlob(hex, mime));
}

function findMediaCandidate(value: unknown, kind: MediaKind): string | null {
  const keys = new Set(MEDIA_KEYS[kind]);
  const queue: unknown[] = [value];

  while (queue.length > 0) {
    const current = queue.shift();

    if (typeof current === 'string' && looksLikeMediaString(current, kind)) {
      return current;
    }

    if (!current || typeof current !== 'object') continue;

    if (Array.isArray(current)) {
      queue.push(...current);
      continue;
    }

    for (const [key, nested] of Object.entries(current as Record<string, unknown>)) {
      if (keys.has(key) && typeof nested === 'string' && looksLikeMediaString(nested, kind)) {
        return nested;
      }
      queue.push(nested);
    }
  }

  return null;
}

function looksLikeMediaString(value: string, kind: MediaKind) {
  if (!value) return false;
  if (/^https?:\/\//i.test(value) || /^data:/i.test(value)) return true;
  if (kind === 'audio' && isHex(value)) return true;
  return isLikelyBase64(value);
}

function parseMediaCandidate(value: string, fallbackMime: string): ParsedMedia | null {
  if (/^https?:\/\//i.test(value)) {
    return { type: 'url', url: value, mime: fallbackMime };
  }

  if (/^data:/i.test(value)) {
    const match = value.match(/^data:([^;,]+)?(;base64)?,(.*)$/i);
    if (!match) return null;
    const mime = match[1] || fallbackMime;
    const body = match[3] || '';
    return { type: 'blob', blob: base64ToBlob(body, mime), mime };
  }

  if (isHex(value)) {
    return { type: 'blob', blob: hexToBlob(value, fallbackMime), mime: fallbackMime };
  }

  if (isLikelyBase64(value)) {
    return { type: 'blob', blob: base64ToBlob(value, fallbackMime), mime: fallbackMime };
  }

  return null;
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  try {
    downloadUrl(url, filename);
  } finally {
    window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
  }
}

function downloadUrl(url: string, filename: string) {
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  link.remove();
}

function buildFilename(kind: MediaKind, prompt: string, mime: string, fallbackId?: string) {
  const ext = EXT_BY_MIME[mime.toLowerCase()] || EXT_BY_MIME[MIME_BY_KIND[kind]] || 'bin';
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const slug = sanitizeFilename(prompt).slice(0, 48) || fallbackId || kind;
  return `minimax-${kind}-${stamp}-${slug}.${ext}`;
}

function sanitizeFilename(value: string) {
  return value
    .trim()
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function isHex(value: string) {
  return value.length >= 32 && value.length % 2 === 0 && /^[\da-f]+$/i.test(value);
}

function isLikelyBase64(value: string) {
  return value.length >= 32 && /^[A-Za-z0-9+/=\s]+$/.test(value);
}

function hexToBlob(hex: string, mime: string) {
  const bytes = new Uint8Array(hex.match(/.{1,2}/g)!.map(byte => Number.parseInt(byte, 16)));
  return uint8ArrayToBlob(bytes, mime);
}

function base64ToBlob(base64: string, mime: string) {
  const binary = window.atob(base64.replace(/\s/g, ''));
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return uint8ArrayToBlob(bytes, mime);
}

function uint8ArrayToBlob(bytes: Uint8Array, mime: string) {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return new Blob([buffer], { type: mime });
}
