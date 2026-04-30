import { ref, watch, onMounted } from 'vue';

export function useHistory(storageKey: string, maxItems: number = 10) {
  const history = ref<string[]>([]);

  onMounted(() => {
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      try {
        history.value = JSON.parse(saved);
      } catch (e) {
        // ignore
      }
    }
  });

  watch(history, (newHistory) => {
    localStorage.setItem(storageKey, JSON.stringify(newHistory));
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
