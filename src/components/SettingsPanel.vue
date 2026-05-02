<template>
  <div class="settings-panel panel">
    <h2>设置与配额 (Settings & Quota)</h2>
    <div class="input-group">
      <label>API Token:</label>
      <div class="token-input-wrapper">
        <textarea 
          v-model="token" 
          :class="{ 'masked': !showToken }"
          placeholder="输入 MINIMAX_TOKEN" 
          @change="updateToken"
          rows="2"
        ></textarea>
        <div class="input-actions">
          <button class="icon-btn" @click="showToken = !showToken" :title="showToken ? '隐藏 Token' : '显示 Token'">
            <svg v-if="!showToken" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
            <svg v-else xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
          </button>
          <button class="icon-btn" @click="copyToken" title="复制 Token">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path><rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect></svg>
          </button>
        </div>
      </div>
      <button class="btn" :class="{ loading: loading }" @click="performCheckQuota" :disabled="loading || !token.trim()">
        {{ loading ? 'Checking...' : 'Check Quota' }}
      </button>
    </div>
    <ApiProgress v-if="loading" title="正在检查账户配额" detail="Token 已保存，正在请求 MiniMax 配额接口" />
    <div v-if="result" class="result-box">
      <h4>配额信息 (Quota Details):</h4>
      
      <div v-if="result.model_remains && result.model_remains.length > 0" class="quota-cards">
        <div v-for="(item, index) in result.model_remains" :key="index" class="quota-card">
          <div class="card-header">
            <span class="model-name">{{ item.model_name || 'Unknown Model' }}</span>
          </div>
          <div class="card-body">
            <div class="quota-row">
              <span class="label" title="当前区间总量 (Interval Total)">区间总量 (Total):</span>
              <span class="value">{{ item.current_interval_total_count ?? '-' }}</span>
            </div>
            <div class="quota-row">
              <span class="label" title="当前区间已用 (Interval Used)">区间已用 (Used):</span>
              <span class="value highlight-used">{{ item.current_interval_usage_count ?? '-' }}</span>
            </div>
            <div class="quota-row">
              <span class="label" title="本周总量 (Weekly Total)">本周总量 (Weekly Total):</span>
              <span class="value">{{ item.current_weekly_total_count ?? '-' }}</span>
            </div>
            <div class="quota-row">
              <span class="label" title="本周已用 (Weekly Used)">本周已用 (Weekly Used):</span>
              <span class="value highlight-used">{{ item.current_weekly_usage_count ?? '-' }}</span>
            </div>
            <div class="quota-row" v-if="item.end_time">
              <span class="label">过期时间 (Expires):</span>
              <span class="value">{{ formatDate(item.end_time) }}</span>
            </div>
          </div>
        </div>
      </div>
      <div v-else>
        <pre>{{ formatResult(result) }}</pre>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { setApiToken, checkQuota, getApiToken } from '../api/client';
import ApiProgress from './ApiProgress.vue';

const token = ref(getApiToken());
const showToken = ref(false);
const loading = ref(false);
const result = ref<any>(null);

const copyToken = async () => {
  if (!token.value) return;
  try {
    await navigator.clipboard.writeText(token.value);
    alert('Token 已复制到剪贴板');
  } catch (err) {
    console.error('Failed to copy: ', err);
  }
};

const updateToken = () => {
  setApiToken(token.value);
};

const performCheckQuota = async () => {
  if (!token.value.trim() || loading.value) return;
  loading.value = true;
  result.value = null;
  try {
    result.value = await checkQuota();
  } finally {
    loading.value = false;
  }
};

onMounted(() => {
  if (token.value.trim()) {
    void performCheckQuota();
  }
});

const formatResult = (data: any) => JSON.stringify(data, null, 2);

const formatDate = (timestamp: number) => {
  if (!timestamp) return '-';
  // Check if timestamp is in seconds instead of milliseconds. Usually if it's < 1e12 it's seconds.
  const ms = timestamp < 1e12 ? timestamp * 1000 : timestamp;
  return new Date(ms).toLocaleString();
};
</script>

<style lang="less" scoped>
@import '../styles/panel.less';

.result-box {
  margin-top: 24px;
}

.token-input-wrapper {
  position: relative;
  width: 100%;
  display: flex;
  align-items: center;

  textarea {
    width: 100%;
    padding-right: 90px !important;
    font-family: var(--font-mono, monospace);
    
    &.masked {
      -webkit-text-security: disc;
    }
  }

  .input-actions {
    position: absolute;
    right: 8px;
    display: flex;
    gap: 4px;
  }

  .icon-btn {
    background: transparent;
    border: none;
    color: var(--text-muted);
    padding: 8px;
    border-radius: var(--radius-sm);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all var(--motion-fast);

    &:hover {
      background: var(--bg-surface-hover);
      color: var(--accent-primary);
    }

    &:active {
      transform: scale(0.92);
    }

    svg {
      display: block;
    }
  }
}

.quota-cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 16px;
  margin-top: 16px;
}

.quota-card {
  background: var(--control-bg);
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-lg);
  overflow: hidden;
  box-shadow: var(--shadow-sm);
  transition: transform var(--motion-med), box-shadow var(--motion-med), border-color var(--motion-med);
  
  &:hover {
    transform: translateY(-2px);
    box-shadow: var(--shadow-md);
    border-color: var(--accent-primary);
  }

  .card-header {
    background: var(--accent-soft);
    padding: 16px;
    border-bottom: 1px solid var(--border-subtle);
    
    .model-name {
      font-weight: 600;
      font-size: 1.1em;
      color: var(--text-primary);
    }
  }

  .card-body {
    padding: 16px;
    
    .quota-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 10px;
      font-size: 0.95em;
      
      &:last-child {
        margin-bottom: 0;
      }
      
      .label {
        color: var(--text-muted);
      }
      
      .value {
        font-weight: 500;
        color: var(--text-primary);
        
        &.highlight-used {
          color: var(--error);
        }
      }
    }
  }
}
</style>
