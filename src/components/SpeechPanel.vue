<template>
  <div class="speech-panel panel">
    <h2>语音合成 (Speech Synthesis)</h2>
    <QuotaSummary title="语音合成配额" :model-patterns="['speech-hd', 'speech-01']" />
    <div class="input-group">
      <input 
        v-model="text" 
        type="text" 
        placeholder="输入需要合成的文本，例如：你好，欢迎使用 MiniMax" 
        @keyup.enter="performSynth"
        :disabled="loading"
      />
      <button class="btn" :class="{ loading: loading }" @click="performSynth" :disabled="loading || !text.trim()">
        {{ loading ? 'Synthesizing...' : 'Synthesize Speech' }}
      </button>
    </div>
    <ApiProgress v-if="loading" title="正在合成语音" detail="文本已提交，正在生成音频数据" />

    <!-- 输入历史 -->
    <InputHistory 
      :history="history" 
      title="最近输入"
      @select="selectHistory"
      @delete="deleteHistory"
      @clear="clearHistory"
    />

    <div v-if="result" class="result-box">
      <h4>合成结果:</h4>
      <!-- Provide audio element if base64 or url is returned -->
      <pre>{{ formatResult(result) }}</pre>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { synthesizeSpeech } from '../api/client';
import InputHistory from './InputHistory.vue';
import ApiProgress from './ApiProgress.vue';
import QuotaSummary from './QuotaSummary.vue';
import { useHistory } from '../composables/useHistory';
import { downloadMediaFromResponse } from '../utils/fileExport';

const text = ref('');
const loading = ref(false);
const result = ref<any>(null);

const { history, addToHistory, deleteHistory, clearHistory } = useHistory('mmx_speech_history');

const selectHistory = (item: string) => {
  text.value = item;
  performSynth();
};

const performSynth = async () => {
  if (!text.value.trim() || loading.value) return;
  loading.value = true;
  result.value = null;
  addToHistory(text.value);
  try {
    result.value = await synthesizeSpeech(text.value);
    downloadMediaFromResponse(result.value, { kind: 'audio', prompt: text.value });
  } finally {
    loading.value = false;
  }
};

const formatResult = (data: any) => JSON.stringify(data, null, 2);
</script>

<style lang="less" scoped>
@import '../styles/panel.less';
</style>
