<template>
  <div class="search-panel panel">
    <h2>联网搜索 (Web Search)</h2>
    <QuotaSummary title="联网搜索配额" :model-patterns="['coding-plan-search']" />
    <div class="input-group">
      <input 
        v-model="query" 
        class="search-input" 
        type="text" 
        placeholder="输入搜索关键词，例如：Python 3.12 新特性" 
        @keyup.enter="performSearch"
        :disabled="loading"
      />
      <button class="btn search-btn" :class="{ loading: loading }" 
        @click="performSearch" 
        :disabled="loading || !query.trim()"
      >
        {{ loading ? 'Searching...' : 'Search' }}
      </button>
    </div>
    <ApiProgress v-if="loading" title="正在联网搜索" detail="搜索请求已提交，正在聚合结果并解析结构化内容" />
    <p
      v-if="error"
      class="error-message"
      role="alert"
    >
      {{ error }}
    </p>

    <!-- 搜索历史 -->
    <InputHistory 
      :history="history" 
      title="最近搜索"
      @select="selectHistory"
      @delete="deleteHistory"
      @clear="clearHistory"
    />

    <!-- 搜索结果 -->
    <div v-if="result" class="result-box">
      <div class="result-header">
        <div>
          <h4>搜索结果:</h4>
          <p v-if="organicResults.length > 0" class="result-count">
            MiniMax 本次返回 {{ organicResults.length }} 条
          </p>
        </div>
        <div class="view-toggle">
          <button :class="{ active: viewMode === 'panel' }" @click="viewMode = 'panel'">面板展示</button>
          <button :class="{ active: viewMode === 'json' }" @click="viewMode = 'json'">JSON</button>
        </div>
      </div>
      
      <!-- Panel View -->
      <div v-if="viewMode === 'panel'" class="panel-view">
        <div v-if="organicResults.length > 0" class="organic-results">
          <div v-for="(item, idx) in organicResults" :key="item.link || idx" class="organic-item">
            <a :href="item.link" target="_blank" rel="noopener noreferrer" class="item-title">{{ item.title }}</a>
            <p class="item-snippet">{{ item.snippet }}</p>
            <a :href="item.link" target="_blank" rel="noopener noreferrer" class="item-link">{{ item.link }}</a>
          </div>
        </div>
        <div v-else class="no-results">
          暂无解析结果，请查看 JSON 视图。
        </div>
      </div>
      
      <!-- JSON View -->
      <pre v-if="viewMode === 'json'">{{ formatResult(result) }}</pre>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { searchWeb } from '../api/client';
import InputHistory from './InputHistory.vue';
import ApiProgress from './ApiProgress.vue';
import QuotaSummary from './QuotaSummary.vue';
import { useHistory } from '../composables/useHistory';
import { readJsonStorage, writeJsonStorage } from '../utils/safeStorage';

type ViewMode = 'panel' | 'json';

type SearchResultCache = {
  query: string;
  result: unknown;
  viewMode?: ViewMode;
  savedAt: number;
};

const query = ref('');
const loading = ref(false);
const result = ref<any>(null);
const error = ref('');
const viewMode = ref<ViewMode>('panel');
const lastResultQuery = ref('');
const searchResultCacheKey = 'mmx_search_last_result';

const { history, addToHistory, deleteHistory, clearHistory } = useHistory('mmx_search_history');

const isSearchResultCache = (value: unknown): value is SearchResultCache => {
  if (!value || typeof value !== 'object') return false;
  const cache = value as Partial<SearchResultCache>;
  return typeof cache.query === 'string'
    && typeof cache.savedAt === 'number'
    && typeof cache.result !== 'undefined';
};

const saveSearchResultCache = () => {
  if (!lastResultQuery.value.trim() || !result.value) return;
  writeJsonStorage(searchResultCacheKey, {
    query: lastResultQuery.value,
    result: result.value,
    viewMode: viewMode.value,
    savedAt: Date.now(),
  });
};

onMounted(() => {
  const cache = readJsonStorage<SearchResultCache>(searchResultCacheKey, isSearchResultCache);
  if (!cache) return;

  query.value = cache.query;
  lastResultQuery.value = cache.query;
  result.value = cache.result;
  viewMode.value = cache.viewMode === 'json' ? 'json' : 'panel';
});

const selectHistory = (item: string) => {
  query.value = item;
  performSearch();
};

const performSearch = async () => {
  if (!query.value.trim() || loading.value) return;
  
  loading.value = true;
  result.value = null;
  error.value = '';
  addToHistory(query.value);
  
  try {
    const res = await searchWeb(query.value);
    lastResultQuery.value = query.value.trim();
    result.value = res;
    viewMode.value = 'panel'; // Default to panel
    saveSearchResultCache();
  } catch (err) {
    error.value = err instanceof Error ? err.message : '搜索失败，请检查设置或稍后重试。';
  } finally {
    loading.value = false;
  }
};

const formatResult = (data: any) => {
  return JSON.stringify(data, null, 2);
};

const organicResults = computed(() => (
  Array.isArray(result.value?.organic) ? result.value.organic : []
));

watch(viewMode, saveSearchResultCache);
</script>

<style lang="less" scoped>
@import '../styles/panel.less';

.result-box {
  margin-top: 24px;

  .result-count {
    margin: 6px 0 0;
    color: var(--text-muted);
    font-size: 12px;
    font-variant-numeric: tabular-nums;
  }
  
  .result-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
    
    h4 {
      margin: 0;
      color: var(--text-primary);
    }
    
    .view-toggle {
      display: flex;
      background: var(--control-bg);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-md);
      padding: 3px;
      
      button {
        background: transparent;
        border: none;
        min-height: 32px;
        padding: 4px 12px;
        font-size: 12px;
        border-radius: 7px;
        cursor: pointer;
        color: var(--text-secondary);
        transition: transform var(--motion-fast), background-color var(--motion-med), color var(--motion-med), box-shadow var(--motion-med);
        
        &.active {
          background: var(--bg-surface);
          color: var(--text-primary);
          box-shadow: var(--shadow-sm);
        }
        
        &:not(.active):hover {
          color: var(--text-primary);
          transform: translateY(-1px);
        }

        &:active {
          transform: scale(0.97);
        }
      }
    }
  }
  
  .panel-view {
    .organic-results {
      display: flex;
      flex-direction: column;
      gap: 16px;
      
      .organic-item {
        background: var(--control-bg);
        padding: 16px;
        border-radius: var(--radius-md);
        border: 1px solid var(--border-subtle);
        transition: transform var(--motion-med), box-shadow var(--motion-med), border-color var(--motion-med);
        
        &:hover {
          transform: translateY(-2px);
          box-shadow: var(--shadow-md);
          border-color: var(--border-strong);
        }
        
        .item-title {
          display: block;
          font-size: 16px;
          font-weight: 600;
          color: var(--accent-primary);
          text-decoration: none;
          margin-bottom: 8px;
          
          &:hover {
            text-decoration: underline;
          }
        }
        
        .item-snippet {
          font-size: 14px;
          color: var(--text-primary);
          line-height: 1.5;
          margin: 0 0 8px 0;
        }
        
        .item-link {
          font-size: 12px;
          color: var(--text-muted);
          text-decoration: none;
          word-break: break-all;
        }
      }
    }
    
    .no-results {
      padding: 24px;
      text-align: center;
      color: var(--text-secondary);
      background: var(--control-bg);
      border-radius: var(--radius-md);
      border: 1px dashed var(--border-strong);
    }
  }
}

@media (max-width: 640px) {
  .result-box {
    .result-header {
      align-items: stretch;
      flex-direction: column;
      gap: 12px;

      .view-toggle {
        align-self: flex-start;
      }
    }
  }
}
</style>
