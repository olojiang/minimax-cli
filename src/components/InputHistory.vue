<template>
  <div v-if="history.length > 0" class="input-history">
    <div class="history-header">
      <span class="history-title">{{ title }}</span>
      <button class="history-clear" type="button" @click="$emit('clear')">清空</button>
    </div>
    <div class="history-list">
      <span 
        v-for="(item, index) in history" 
        :key="index" 
        class="history-item"
      >
        <button class="history-text" type="button" @click="$emit('select', item)">{{ item }}</button>
        <button class="history-delete" type="button" @click="$emit('delete', index)" aria-label="删除历史记录">×</button>
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  history: string[];
  title?: string;
}>(), {
  title: '最近记录'
});

defineEmits<{
  (e: 'select', item: string): void;
  (e: 'delete', index: number): void;
  (e: 'clear'): void;
}>();
</script>

<style lang="less" scoped>
.input-history {
  margin-top: 16px;
  
  .history-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
    font-size: 14px;
    
    .history-title {
      color: var(--text-secondary);
      font-weight: 500;
    }
    
    .history-clear {
      background: transparent;
      border: none;
      color: var(--text-muted);
      cursor: pointer;
      padding: 4px 6px;
      border-radius: var(--radius-sm);
      transition: transform var(--motion-fast), color var(--motion-med), background-color var(--motion-med);
      
      &:hover {
        color: var(--accent-primary);
        background: var(--accent-soft);
        transform: translateY(-1px);
      }
    }
  }
  
  .history-list {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    
    .history-item {
      display: inline-flex;
      align-items: center;
      background: var(--control-bg);
      border: 1px solid var(--border-subtle);
      border-radius: 16px;
      padding: 3px 6px 3px 10px;
      font-size: 13px;
      color: var(--text-primary);
      transition: transform var(--motion-fast), border-color var(--motion-med), background-color var(--motion-med), box-shadow var(--motion-med);
      
      &:hover {
        border-color: var(--accent-primary);
        background: var(--accent-soft);
        box-shadow: var(--shadow-sm);
        transform: translateY(-1px);
      }

      &:active {
        transform: scale(0.98);
      }
      
      .history-text {
        background: transparent;
        border: none;
        color: inherit;
        cursor: pointer;
        padding-right: 8px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        max-width: 250px;
      }
      
      .history-delete {
        background: transparent;
        border: none;
        cursor: pointer;
        color: var(--text-muted);
        font-weight: bold;
        font-size: 14px;
        line-height: 1;
        padding: 2px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        
        &:hover {
          color: var(--error);
          background: rgba(255, 0, 0, 0.1);
        }
      }
    }
  }
}
</style>
