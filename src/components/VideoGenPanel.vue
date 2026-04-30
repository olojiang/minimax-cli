<template>
  <div class="video-gen-panel panel">
    <h2>视频生成 (Video Generation)</h2>
    <QuotaSummary title="视频生成配额" :model-patterns="['Hailuo']" />
    <div class="input-group">
      <input 
        v-model="prompt" 
        type="text" 
        placeholder="输入视频提示词，例如：海浪在日落时分拍打沙滩" 
        @keyup.enter="performGen"
        :disabled="loading"
      />
      <button class="btn" :class="{ loading: loading }" @click="performGen" :disabled="loading || !prompt.trim()">
        {{ loading ? 'Generating...' : 'Generate Video' }}
      </button>
    </div>
    <ApiProgress v-if="loading" title="正在生成视频" detail="视频任务已提交，正在等待生成接口返回" />

    <!-- 输入历史 -->
    <InputHistory 
      :history="history" 
      title="最近输入"
      @select="selectHistory"
      @delete="deleteHistory"
      @clear="clearHistory"
    />

    <div v-if="result" class="result-box">
      <h4>生成结果:</h4>
      <pre>{{ formatResult(result) }}</pre>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { generateVideo } from '../api/client';
import InputHistory from './InputHistory.vue';
import ApiProgress from './ApiProgress.vue';
import QuotaSummary from './QuotaSummary.vue';
import { useHistory } from '../composables/useHistory';
import { downloadMediaFromResponse } from '../utils/fileExport';

const prompt = ref('');
const loading = ref(false);
const result = ref<any>(null);

const { history, addToHistory, deleteHistory, clearHistory } = useHistory('mmx_video_history');

const selectHistory = (item: string) => {
  prompt.value = item;
  performGen();
};

const performGen = async () => {
  if (!prompt.value.trim() || loading.value) return;
  loading.value = true;
  result.value = null;
  addToHistory(prompt.value);
  try {
    result.value = await generateVideo(prompt.value);
    downloadMediaFromResponse(result.value, { kind: 'video', prompt: prompt.value });
  } finally {
    loading.value = false;
  }
};

const formatResult = (data: any) => JSON.stringify(data, null, 2);
</script>

<style lang="less" scoped>
@import '../styles/panel.less';
</style>
