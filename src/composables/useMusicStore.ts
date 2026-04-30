import { ref } from 'vue';
import { buildMediaObjectUrlFromHex, downloadMediaFromResponse } from '../utils/fileExport';

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

export function useMusicStore() {
  const init = () => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch (e) {
        console.error('Failed to load music library:', e);
      }
    }
  };

  const addMusic = async (musicData: { id: string, prompt: string, lyrics: string, audioHex: string, timestamp: number }) => {
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
    musics.value.forEach(m => URL.revokeObjectURL(m.url));
    musics.value = [];
    currentMusic.value = null;
    isPlaying.value = false;
    localStorage.removeItem(STORAGE_KEY);
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
