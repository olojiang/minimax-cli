<template>
  <div class="vision-panel panel">
    <h2>图像理解 (Vision)</h2>
    <QuotaSummary title="图像理解配额" :model-patterns="['coding-plan-vlm']" />
    <div class="input-group">
      <input 
        v-model="prompt" 
        class="prompt-input" 
        type="text" 
        placeholder="输入提示词，例如：请描述这张图" 
        :disabled="loading"
      />
      <input 
        class="file-input" 
        type="file" 
        accept="image/*" 
        @change="onFileChange" 
        :disabled="loading"
      />
      <button class="btn vision-btn" :class="{ loading: loading }" 
        @click="performVision" 
        :disabled="loading || !prompt.trim() || !selectedFile"
      >
        {{ loading ? 'Processing...' : 'Understand Image' }}
      </button>
    </div>
    <ApiProgress v-if="loading" title="正在解析图像" detail="图片与提示词已上传，正在调用视觉理解接口" />
    
    <div v-if="previewUrl" class="image-preview">
      <img :src="previewUrl" alt="Preview" />
    </div>
    
    <div v-if="result" class="result-box">
      <h4>解析结果:</h4>
      <pre>{{ formatResult(result) }}</pre>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { understandImage, fileToDataUrl } from '../api/client';
import ApiProgress from './ApiProgress.vue';
import QuotaSummary from './QuotaSummary.vue';

const prompt = ref('');
const loading = ref(false);
const result = ref<any>(null);
const selectedFile = ref<File | null>(null);
const previewUrl = ref<string>('');

const onFileChange = async (event: Event) => {
  const target = event.target as HTMLInputElement;
  if (target.files && target.files.length > 0) {
    selectedFile.value = target.files[0];
    previewUrl.value = await fileToDataUrl(selectedFile.value);
  } else {
    selectedFile.value = null;
    previewUrl.value = '';
  }
};

const performVision = async () => {
  if (!prompt.value.trim() || !selectedFile.value || loading.value) return;
  
  loading.value = true;
  result.value = null;
  
  try {
    const res = await understandImage(prompt.value, selectedFile.value);
    result.value = res;
  } catch (err) {
    // Error is handled and logged by the client
  } finally {
    loading.value = false;
  }
};

const formatResult = (data: any) => {
  return JSON.stringify(data, null, 2);
};
</script>

<style lang="less" scoped>
@import '../styles/panel.less';
.image-preview {
  margin-top: 24px;
  max-width: 200px;
  border: 1px solid var(--border-subtle);
  border-radius: 8px;
  padding: 4px;
  background-color: var(--bg-base);
  
  img {
    max-width: 100%;
    height: auto;
    display: block;
    border-radius: 4px;
  }
}
</style>
