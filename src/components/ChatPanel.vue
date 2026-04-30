<template>
  <div class="chat-panel panel">
    <h2>文本对话 (Text Chat)</h2>
    <QuotaSummary title="文本对话配额" :model-patterns="['MiniMax-M']" />
    <div class="input-group">
      <input 
        v-model="message" 
        class="chat-input" 
        type="text" 
        placeholder="输入对话内容，例如：什么是 MiniMax？" 
        @keyup.enter="performChat"
        :disabled="loading"
      />
      <button class="btn chat-btn" :class="{ loading: loading }" 
        @click="performChat" 
        :disabled="loading || !message.trim()"
      >
        {{ loading ? 'Sending...' : 'Send' }}
      </button>
    </div>
    <ApiProgress v-if="loading" title="正在发送对话" detail="消息已提交，正在等待模型生成回复" />
    <div v-if="result" class="result-box">
      <h4>对话回复:</h4>
      <pre>{{ formatResult(result) }}</pre>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { textChat } from '../api/client';
import ApiProgress from './ApiProgress.vue';
import QuotaSummary from './QuotaSummary.vue';

const message = ref('');
const loading = ref(false);
const result = ref<any>(null);

const performChat = async () => {
  if (!message.value.trim() || loading.value) return;
  loading.value = true;
  result.value = null;
  try {
    const res = await textChat(message.value);
    result.value = res;
  } finally {
    loading.value = false;
  }
};

const formatResult = (data: any) => JSON.stringify(data, null, 2);
</script>

<style lang="less" scoped>
@import '../styles/panel.less';
</style>
