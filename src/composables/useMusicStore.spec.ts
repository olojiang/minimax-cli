import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useMusicStore } from './useMusicStore';
import { loadLocalLibraryRecords, saveLocalLibraryRecord } from '../utils/localLibrary';

vi.mock('../utils/fileExport', () => ({
  buildMediaObjectUrlFromHex: vi.fn(() => 'blob:audio'),
  downloadMediaFromResponse: vi.fn(),
}));

vi.mock('../utils/localLibrary', () => ({
  loadLocalLibraryRecords: vi.fn(),
  saveLocalLibraryRecord: vi.fn().mockResolvedValue(null),
}));

describe('useMusicStore', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    localStorage.clear();
    (loadLocalLibraryRecords as any).mockResolvedValue([]);
    const store = useMusicStore();
    await store.clearLibrary();
  });

  it('restores audio records from the local disk library', async () => {
    (loadLocalLibraryRecords as any).mockResolvedValue([
      {
        id: 'audio-1',
        kind: 'audio',
        prompt: '雨声',
        response: { lyrics: '滴答' },
        media: [
          { url: '/local-library/files/audio/audio-1.mp3', source: '4'.repeat(2048) },
          { url: '/local-library/files/audio/bad-id.mp3', source: '06454c1ae80225f3494376ae440df772' },
        ],
        createdAt: '2026-05-02T00:00:00.000Z',
      },
    ]);

    const store = useMusicStore();
    await store.init();

    expect(store.musics.value).toHaveLength(1);
    expect(store.musics.value[0]).toMatchObject({
      id: 'audio-1',
      prompt: '雨声',
      lyrics: '滴答',
      url: '/local-library/files/audio/audio-1.mp3',
    });
    expect(store.currentMusic.value?.id).toBe('audio-1');
    expect(store.isPlaying.value).toBe(false);
  });

  it('skips disk records that only contain a hex id mistaken for audio', async () => {
    (loadLocalLibraryRecords as any).mockResolvedValue([
      {
        id: 'audio-2',
        kind: 'audio',
        prompt: '坏记录',
        response: { id: '06454c1ae80225f3494376ae440df772' },
        media: [
          {
            url: '/local-library/files/audio/bad-id.mp3',
            source: '06454c1ae80225f3494376ae440df772',
          },
        ],
        createdAt: '2026-05-02T00:00:00.000Z',
      },
    ]);

    const store = useMusicStore();
    await store.init();

    expect(store.musics.value).toHaveLength(0);
    expect(store.currentMusic.value).toBeNull();
  });

  it('saves newly generated music into the local disk library', async () => {
    const store = useMusicStore();
    await store.addMusic({
      id: 'new-audio',
      prompt: '水流声',
      lyrics: '',
      audioHex: 'a'.repeat(40),
      timestamp: 1,
    });

    expect(saveLocalLibraryRecord).toHaveBeenCalledWith('audio', '水流声', expect.objectContaining({
      data: { audio: 'a'.repeat(40) },
      id: 'new-audio',
    }));
  });
});
