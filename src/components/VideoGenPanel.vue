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
      :detail="progressDetail"
    />
    <p
      v-if="error"
      class="error-message"
      role="alert"
    >
      {{ error }}
    </p>

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
      <div class="result-header">
        <div>
          <h4>当前视频</h4>
          <p
            v-if="currentResultPrompt"
            class="current-prompt"
          >
            {{ currentResultPrompt }}
          </p>
        </div>
        <div class="result-toolbar">
          <button
            v-if="currentVideoUrl"
            type="button"
            class="open-video-link"
            @click="downloadCurrentVideo"
          >
            下载视频
          </button>
          <div class="view-toggle">
            <button
              type="button"
              :class="{ active: resultViewMode === 'player' }"
              @click="resultViewMode = 'player'"
            >
              播放
            </button>
            <button
              type="button"
              :class="{ active: resultViewMode === 'json' }"
              @click="resultViewMode = 'json'"
            >
              JSON
            </button>
          </div>
        </div>
      </div>
      <video
        v-if="currentVideoUrl && resultViewMode === 'player'"
        class="video-player"
        :src="currentVideoUrl"
        controls
        playsinline
      />
      <div
        v-else-if="resultViewMode === 'player'"
        class="empty-result"
      >
        当前结果没有可播放的视频地址，请查看 JSON。
      </div>
      <pre v-else>{{ formatResult(result) }}</pre>
    </div>

    <div
      v-if="generatedHistory.length > 0"
      class="video-library"
    >
      <div class="section-header">
        <h4>生成历史（最近 {{ generatedHistory.length }} 条）</h4>
        <button
          type="button"
          class="clear-history-btn"
          @click="clearGeneratedHistory"
        >
          清空
        </button>
      </div>
      <div class="video-history-list">
        <article
          v-for="item in generatedHistory"
          :key="item.id"
          class="video-history-card"
          :class="{ active: item.id === activeHistoryId }"
        >
          <button
            type="button"
            class="video-history-select"
            @click="selectGeneratedHistory(item)"
          >
            <video
              v-if="item.url"
              :src="item.url"
              muted
              playsinline
              preload="metadata"
            />
            <span class="history-prompt">{{ item.prompt }}</span>
            <span class="history-date">{{ formatDate(item.createdAt) }}</span>
            <span
              v-if="item.durationMs"
              class="history-duration"
            >
              耗时 {{ formatGenerationDuration(item.durationMs) }}
            </span>
          </button>
          <button
            type="button"
            class="history-delete"
            aria-label="删除生成历史"
            @click="deleteGeneratedHistory(item.id)"
          >
            ×
          </button>
        </article>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import {
  generateVideo,
  waitForVideoGenerationResult,
  type VideoModel,
  type VideoResolution,
  type VideoTaskQueryResponse,
} from '../api/client';
import InputHistory from './InputHistory.vue';
import ApiProgress from './ApiProgress.vue';
import QuotaSummary from './QuotaSummary.vue';
import { useHistory } from '../composables/useHistory';
import { readJsonStorage, removeStorage, writeJsonStorage } from '../utils/safeStorage';
import {
  deleteLocalLibraryRecord,
  loadLocalLibraryRecords,
  saveLocalLibraryRecord,
  type LocalLibraryRecord,
} from '../utils/localLibrary';

type VideoGenerationHistoryRecord = {
  id: string;
  prompt: string;
  result: unknown;
  url: string;
  createdAt: number;
  durationMs?: number;
};

const prompt = ref('');
const loading = ref(false);
const result = ref<any>(null);
const error = ref('');
const taskStatus = ref<VideoTaskQueryResponse['status'] | ''>('');
const model = ref<VideoModel>('MiniMax-Hailuo-2.3');
const duration = ref(6);
const resolution = ref<VideoResolution>('768P');
const promptOptimizer = ref(true);
const fastPretreatment = ref(false);
const generatedHistory = ref<VideoGenerationHistoryRecord[]>([]);
const activeHistoryId = ref('');
const resultViewMode = ref<'player' | 'json'>('player');
const currentResultPrompt = ref('');
const generatedHistoryStorageKey = 'mmx_video_generation_history';
const maxGeneratedHistory = 12;

const { history, addToHistory, deleteHistory, clearHistory } = useHistory('mmx_video_history');

const modelOptions: VideoModel[] = ['MiniMax-Hailuo-2.3', 'MiniMax-Hailuo-02', 'T2V-01-Director', 'T2V-01'];
const isHailuoVideoModel = (value: VideoModel) => value === 'MiniMax-Hailuo-2.3' || value === 'MiniMax-Hailuo-02';
const isHailuoModel = computed(() => isHailuoVideoModel(model.value));
const durationOptions = computed(() => (isHailuoModel.value ? [6, 10] : [6]));
const resolutionOptions = computed<VideoResolution[]>(() => {
  if (!isHailuoModel.value) return ['720P', '1080P'];
  return duration.value === 10 ? ['768P'] : ['768P', '1080P'];
});
const currentVideoUrl = computed(() => extractVideoUrl(result.value));
const progressDetail = computed(() => {
  if (!taskStatus.value) return '视频任务已提交，正在等待任务状态';
  const statusText: Record<VideoTaskQueryResponse['status'], string> = {
    Preparing: '准备中',
    Queueing: '排队中',
    Processing: '生成中',
    Success: '已完成，正在取回视频文件',
    Fail: '生成失败',
  };
  return `任务状态：${statusText[taskStatus.value] || taskStatus.value}`;
});

const isVideoGenerationHistoryRecordArray = (value: unknown): value is VideoGenerationHistoryRecord[] => (
  Array.isArray(value)
  && value.every(item => (
    item
    && typeof item === 'object'
    && typeof (item as VideoGenerationHistoryRecord).id === 'string'
    && typeof (item as VideoGenerationHistoryRecord).prompt === 'string'
    && typeof (item as VideoGenerationHistoryRecord).url === 'string'
    && typeof (item as VideoGenerationHistoryRecord).createdAt === 'number'
    && (
      typeof (item as VideoGenerationHistoryRecord).durationMs === 'undefined'
      || typeof (item as VideoGenerationHistoryRecord).durationMs === 'number'
    )
    && typeof (item as VideoGenerationHistoryRecord).result !== 'undefined'
  ))
);

onMounted(async () => {
  const records = await loadLocalLibraryRecords('video');
  const diskHistory = records
    .map(toVideoGenerationHistoryRecord)
    .filter((item): item is VideoGenerationHistoryRecord => Boolean(item))
    .slice(0, maxGeneratedHistory);
  const savedHistory = readJsonStorage<VideoGenerationHistoryRecord[]>(
    generatedHistoryStorageKey,
    isVideoGenerationHistoryRecordArray,
  ) || [];
  generatedHistory.value = mergeGeneratedHistory(diskHistory, savedHistory);
  if (generatedHistory.value.length > 0) {
    selectGeneratedHistory(generatedHistory.value[0]);
  }
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
  error.value = '';
  taskStatus.value = '';
  currentResultPrompt.value = '';
  resultViewMode.value = 'player';
  addToHistory(prompt.value);
  try {
    const currentPrompt = prompt.value.trim();
    const generationStart = Date.now();
    const submitResult = await generateVideo(currentPrompt, {
      model: model.value,
      duration: duration.value,
      resolution: resolution.value,
      promptOptimizer: promptOptimizer.value,
      fastPretreatment: fastPretreatment.value,
    });
    result.value = submitResult;

    const taskId = submitResult?.task_id;
    if (!taskId) {
      throw new Error('视频任务提交成功，但响应中没有 task_id');
    }

    const videoResult = await waitForVideoGenerationResult(String(taskId), {
      onStatus: (task) => {
        taskStatus.value = task.status;
        result.value = {
          submit: submitResult,
          task,
        };
      },
    });

    const durationMs = Math.max(0, Date.now() - generationStart);
    result.value = {
      submit: submitResult,
      ...videoResult,
    };
    const diskRecord = await saveLocalLibraryRecord('video', currentPrompt, result.value, { durationMs });
    const historyRecord = diskRecord
      ? toVideoGenerationHistoryRecord(diskRecord)
      : createGeneratedHistoryRecord(result.value, currentPrompt, durationMs);
    if (historyRecord) {
      addGeneratedHistory(historyRecord);
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : '视频生成失败，请检查设置或稍后重试。';
  } finally {
    loading.value = false;
  }
};

const formatResult = (data: any) => JSON.stringify(data, null, 2);

const createGeneratedHistoryRecord = (
  data: unknown,
  promptText: string,
  durationMs?: number,
): VideoGenerationHistoryRecord | null => {
  const url = extractVideoUrl(data);
  if (!url) return null;
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    prompt: promptText,
    result: data,
    url,
    createdAt: Date.now(),
    ...(typeof durationMs === 'number' ? { durationMs } : {}),
  };
};

const toVideoGenerationHistoryRecord = (record: LocalLibraryRecord): VideoGenerationHistoryRecord | null => {
  const url = record.media[0]?.url || extractVideoUrl(record.response);
  if (!url) return null;
  return {
    id: record.id,
    prompt: record.prompt,
    result: {
      local_media: record.media.map(item => item.url),
      response: record.response,
    },
    url,
    createdAt: Date.parse(record.createdAt) || Date.now(),
    ...(typeof record.durationMs === 'number' ? { durationMs: record.durationMs } : {}),
  };
};

const addGeneratedHistory = (record: VideoGenerationHistoryRecord) => {
  generatedHistory.value = [
    record,
    ...generatedHistory.value.filter(item => item.id !== record.id),
  ].slice(0, maxGeneratedHistory);
  writeGeneratedHistory();
  selectGeneratedHistory(record);
};

const selectGeneratedHistory = (item: VideoGenerationHistoryRecord) => {
  activeHistoryId.value = item.id;
  result.value = item.result;
  currentResultPrompt.value = item.prompt;
  resultViewMode.value = 'player';
};

const deleteGeneratedHistory = async (id: string) => {
  const item = generatedHistory.value.find(record => record.id === id);
  if (!item) return;
  await deleteLocalLibraryRecord(id);
  generatedHistory.value = generatedHistory.value.filter(record => record.id !== id);
  writeGeneratedHistory();
  if (activeHistoryId.value === id) {
    const nextItem = generatedHistory.value[0] || null;
    activeHistoryId.value = nextItem?.id || '';
    result.value = nextItem?.result || null;
    currentResultPrompt.value = nextItem?.prompt || '';
  }
};

const clearGeneratedHistory = async () => {
  const ids = generatedHistory.value.map(item => item.id);
  await Promise.all(ids.map(id => deleteLocalLibraryRecord(id)));
  generatedHistory.value = [];
  activeHistoryId.value = '';
  result.value = null;
  currentResultPrompt.value = '';
  removeStorage(generatedHistoryStorageKey);
};

const formatGenerationDuration = (durationMs: number) => {
  if (durationMs < 1000) return `${Math.round(durationMs)} 毫秒`;
  if (durationMs < 60_000) return `${(durationMs / 1000).toFixed(durationMs < 10_000 ? 1 : 0)} 秒`;
  const minutes = Math.floor(durationMs / 60_000);
  const seconds = Math.round((durationMs % 60_000) / 1000);
  return `${minutes} 分 ${seconds} 秒`;
};

const formatDate = (timestamp: number) => new Date(timestamp).toLocaleString();

const mergeGeneratedHistory = (
  primary: VideoGenerationHistoryRecord[],
  fallback: VideoGenerationHistoryRecord[],
) => {
  const records = [...primary, ...fallback];
  const seen = new Set<string>();
  return records
    .filter((item) => {
      const key = item.id || item.url;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((left, right) => right.createdAt - left.createdAt)
    .slice(0, maxGeneratedHistory);
};

const writeGeneratedHistory = () => {
  writeJsonStorage(generatedHistoryStorageKey, generatedHistory.value);
};

const downloadCurrentVideo = async () => {
  if (!currentVideoUrl.value) return;
  const filename = buildVideoFilename(currentResultPrompt.value || 'video', currentVideoUrl.value);
  try {
    const response = await fetch(currentVideoUrl.value);
    if (!response.ok) throw new Error('download failed');
    const blob = await response.blob();
    downloadBlob(blob, filename);
  } catch {
    downloadByLink(currentVideoUrl.value, filename);
  }
};

const buildVideoFilename = (promptText: string, url: string) => {
  const extension = inferVideoExtension(url);
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const slug = promptText
    .trim()
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48) || 'video';
  return `minimax-video-${stamp}-${slug}.${extension}`;
};

const inferVideoExtension = (url: string) => {
  const pathname = (() => {
    try {
      return new URL(url, window.location.origin).pathname;
    } catch {
      return url;
    }
  })();
  const match = pathname.match(/\.([a-z0-9]+)$/i);
  return match?.[1] || 'mp4';
};

const downloadBlob = (blob: Blob, filename: string) => {
  const objectUrl = URL.createObjectURL(blob);
  try {
    downloadByLink(objectUrl, filename);
  } finally {
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 30_000);
  }
};

const downloadByLink = (url: string, filename: string) => {
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  link.remove();
};

function extractVideoUrl(data: unknown): string {
  const localMedia = (data as { local_media?: unknown } | null)?.local_media;
  if (Array.isArray(localMedia)) {
    const localVideo = localMedia.find(item => typeof item === 'string' && looksLikeVideoUrl(item));
    if (typeof localVideo === 'string') return localVideo;
  }

  const candidate = findStringByKeys(data, new Set([
    'video_url',
    'videoUrl',
    'video',
    'url',
    'output_url',
    'download_url',
  ]));
  return candidate || '';
}

function findStringByKeys(data: unknown, keys: Set<string>) {
  const queue: unknown[] = [data];
  const seen = new Set<unknown>();
  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || seen.has(current)) continue;
    seen.add(current);

    if (typeof current !== 'object') continue;
    if (Array.isArray(current)) {
      queue.push(...current);
      continue;
    }

    for (const [key, value] of Object.entries(current as Record<string, unknown>)) {
      if (keys.has(key) && typeof value === 'string' && looksLikeVideoUrl(value)) {
        return value;
      }
      queue.push(value);
    }
  }
  return '';
}

function looksLikeVideoUrl(value: string) {
  return /^https?:\/\//i.test(value) || /^\/local-library\/files\/video\//i.test(value);
}
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

.result-header,
.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;

  h4 {
    margin: 0;
  }
}

.current-prompt {
  max-width: 560px;
  margin: 6px 0 0;
  overflow: hidden;
  color: var(--text-muted);
  font-size: 13px;
  font-weight: 650;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.result-toolbar {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
}

.open-video-link,
.clear-history-btn,
.view-toggle button {
  min-height: 34px;
  padding: 8px 12px;
  color: var(--text-primary);
  background: var(--control-bg);
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-md);
  font-size: 13px;
  font-weight: 700;
  text-decoration: none;
  cursor: pointer;
}

.view-toggle {
  display: inline-flex;
  padding: 3px;
  background: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);

  button {
    border-color: transparent;

    &.active {
      color: var(--text-on-accent);
      background: var(--accent-primary);
      border-color: var(--accent-primary);
    }
  }
}

.video-player {
  width: 100%;
  max-height: 520px;
  display: block;
  margin-bottom: 12px;
  background: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
}

.empty-result {
  padding: 18px;
  color: var(--text-muted);
  background: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  font-size: 13px;
  font-weight: 650;
}

.video-library {
  margin-top: 24px;
}

.video-history-list {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 12px;
}

.video-history-card {
  position: relative;
  min-width: 0;
  background: var(--control-bg);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  overflow: hidden;

  &.active {
    border-color: var(--accent-primary);
    box-shadow: var(--shadow-glow);
  }
}

.video-history-select {
  width: 100%;
  padding: 0;
  color: var(--text-primary);
  background: transparent;
  border: 0;
  text-align: left;
  cursor: pointer;

  video {
    width: 100%;
    aspect-ratio: 16 / 9;
    display: block;
    object-fit: cover;
    background: var(--bg-surface);
  }
}

.history-prompt,
.history-date,
.history-duration {
  display: block;
  padding: 10px 12px 0;
  overflow: hidden;
  color: var(--text-primary);
  font-size: 13px;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.history-date {
  padding-top: 4px;
  color: var(--text-muted);
  font-size: 12px;
  font-weight: 650;
}

.history-duration {
  padding-top: 4px;
  padding-bottom: 10px;
  color: var(--text-muted);
  font-size: 12px;
  font-weight: 650;
}

.history-delete {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 28px;
  height: 28px;
  color: var(--text-primary);
  background: var(--control-bg);
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-sm);
  cursor: pointer;
}

@media (max-width: 800px) {
  .generation-options {
    grid-template-columns: 1fr;
  }
}
</style>
