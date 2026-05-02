import { ref } from 'vue';
import { buildMediaObjectUrlFromHex, downloadMediaFromResponse } from '../utils/fileExport';
import { readStorage, removeStorage } from '../utils/safeStorage';
import { loadLocalLibraryRecords, saveLocalLibraryRecord, type LocalLibraryRecord } from '../utils/localLibrary';

export interface MusicItem {
  id: string;
  prompt: string;
  lyrics: string;
  url: string; // Blob URL (not persisted)
  timestamp: number;
}

const STORAGE_KEY = 'mmx_music_library_meta';
const MAX_ITEMS = 15;

// Singleton state
const musics = ref<MusicItem[]>([]);
const currentMusic = ref<MusicItem | null>(null);
const isPlaying = ref(false);
const audioRef = ref<HTMLAudioElement | null>(null);

const MIN_INLINE_AUDIO_SOURCE_LENGTH = 1024;

function selectRestoredAudioUrl(record: LocalLibraryRecord) {
  return [...record.media].reverse().find(isUsableAudioMedia)?.url || '';
}

function isUsableAudioMedia(media: LocalLibraryRecord['media'][number]) {
  if (!media?.url) return false;
  if (typeof media.source !== 'string') return true;
  if (/^https?:\/\//i.test(media.source) || /^data:/i.test(media.source)) return true;
  return media.source.replace(/\s/g, '').length >= MIN_INLINE_AUDIO_SOURCE_LENGTH;
}

export function useMusicStore() {
  const init = async () => {
    const saved = readStorage(STORAGE_KEY);
    if (saved) {
      removeStorage(STORAGE_KEY);
    }
    const records = await loadLocalLibraryRecords('audio');
    const restored = records
      .map(record => ({
        id: record.id,
        prompt: record.prompt,
        lyrics: typeof (record.response as any)?.lyrics === 'string' ? (record.response as any).lyrics : '',
        url: selectRestoredAudioUrl(record),
        timestamp: Date.parse(record.createdAt) || Date.now(),
      }))
      .filter(item => item.url)
      .slice(0, MAX_ITEMS);

    musics.value.forEach(m => {
      if (m.url.startsWith('blob:')) {
        URL.revokeObjectURL(m.url);
      }
    });
    musics.value = restored;
    currentMusic.value = restored[0] || null;
    isPlaying.value = false;
  };

  const addMusic = async (musicData: { id: string, prompt: string, lyrics: string, audioHex: string, timestamp: number }) => {
    await saveLocalLibraryRecord('audio', musicData.prompt, {
      data: { audio: musicData.audioHex },
      lyrics: musicData.lyrics,
      id: musicData.id,
    });
    downloadMediaFromResponse(
      { data: { audio: musicData.audioHex } },
      { kind: 'audio', prompt: musicData.prompt, fallbackId: musicData.id }
    );
    
    const newMusic: MusicItem = {
      id: musicData.id,
      prompt: musicData.prompt,
      lyrics: musicData.lyrics,
      url: buildMediaObjectUrlFromHex(musicData.audioHex),
      timestamp: musicData.timestamp
    };
    
    musics.value.unshift(newMusic);
    
    // 3. Handle truncation
    if (musics.value.length > MAX_ITEMS) {
      const removed = musics.value.pop();
      if (removed) {
        URL.revokeObjectURL(removed.url);
      }
    }
    
    return newMusic;
  };

  const playMusic = (music: MusicItem) => {
    currentMusic.value = music;
    isPlaying.value = true;
    if (audioRef.value) {
      if (audioRef.value.src !== music.url) {
        audioRef.value.src = music.url;
      }
      audioRef.value.play().catch(e => console.error('Playback failed:', e));
    }
  };

  const togglePlay = () => {
    if (!audioRef.value) return;
    if (isPlaying.value) {
      audioRef.value.pause();
    } else {
      audioRef.value.play().catch(e => console.error('Playback failed:', e));
    }
    isPlaying.value = !isPlaying.value;
  };

  const clearLibrary = async () => {
    musics.value.forEach(m => {
      if (m.url.startsWith('blob:')) {
        URL.revokeObjectURL(m.url);
      }
    });
    musics.value = [];
    currentMusic.value = null;
    isPlaying.value = false;
    removeStorage(STORAGE_KEY);
  };

  return {
    musics,
    currentMusic,
    isPlaying,
    audioRef,
    init,
    addMusic,
    playMusic,
    togglePlay,
    clearLibrary
  };
}
