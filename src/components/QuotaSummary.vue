<template>
  <section class="quota-summary" aria-live="polite">
    <div class="quota-head">
      <div>
        <span class="eyebrow">Quota</span>
        <h3>{{ title }}</h3>
      </div>
      <button class="refresh-btn" type="button" :disabled="loading" @click="loadQuota">
        {{ loading ? '刷新中' : '刷新' }}
      </button>
    </div>

    <div v-if="loading" class="quota-state">
      <span class="pulse" aria-hidden="true"></span>
      正在查询可用配额...
    </div>

    <div v-else-if="error" class="quota-state error">
      {{ error }}
    </div>

    <div v-else-if="visibleItems.length > 0" class="quota-grid">
      <article v-for="item in visibleItems" :key="item.model_name" class="quota-card">
        <div class="model-row">
          <strong>{{ item.model_name }}</strong>
          <span>{{ formatPercent(item.current_interval_usage_count, item.current_interval_total_count) }}</span>
        </div>
        <div class="metric-row">
          <span>本周期剩余</span>
          <strong>{{ remaining(item.current_interval_total_count, item.current_interval_usage_count) }} / {{ formatCount(item.current_interval_total_count) }}</strong>
        </div>
        <div class="meter" aria-hidden="true">
          <span :style="{ width: usageWidth(item.current_interval_usage_count, item.current_interval_total_count) }"></span>
        </div>
        <div class="metric-row muted">
          <span>本周剩余</span>
          <strong>{{ remaining(item.current_weekly_total_count, item.current_weekly_usage_count) }} / {{ formatCount(item.current_weekly_total_count) }}</strong>
        </div>
        <div class="reset-row">
          重置：{{ formatDate(item.end_time) }}
        </div>
      </article>
    </div>

    <div v-else class="quota-state">
      没有找到当前功能对应的配额项。
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { checkQuota } from '../api/client';

interface QuotaItem {
  model_name?: string;
  current_interval_total_count?: number;
  current_interval_usage_count?: number;
  current_weekly_total_count?: number;
  current_weekly_usage_count?: number;
  end_time?: number;
}

const props = withDefaults(defineProps<{
  title: string;
  modelPatterns: string[];
}>(), {
  modelPatterns: () => []
});

const loading = ref(false);
const error = ref('');
const items = ref<QuotaItem[]>([]);

const visibleItems = computed(() => {
  if (props.modelPatterns.length === 0) {
    return items.value.slice(0, 3);
  }

  const patterns = props.modelPatterns.map(pattern => pattern.toLowerCase());
  return items.value.filter(item => {
    const name = (item.model_name || '').toLowerCase();
    return patterns.some(pattern => name.includes(pattern));
  });
});

const loadQuota = async () => {
  loading.value = true;
  error.value = '';
  try {
    const result = await checkQuota();
    items.value = Array.isArray(result?.model_remains) ? result.model_remains : [];
  } catch (err: any) {
    error.value = err?.message || '配额查询失败';
  } finally {
    loading.value = false;
  }
};

const remaining = (total = 0, used = 0) => formatCount(Math.max(total - used, 0));
const formatCount = (value = 0) => new Intl.NumberFormat().format(value);
const formatPercent = (used = 0, total = 0) => {
  if (!total) return '0% used';
  return `${Math.min(Math.round((used / total) * 100), 100)}% used`;
};
const usageWidth = (used = 0, total = 0) => {
  if (!total) return '0%';
  return `${Math.min((used / total) * 100, 100)}%`;
};
const formatDate = (timestamp = 0) => {
  if (!timestamp) return '-';
  const ms = timestamp < 1e12 ? timestamp * 1000 : timestamp;
  return new Date(ms).toLocaleString();
};

onMounted(loadQuota);
</script>

<style lang="less" scoped>
.quota-summary {
  margin: -6px 0 22px;
  padding: 16px;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-lg);
  background:
    linear-gradient(135deg, var(--accent-soft), transparent 58%),
    var(--control-bg);
  box-shadow: var(--shadow-sm);
}

.quota-head {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: center;
  margin-bottom: 12px;

  .eyebrow {
    display: block;
    color: var(--text-muted);
    font-size: 11px;
    font-weight: 800;
    text-transform: uppercase;
  }

  h3 {
    margin: 2px 0 0;
    font-size: 15px;
    font-weight: 760;
  }
}

.refresh-btn {
  min-height: 34px;
  padding: 0 12px;
  border: 1px solid var(--border-strong);
  border-radius: 999px;
  color: var(--text-secondary);
  background: var(--bg-surface);
  cursor: pointer;
  font-size: 12px;
  font-weight: 700;
  transition: transform var(--motion-fast), border-color var(--motion-med), color var(--motion-med);

  &:hover:not(:disabled) {
    transform: translateY(-1px);
    border-color: var(--accent-primary);
    color: var(--text-primary);
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.65;
  }
}

.quota-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 10px;
}

.quota-card {
  padding: 12px;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  background: var(--bg-surface);
}

.model-row,
.metric-row {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: baseline;
}

.model-row {
  margin-bottom: 10px;

  strong {
    min-width: 0;
    color: var(--text-primary);
    font-size: 13px;
  }

  span {
    flex: 0 0 auto;
    color: var(--text-muted);
    font-size: 11px;
    font-weight: 700;
  }
}

.metric-row {
  color: var(--text-secondary);
  font-size: 12px;

  strong {
    color: var(--text-primary);
    font-variant-numeric: tabular-nums;
  }

  &.muted {
    margin-top: 8px;
  }
}

.meter {
  height: 5px;
  margin-top: 8px;
  overflow: hidden;
  border-radius: 999px;
  background: var(--bg-surface-active);

  span {
    display: block;
    height: 100%;
    min-width: 2px;
    border-radius: inherit;
    background: var(--accent-gradient);
    transition: width var(--motion-med);
  }
}

.reset-row,
.quota-state {
  margin-top: 10px;
  color: var(--text-muted);
  font-size: 12px;
}

.quota-state {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 0;
  min-height: 34px;

  &.error {
    color: var(--error);
  }
}

.pulse {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--accent-primary);
  box-shadow: 0 0 0 0 var(--accent-glow);
  animation: pulse 1.2s infinite;
}

@keyframes pulse {
  to {
    box-shadow: 0 0 0 10px transparent;
  }
}
</style>
