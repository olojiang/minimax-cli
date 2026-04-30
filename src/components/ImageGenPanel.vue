<template>
  <div class="image-gen-panel panel">
    <h2>图像生成 (Image Generation)</h2>
    <QuotaSummary title="图像生成配额" :model-patterns="['image-01', 'abab-image']" />
    <div class="input-group">
      <input 
        v-model="prompt" 
        type="text" 
        placeholder="输入画面描述，例如：一只穿宇航服的猫咪在太空中" 
        @keyup.enter="performGen"
        :disabled="loading"
      />
      <button class="btn" :class="{ loading: loading }" @click="performGen" :disabled="loading || !prompt.trim()">
        {{ loading ? 'Generating...' : 'Generate Image' }}
      </button>
    </div>
    <ApiProgress v-if="loading" title="正在生成图像" detail="提示词已提交，正在创建图像任务并等待结果" />

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
      <!-- We assume the API returns a base64 or URL in result.data or result.url -->
      <pre>{{ formatResult(result) }}</pre>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { generateImage } from '../api/client';
import InputHistory from './InputHistory.vue';
import ApiProgress from './ApiProgress.vue';
import QuotaSummary from './QuotaSummary.vue';
import { useHistory } from '../composables/useHistory';
import { downloadMediaFromResponse } from '../utils/fileExport';

const prompt = ref('');
const loading = ref(false);
const result = ref<any>(null);

const { history, addToHistory, deleteHistory, clearHistory } = useHistory('mmx_image_history');

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
    result.value = await generateImage(prompt.value);
    downloadMediaFromResponse(result.value, { kind: 'image', prompt: prompt.value });
  } finally {
    loading.value = false;
  }
};

const formatResult = (data: any) => JSON.stringify(data, null, 2);
</script>

<style lang="less" scoped>
@import '../styles/panel.less';
</style>
