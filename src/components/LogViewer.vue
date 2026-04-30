<template>
  <div class="log-viewer">
    <div class="log-header">
      <h3>运行日志 (Execution Logs)</h3>
      <button class="clear-btn" @click="clearLogs">清空</button>
    </div>
    <div class="log-content">
      <div 
        v-for="log in logs" 
        :key="log.id" 
        class="log-entry"
        :class="`log-${log.type}`"
      >
        <span class="log-time">[{{ formatTime(log.timestamp) }}]</span>
        <span class="log-type">[{{ log.type.toUpperCase() }}]</span>
        <span class="log-msg">{{ log.message }}</span>
        <pre v-if="log.data" class="log-data">{{ formatData(log.data) }}</pre>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { logger, type LogEntry } from '../utils/logger';

const logs = ref<LogEntry[]>([]);
let unsubscribe: () => void;

onMounted(() => {
  logs.value = logger.getLogs();
  unsubscribe = logger.subscribe((log) => {
    logs.value.push(log);
  });
});

onUnmounted(() => {
  if (unsubscribe) unsubscribe();
});

const clearLogs = () => {
  logger.clear();
  logs.value = [];
};

const formatTime = (date: Date) => {
  return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}:${date.getSeconds().toString().padStart(2, '0')}.${date.getMilliseconds().toString().padStart(3, '0')}`;
};

const formatData = (data: any) => {
  try {
    return JSON.stringify(data, null, 2);
  } catch (e) {
    return String(data);
  }
};
</script>

<style lang="less" scoped>
.log-viewer {
  display: flex;
  flex-direction: column;
  height: 100%;
  background:
    linear-gradient(180deg, var(--accent-soft), transparent 30%),
    var(--bg-base);
  color: var(--text-secondary);
  font-family: var(--font-mono);
}

.log-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background-color: var(--panel-bg);
  border-bottom: 1px solid var(--border-subtle);
  
  h3 {
    margin: 0;
    font-size: 14px;
    font-weight: 600;
    color: var(--text-primary);
  }
  
  .clear-btn {
    background: transparent;
    color: var(--text-muted);
    border: 1px solid var(--border-strong);
    padding: 4px 12px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 12px;
    transition: transform var(--motion-fast), background-color var(--motion-med), color var(--motion-med), border-color var(--motion-med);
    
    &:hover {
      background: var(--bg-surface-hover);
      color: var(--text-primary);
      border-color: var(--accent-primary);
      transform: translateY(-1px);
    }

    &:active {
      transform: scale(0.97);
    }
  }
}

.log-content {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 12px;
}

.log-entry {
  margin-bottom: 6px;
  font-size: 13px;
  line-height: 1.5;
  word-wrap: break-word;
  padding: 6px 8px;
  border-radius: 6px;
  transition: transform var(--motion-fast), background-color var(--motion-med);
  
  &:hover {
    background-color: var(--bg-surface-hover);
    transform: translateX(2px);
  }
}

.log-time {
  color: var(--text-muted);
  margin-right: 8px;
}

.log-type {
  margin-right: 8px;
  font-weight: 600;
}

.log-data {
  margin: 6px 0 0 24px;
  padding: 10px;
  background-color: var(--control-bg);
  border: 1px solid var(--border-subtle);
  border-radius: 6px;
  white-space: pre-wrap;
  color: var(--text-secondary);
}

/* Colors for different log types */
.log-info {
  .log-type { color: var(--accent-primary); }
}

.log-success {
  .log-type { color: var(--success); }
  background-color: rgba(34, 197, 94, 0.05);
}

.log-warn {
  .log-type { color: var(--warning); }
  background-color: rgba(234, 179, 8, 0.05);
}

.log-error {
  .log-type { color: var(--error); }
  .log-msg { color: var(--error); }
  background-color: rgba(239, 68, 68, 0.1);
}
</style>
