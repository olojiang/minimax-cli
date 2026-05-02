import { ref, watch, onMounted } from 'vue';
import { readJsonStorage, writeJsonStorage } from '../utils/safeStorage';

export function useHistory(storageKey: string, maxItems: number = 10) {
  const history = ref<string[]>([]);

  onMounted(() => {
    const saved = readJsonStorage<string[]>(
      storageKey,
      (value): value is string[] => Array.isArray(value) && value.every(item => typeof item === 'string'),
    );
    if (saved) {
      history.value = saved.slice(0, maxItems);
    }
  });

  watch(history, (newHistory) => {
    writeJsonStorage(storageKey, newHistory);
  }, { deep: true });

  const addToHistory = (query: string) => {
    const tq = query.trim();
    if (!tq) return;
    
    const idx = history.value.indexOf(tq);
    if (idx !== -1) {
      history.value.splice(idx, 1);
    }
    history.value.unshift(tq);
    
    if (history.value.length > maxItems) {
      history.value = history.value.slice(0, maxItems);
    }
  };

  const deleteHistory = (index: number) => {
    history.value.splice(index, 1);
  };

  const clearHistory = () => {
    history.value = [];
  };

  return {
    history,
    addToHistory,
    deleteHistory,
    clearHistory
  };
}
