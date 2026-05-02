<template>
  <div class="video-gen-panel panel">
    <h2>视频生成 (Video Generation)</h2>
    <QuotaSummary
      title="视频生成配额"
      :model-patterns="['Hailuo']"
    />
    <div class="input-group">
      <textarea
        v-model="prompt" 
        placeholder="输入视频提示词，例如：海浪在日落时分拍打沙滩" 
        rows="4"
        :disabled="loading"
      />
      <div class="generation-options">
        <div class="field">
          <label for="video-model">模型</label>
          <select
            id="video-model"
            v-model="model"
            :disabled="loading"
          >
            <option
              v-for="option in modelOptions"
              :key="option"
              :value="option"
            >
              {{ option }}
            </option>
          </select>
        </div>
        <div class="field">
          <label for="video-duration">时长</label>
          <select
            id="video-duration"
            v-model.number="duration"
            :disabled="loading"
          >
            <option
              v-for="option in durationOptions"
              :key="option"
              :value="option"
            >
              {{ option }} 秒
            </option>
          </select>
        </div>
        <div class="field">
          <label for="video-resolution">清晰度</label>
          <select
            id="video-resolution"
            v-model="resolution"
            :disabled="loading"
          >
            <option
              v-for="option in resolutionOptions"
              :key="option"
              :value="option"
            >
              {{ option }}
            </option>
          </select>
        </div>
        <label class="check-field">
          <input
            v-model="promptOptimizer"
            type="checkbox"
            :disabled="loading"
          >
          优化提示词
        </label>
        <label class="check-field">
          <input
            v-model="fastPretreatment"
            type="checkbox"
            :disabled="loading || !isHailuoModel"
          >
          快速预处理
        </label>
        <label class="check-field">
          <input
            v-model="watermark"
            type="checkbox"
            :disabled="loading"
          >
          添加水印
        </label>
      </div>
      <button
        class="btn"
        :class="{ loading: loading }"
        :disabled="loading || !prompt.trim()"
        @click="performGen"
      >
        {{ loading ? 'Generating...' : 'Generate Video' }}
      </button>
    </div>
    <ApiProgress
      v-if="loading"
      title="正在生成视频"
      detail="视频任务已提交，正在等待生成接口返回"
    />

    <!-- 输入历史 -->
    <InputHistory 
      :history="history" 
      title="最近输入"
      @select="selectHistory"
      @delete="deleteHistory"
      @clear="clearHistory"
    />

    <div
      v-if="result"
      class="result-box"
    >
      <h4>生成结果:</h4>
      <pre>{{ formatResult(result) }}</pre>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { generateVideo, type VideoModel, type VideoResolution } from '../api/client';
import InputHistory from './InputHistory.vue';
import ApiProgress from './ApiProgress.vue';
import QuotaSummary from './QuotaSummary.vue';
import { useHistory } from '../composables/useHistory';
import { downloadMediaFromResponse } from '../utils/fileExport';
import { saveLocalLibraryRecord } from '../utils/localLibrary';

const prompt = ref('');
const loading = ref(false);
const result = ref<any>(null);
const model = ref<VideoModel>('MiniMax-Hailuo-2.3');
const duration = ref(6);
const resolution = ref<VideoResolution>('768P');
const promptOptimizer = ref(true);
const fastPretreatment = ref(false);
const watermark = ref(false);

const { history, addToHistory, deleteHistory, clearHistory } = useHistory('mmx_video_history');

const modelOptions: VideoModel[] = ['MiniMax-Hailuo-2.3', 'MiniMax-Hailuo-02', 'T2V-01-Director', 'T2V-01'];
const isHailuoVideoModel = (value: VideoModel) => value === 'MiniMax-Hailuo-2.3' || value === 'MiniMax-Hailuo-02';
const isHailuoModel = computed(() => isHailuoVideoModel(model.value));
const durationOptions = computed(() => (isHailuoModel.value ? [6, 10] : [6]));
const resolutionOptions = computed<VideoResolution[]>(() => {
  if (!isHailuoModel.value) return ['720P', '1080P'];
  return duration.value === 10 ? ['768P'] : ['768P', '1080P'];
});

watch([model, duration], () => {
  if (!durationOptions.value.includes(duration.value)) {
    duration.value = durationOptions.value[0];
  }
  if (!resolutionOptions.value.includes(resolution.value)) {
    resolution.value = resolutionOptions.value[0];
  }
  if (!isHailuoModel.value) {
    fastPretreatment.value = false;
  }
});

const selectHistory = (item: string) => {
  prompt.value = item;
};

const performGen = async () => {
  if (!prompt.value.trim() || loading.value) return;
  loading.value = true;
  result.value = null;
  addToHistory(prompt.value);
  try {
    result.value = await generateVideo(prompt.value, {
      model: model.value,
      duration: duration.value,
      resolution: resolution.value,
      promptOptimizer: promptOptimizer.value,
      fastPretreatment: fastPretreatment.value,
      watermark: watermark.value,
    });
    await saveLocalLibraryRecord('video', prompt.value, result.value);
    downloadMediaFromResponse(result.value, { kind: 'video', prompt: prompt.value });
  } finally {
    loading.value = false;
  }
};

const formatResult = (data: any) => JSON.stringify(data, null, 2);
</script>

<style lang="less" scoped>
@import '../styles/panel.less';

.generation-options {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 8px;

  label {
    color: var(--text-secondary);
    font-size: 13px;
    font-weight: 700;
  }

  select {
    min-height: 46px;
    padding: 10px 12px;
    color: var(--text-primary);
    background: var(--control-bg);
    border: 1px solid var(--border-strong);
    border-radius: var(--radius-md);
  }
}

.check-field {
  min-height: 46px;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: var(--text-secondary);
  font-size: 13px;
  font-weight: 700;
}

@media (max-width: 800px) {
  .generation-options {
    grid-template-columns: 1fr;
  }
}
</style>
