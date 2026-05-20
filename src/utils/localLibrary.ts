export type LocalLibraryKind = 'image' | 'speech' | 'video' | 'music' | 'audio';

export type LocalLibraryRecord = {
  id: string;
  kind: LocalLibraryKind;
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

export async function saveLocalLibraryRecord(
  kind: LocalLibraryKind,
  prompt: string,
  response: unknown,
  options: { durationMs?: number } = {},
): Promise<LocalLibraryRecord | null> {
  try {
    const res = await fetch('/local-library/records', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind, prompt, response, ...options }),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function loadLocalLibraryRecords(kind?: LocalLibraryKind): Promise<LocalLibraryRecord[]> {
  try {
    const res = await fetch('/local-library/records');
    if (!res.ok) return [];
    const records = await res.json();
    if (!Array.isArray(records)) return [];
    return kind ? records.filter((item): item is LocalLibraryRecord => item?.kind === kind) : records;
  } catch {
    return [];
  }
}

export async function deleteLocalLibraryRecord(id: string): Promise<boolean> {
  try {
    const res = await fetch(`/local-library/records/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    if (!res.ok) return false;
    const payload = await res.json();
    return payload?.deleted === true;
  } catch {
    return false;
  }
}
