<template>
  <div class="log-viewer" :class="{ 'is-collapsed': collapsed }">
    <button
      v-if="collapsed"
      class="log-float-btn"
      type="button"
      aria-label="双击展开运行日志"
      title="双击展开运行日志"
      @dblclick="expandLogs"
      @keyup.enter="expandLogs"
      @keyup.space="expandLogs"
    >
      <span class="float-glyph" aria-hidden="true">
        <span></span>
        <span></span>
        <span></span>
      </span>
      <span v-if="logs.length" class="float-count" aria-hidden="true">{{ logs.length }}</span>
    </button>

    <template v-else>
      <div class="log-header">
        <h3>运行日志 (Execution Logs)</h3>
        <div class="log-actions">
          <button class="collapse-btn" type="button" @click="collapseLogs" aria-label="折叠运行日志" title="折叠运行日志">
            <span aria-hidden="true"></span>
          </button>
          <button class="clear-btn" type="button" @click="clearLogs">清空</button>
        </div>
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
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { logger, type LogEntry } from '../utils/logger';

defineProps<{
  collapsed?: boolean;
}>();

const emit = defineEmits<{
  'update:collapsed': [value: boolean];
}>();

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

const collapseLogs = () => {
  emit('update:collapsed', true);
};

const expandLogs = () => {
  emit('update:collapsed', false);
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

.log-viewer.is-collapsed {
  display: block;
  width: 0;
  height: 0;
  min-width: 0;
  overflow: visible;
  background: transparent;
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
}

.log-actions {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.collapse-btn,
.clear-btn,
.log-float-btn {
  cursor: pointer;
  transition: transform var(--motion-fast), background-color var(--motion-med), color var(--motion-med), border-color var(--motion-med), box-shadow var(--motion-med);
}

.collapse-btn,
.clear-btn {
  background: transparent;
  color: var(--text-muted);
  border: 1px solid var(--border-strong);
  border-radius: 6px;

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

.collapse-btn {
  width: 30px;
  height: 28px;
  padding: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;

  span {
    width: 12px;
    height: 12px;
    border-left: 2px solid currentColor;
    border-bottom: 2px solid currentColor;
    transform: rotate(45deg) translate(2px, -2px);
  }
}

.clear-btn {
  padding: 4px 12px;
  font-size: 12px;
}

.log-float-btn {
  position: fixed;
  right: 28px;
  bottom: 28px;
  z-index: 30;
  width: 54px;
  height: 54px;
  padding: 0;
  border: 1px solid var(--border-strong);
  border-radius: 14px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: var(--panel-bg);
  color: var(--text-primary);
  box-shadow: var(--shadow-lg);
  backdrop-filter: blur(16px);

  &:hover {
    border-color: var(--accent-primary);
    box-shadow: var(--shadow-lg), var(--shadow-glow);
    transform: translateY(-2px);
  }

  &:active {
    transform: scale(0.96);
  }
}

.float-glyph {
  width: 24px;
  height: 22px;
  border: 2px solid currentColor;
  border-radius: 5px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 3px;
  padding: 4px;

  span {
    display: block;
    height: 2px;
    border-radius: 999px;
    background: currentColor;
  }
}

.float-count {
  position: absolute;
  top: -7px;
  right: -7px;
  min-width: 22px;
  height: 22px;
  padding: 0 5px;
  border: 2px solid var(--bg-base);
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: var(--accent-primary);
  color: var(--text-on-accent);
  font-family: var(--font-sans);
  font-size: 11px;
  font-weight: 800;
  line-height: 1;
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
