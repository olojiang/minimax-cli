<template>
  <div class="image-gen-panel panel">
    <h2>图像生成 (Image Generation)</h2>
    <QuotaSummary
      title="图像生成配额"
      :model-patterns="['image-01', 'abab-image']"
    />
    <div class="input-group">
      <div class="prompt-sample-picker">
        <div class="sample-controls">
          <div class="field sample-search-field">
            <label for="image-prompt-sample-search">提示词样例</label>
            <input
              id="image-prompt-sample-search"
              v-model="sampleSearch"
              type="search"
              placeholder="搜索标题、分类或提示词内容"
              :disabled="loading"
            >
          </div>
          <div class="field sample-select-field">
            <label for="image-prompt-sample">选择样例</label>
            <select
              id="image-prompt-sample"
              v-model="selectedSampleId"
              :disabled="loading || filteredPromptSamples.length === 0"
              @change="applySelectedPromptSample"
            >
              <option value="">
                {{ filteredPromptSamples.length > 0 ? `选择一个样例（${filteredPromptSamples.length}）` : '没有匹配的样例' }}
              </option>
              <option
                v-for="sample in filteredPromptSamples"
                :key="sample.id"
                :value="sample.id"
              >
                {{ sample.number }}｜{{ sample.title }} · {{ sample.category }}
              </option>
            </select>
          </div>
        </div>
        <div
          v-if="selectedPromptSample"
          class="sample-preview"
        >
          <div>
            <strong>{{ selectedPromptSample.number }}｜{{ selectedPromptSample.title }}</strong>
            <span>{{ selectedPromptSample.category }}</span>
          </div>
        </div>
      </div>
      <textarea
        v-model="prompt" 
        placeholder="输入画面描述，例如：一只穿宇航服的猫咪在太空中" 
        rows="4"
        :disabled="loading"
      />
      <div class="generation-options">
        <div class="field">
          <label for="image-mode">生成模式</label>
          <select
            id="image-mode"
            v-model="mode"
            :disabled="loading"
          >
            <option value="text">
              文生图
            </option>
            <option value="reference">
              参考图生成
            </option>
          </select>
        </div>
        <div class="field">
          <label for="image-model">模型</label>
          <select
            id="image-model"
            v-model="model"
            :disabled="loading"
          >
            <option value="image-01">
              image-01
            </option>
            <option value="image-01-live">
              image-01-live
            </option>
          </select>
        </div>
        <div class="field">
          <label for="image-count">张数</label>
          <input
            id="image-count"
            v-model.number="count"
            type="number"
            min="1"
            max="9"
            step="1"
            :disabled="loading"
          >
        </div>
        <div class="field">
          <label for="image-format">返回格式</label>
          <select
            id="image-format"
            v-model="responseFormat"
            :disabled="loading"
          >
            <option value="url">
              URL
            </option>
            <option value="base64">
              Base64
            </option>
          </select>
        </div>
        <div class="field">
          <label for="image-ratio">画面比例</label>
          <select
            id="image-ratio"
            v-model="aspectRatio"
            :disabled="loading || customSize"
          >
            <option
              v-for="ratio in availableAspectRatios"
              :key="ratio"
              :value="ratio"
            >
              {{ ratio }}
            </option>
          </select>
        </div>
        <div class="field">
          <label for="image-seed">种子</label>
          <input
            id="image-seed"
            v-model="seed"
            type="number"
            placeholder="随机"
            :disabled="loading"
          >
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
            v-model="watermark"
            type="checkbox"
            :disabled="loading"
          >
          添加水印
        </label>
        <label class="check-field">
          <input
            v-model="customSize"
            type="checkbox"
            :disabled="loading || model === 'image-01-live'"
          >
          自定义尺寸
        </label>
      </div>
      <div
        v-if="customSize"
        class="size-options"
      >
        <div class="field">
          <label for="image-width">宽度</label>
          <input
            id="image-width"
            v-model.number="width"
            type="number"
            min="512"
            max="2048"
            step="8"
            :disabled="loading"
          >
        </div>
        <div class="field">
          <label for="image-height">高度</label>
          <input
            id="image-height"
            v-model.number="height"
            type="number"
            min="512"
            max="2048"
            step="8"
            :disabled="loading"
          >
        </div>
      </div>
      <div
        v-if="mode === 'reference'"
        class="reference-options"
      >
        <div
          class="paste-dropzone"
          :class="{ active: referenceFile }"
          role="button"
          tabindex="0"
          :aria-label="referenceFile ? `已选择参考图 ${referenceFile.name}` : '粘贴参考截图或选择图片'"
          @paste="onReferencePaste"
        >
          <div>
            <strong>{{ referenceFile ? referenceFile.name : '粘贴参考截图' }}</strong>
            <span>{{ referenceFile ? '可以重新粘贴或重新选择文件' : '复制截图后点击这里，按 Ctrl/Cmd + V' }}</span>
          </div>
        </div>
        <input
          ref="referenceInputRef"
          class="file-input"
          type="file"
          accept="image/*"
          :disabled="loading"
          @change="onReferenceChange"
        >
        <button
          v-if="referenceFile"
          class="clear-reference-btn"
          type="button"
          :disabled="loading"
          @click="clearReference"
        >
          清除参考图
        </button>
        <div
          v-if="referencePreviewUrl"
          class="image-preview"
        >
          <img
            :src="referencePreviewUrl"
            alt="Reference preview"
          >
        </div>
      </div>
      <button
        class="btn"
        :class="{ loading: loading }"
        :disabled="loading || !canGenerate"
        @click="performGen"
      >
        {{ loading ? 'Generating...' : 'Generate Image' }}
      </button>
    </div>
    <ApiProgress
      v-if="loading"
      title="正在生成图像"
      detail="提示词已提交，正在创建图像任务并等待结果"
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
        <h4>生成结果:</h4>
        <div class="result-toolbar">
          <button
            type="button"
            class="result-clear-btn"
            @click="clearCurrentResult"
          >
            删除结果
          </button>
          <div class="view-toggle">
            <button :class="{ active: resultViewMode === 'gallery' }" @click="resultViewMode = 'gallery'">图片</button>
            <button :class="{ active: resultViewMode === 'json' }" @click="resultViewMode = 'json'">JSON</button>
          </div>
        </div>
      </div>
      <div
        v-if="resultViewMode === 'gallery'"
        class="generated-gallery"
      >
        <div
          v-for="(image, index) in generatedImages"
          :key="`${image.src}-${index}`"
          class="generated-card"
        >
          <button
            type="button"
            class="generated-preview"
            @click="previewImage = image"
          >
            <img
              :src="image.src"
              :alt="`Generated image ${index + 1}`"
              @error="hideGeneratedImage(image.src)"
            >
          </button>
          <div class="generated-actions">
            <button
              type="button"
              class="icon-button"
              title="放大"
              aria-label="放大"
              @click="previewImage = image"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="11" cy="11" r="7" />
                <path d="m16 16 5 5" />
                <path d="M11 8v6" />
                <path d="M8 11h6" />
              </svg>
            </button>
            <a
              class="icon-button"
              :href="image.src"
              :download="buildImageFilename(index)"
              target="_blank"
              rel="noopener noreferrer"
              title="下载"
              aria-label="下载"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 3v12" />
                <path d="m7 10 5 5 5-5" />
                <path d="M5 21h14" />
              </svg>
            </a>
            <button
              type="button"
              class="icon-button"
              title="移除"
              aria-label="移除这张图片"
              @click="hideGeneratedImage(image.src)"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M3 6h18" />
                <path d="M8 6V4h8v2" />
                <path d="m10 11 4 4" />
                <path d="m14 11-4 4" />
                <path d="M6 6l1 15h10l1-15" />
              </svg>
            </button>
          </div>
        </div>
        <div
          v-if="generatedImages.length === 0"
          class="empty-result"
        >
          没有可显示图片，请查看 JSON。
        </div>
      </div>
      <pre v-else>{{ formatResult(result) }}</pre>
    </div>

    <div
      v-if="generatedHistory.length > 0"
      class="history-gallery"
    >
      <div class="section-header">
        <h4>生成历史</h4>
        <button
          type="button"
          class="clear-history-btn"
          @click="clearGeneratedHistory"
        >
          清空
        </button>
      </div>
      <div class="history-grid">
        <div
          v-for="item in generatedHistory"
          :key="item.id"
          class="history-card"
          :class="{ active: item.id === activeHistoryId }"
        >
          <button
            type="button"
            class="history-select"
            @click="selectGeneratedHistory(item)"
          >
            <img
              v-if="item.thumbnail && !hiddenHistoryThumbnailIds.includes(item.id)"
              :src="item.thumbnail"
              alt=""
              @error="hideHistoryThumbnail(item.id)"
            >
            <span v-else class="history-placeholder">JSON</span>
            <span class="history-prompt">{{ item.prompt }}</span>
            <span
              v-if="typeof item.durationMs === 'number'"
              class="history-duration"
            >
              耗时 {{ formatGenerationDuration(item.durationMs) }}
            </span>
          </button>
          <button
            type="button"
            class="history-delete"
            title="删除"
            aria-label="删除这条生成历史"
            @click.stop="deleteGeneratedHistory(item.id)"
          >
            ×
          </button>
        </div>
      </div>
    </div>

    <div
      v-if="previewImage"
      class="image-lightbox"
      role="dialog"
      aria-modal="true"
      @click.self="previewImage = null"
    >
      <div class="lightbox-content">
        <button
          type="button"
          class="lightbox-close"
          aria-label="关闭预览"
          @click="previewImage = null"
        >
          ×
        </button>
        <img
          :src="previewImage.src"
          alt="Generated image preview"
        >
        <a
          :href="previewImage.src"
          :download="buildImageFilename(0)"
          target="_blank"
          rel="noopener noreferrer"
          class="lightbox-download"
        >
          下载图片
        </a>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import {
  fileToDataUrl,
  generateImage,
  type ImageAspectRatio,
  type ImageModel,
  type ImageResponseFormat,
} from '../api/client';
import InputHistory from './InputHistory.vue';
import ApiProgress from './ApiProgress.vue';
import QuotaSummary from './QuotaSummary.vue';
import { useHistory } from '../composables/useHistory';
import { downloadMediaFromResponse } from '../utils/fileExport';
import { readJsonStorage, removeStorage, writeJsonStorage } from '../utils/safeStorage';
import {
  deleteLocalLibraryRecord,
  loadLocalLibraryRecords,
  saveLocalLibraryRecord,
  type LocalLibraryRecord,
} from '../utils/localLibrary';
import { imagePromptSamples } from '../data/imagePromptSamples';

type ImageMode = 'text' | 'reference';
type GeneratedImage = {
  src: string;
};
type ImageGenerationRecord = {
  id: string;
  prompt: string;
  result: unknown;
  thumbnail: string;
  createdAt: number;
  durationMs?: number;
};

const prompt = ref('');
const loading = ref(false);
const result = ref<any>(null);
const error = ref('');
const resultViewMode = ref<'gallery' | 'json'>('gallery');
const currentResultPrompt = ref('');
const mode = ref<ImageMode>('text');
const model = ref<ImageModel>('image-01');
const aspectRatio = ref<ImageAspectRatio>('1:1');
const responseFormat = ref<ImageResponseFormat>('url');
const count = ref(1);
const seed = ref('');
const promptOptimizer = ref(false);
const watermark = ref(false);
const customSize = ref(false);
const width = ref(1024);
const height = ref(1024);
const sampleSearch = ref('');
const selectedSampleId = ref('');
const referenceFile = ref<File | null>(null);
const referencePreviewUrl = ref('');
const previewImage = ref<GeneratedImage | null>(null);
const referenceInputRef = ref<HTMLInputElement | null>(null);
const hiddenGeneratedImageSources = ref<string[]>([]);
const hiddenHistoryThumbnailIds = ref<string[]>([]);
const generatedHistory = ref<ImageGenerationRecord[]>([]);
const activeHistoryId = ref('');
const generatedHistoryStorageKey = 'mmx_image_generation_history';
const maxGeneratedHistory = 12;

const { history, addToHistory, deleteHistory, clearHistory } = useHistory('mmx_image_history');

const image01Ratios: ImageAspectRatio[] = ['1:1', '16:9', '4:3', '3:2', '2:3', '3:4', '9:16', '21:9'];
const imageLiveRatios: ImageAspectRatio[] = ['1:1', '16:9', '4:3', '3:2', '2:3', '3:4', '9:16'];

const availableAspectRatios = computed(() => (model.value === 'image-01-live' ? imageLiveRatios : image01Ratios));
const normalizedSampleSearch = computed(() => sampleSearch.value.trim().toLocaleLowerCase());
const filteredPromptSamples = computed(() => {
  const query = normalizedSampleSearch.value;
  if (!query) return imagePromptSamples;

  return imagePromptSamples.filter((sample) => {
    const searchable = [
      sample.number,
      sample.title,
      sample.category,
      sample.prompt,
    ].join('\n').toLocaleLowerCase();
    return searchable.includes(query);
  });
});
const selectedPromptSample = computed(() => (
  imagePromptSamples.find(sample => sample.id === selectedSampleId.value) || null
));

const getEditablePromptSampleText = (samplePrompt: string) => {
  const exampleMatch = samplePrompt.match(/(?:^|\n)\s*示例[:：]\s*([\s\S]+)$/);
  return (exampleMatch?.[1] || samplePrompt).trim();
};

const isImageGenerationRecordArray = (value: unknown): value is ImageGenerationRecord[] => (
  Array.isArray(value)
  && value.every(item => (
    item
    && typeof item === 'object'
    && typeof (item as ImageGenerationRecord).id === 'string'
    && typeof (item as ImageGenerationRecord).prompt === 'string'
    && typeof (item as ImageGenerationRecord).thumbnail === 'string'
    && typeof (item as ImageGenerationRecord).createdAt === 'number'
    && (
      typeof (item as ImageGenerationRecord).durationMs === 'undefined'
      || typeof (item as ImageGenerationRecord).durationMs === 'number'
    )
    && typeof (item as ImageGenerationRecord).result !== 'undefined'
  ))
);

onMounted(async () => {
  const diskRecords = await loadLocalLibraryRecords('image');
  generatedHistory.value = diskRecords.length > 0
    ? diskRecords.map(toImageGenerationRecord).slice(0, maxGeneratedHistory)
    : readJsonStorage<ImageGenerationRecord[]>(
    generatedHistoryStorageKey,
    isImageGenerationRecordArray,
  ) || [];

  if (generatedHistory.value.length > 0) {
    selectGeneratedHistory(generatedHistory.value[0]);
  }
});

const validSize = computed(() => (
  !customSize.value
  || (
    width.value >= 512
    && width.value <= 2048
    && width.value % 8 === 0
    && height.value >= 512
    && height.value <= 2048
    && height.value % 8 === 0
  )
));

const canGenerate = computed(() => (
  Boolean(prompt.value.trim())
  && validSize.value
  && count.value >= 1
  && count.value <= 9
  && (mode.value === 'text' || Boolean(referenceFile.value))
));

watch(model, () => {
  if (!availableAspectRatios.value.includes(aspectRatio.value)) {
    aspectRatio.value = '1:1';
  }
  if (model.value === 'image-01-live') {
    customSize.value = false;
  }
});

const selectHistory = (item: string) => {
  prompt.value = item;
};

const applySelectedPromptSample = () => {
  if (!selectedPromptSample.value) return;
  prompt.value = getEditablePromptSampleText(selectedPromptSample.value.prompt);
  error.value = '';
};

const setReferenceFile = async (file: File) => {
  referenceFile.value = file;
  referencePreviewUrl.value = await fileToDataUrl(file);
  error.value = '';
};

const onReferenceChange = async (event: Event) => {
  const target = event.target as HTMLInputElement;
  if (target.files && target.files.length > 0) {
    await setReferenceFile(target.files[0]);
  } else {
    referenceFile.value = null;
    referencePreviewUrl.value = '';
  }
};

const clearReference = () => {
  referenceFile.value = null;
  referencePreviewUrl.value = '';
  if (referenceInputRef.value) {
    referenceInputRef.value.value = '';
  }
};

const onReferencePaste = async (event: ClipboardEvent) => {
  if (loading.value) return;

  const items = Array.from(event.clipboardData?.items || []);
  const imageItem = items.find(item => item.type.startsWith('image/'));
  const pastedFile = imageItem?.getAsFile();

  if (!pastedFile) {
    error.value = '剪贴板里没有图片，请先复制截图后再粘贴。';
    return;
  }

  event.preventDefault();
  const extension = pastedFile.type.split('/')[1] || 'png';
  const file = new File([pastedFile], `pasted-reference.${extension}`, {
    type: pastedFile.type,
    lastModified: Date.now(),
  });
  await setReferenceFile(file);
};

const performGen = async () => {
  if (!canGenerate.value || loading.value) return;
  loading.value = true;
  result.value = null;
  error.value = '';
  addToHistory(prompt.value);
  try {
    const numericSeed = seed.value === '' ? undefined : Number(seed.value);
    const generationStart = Date.now();
    result.value = await generateImage(prompt.value, {
      model: model.value,
      aspectRatio: customSize.value ? undefined : aspectRatio.value,
      width: customSize.value ? width.value : undefined,
      height: customSize.value ? height.value : undefined,
      responseFormat: responseFormat.value,
      n: count.value,
      seed: Number.isInteger(numericSeed) ? numericSeed : undefined,
      promptOptimizer: promptOptimizer.value,
      watermark: watermark.value,
      subjectReference: mode.value === 'reference' ? referenceFile.value || undefined : undefined,
    });
    const durationMs = Math.max(0, Date.now() - generationStart);
    hiddenGeneratedImageSources.value = [];
    resultViewMode.value = 'gallery';
    currentResultPrompt.value = prompt.value.trim();
    const diskRecord = await saveLocalLibraryRecord('image', currentResultPrompt.value, result.value, { durationMs });
    const freshRecord = createGeneratedHistoryRecord(result.value, currentResultPrompt.value, durationMs);
    const diskHistoryRecord = diskRecord ? toImageGenerationRecord(diskRecord) : null;
    if (diskHistoryRecord) {
      result.value = diskHistoryRecord.result;
    }
    addGeneratedHistory(diskHistoryRecord
      ? { ...diskHistoryRecord, thumbnail: diskHistoryRecord.thumbnail || freshRecord.thumbnail }
      : freshRecord);
    downloadMediaFromResponse(result.value, { kind: 'image', prompt: prompt.value });
  } catch (err) {
    error.value = err instanceof Error ? err.message : '图像生成失败，请检查设置或稍后重试。';
  } finally {
    loading.value = false;
  }
};

const formatResult = (data: any) => JSON.stringify(data, null, 2);

const generatedImages = computed<GeneratedImage[]>(() => (
  extractPreferredImageSources(result.value)
    .filter(src => !hiddenGeneratedImageSources.value.includes(src))
    .map(src => ({ src }))
));

const createRecordId = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;

const createGeneratedHistoryRecord = (data: unknown, promptText: string, durationMs?: number): ImageGenerationRecord => {
  const thumbnail = extractImageSources(data, { includeRemoteSource: true })[0] || '';
  return {
    id: createRecordId(),
    prompt: promptText,
    result: data,
    thumbnail,
    createdAt: Date.now(),
    ...(typeof durationMs === 'number' ? { durationMs } : {}),
  };
};

const toImageGenerationRecord = (record: LocalLibraryRecord): ImageGenerationRecord => {
  const localImages = record.media.map(item => item.url);
  const result = {
    response: record.response,
    local_media: localImages,
  };
  return {
    id: record.id,
    prompt: record.prompt,
    result,
    thumbnail: localImages[0] || '',
    createdAt: Date.parse(record.createdAt) || Date.now(),
    ...(typeof record.durationMs === 'number' ? { durationMs: record.durationMs } : {}),
  };
};

const formatGenerationDuration = (durationMs: number) => {
  if (durationMs < 1000) return `${Math.round(durationMs)} 毫秒`;
  if (durationMs < 60_000) return `${(durationMs / 1000).toFixed(durationMs < 10_000 ? 1 : 0)} 秒`;
  const minutes = Math.floor(durationMs / 60_000);
  const seconds = Math.round((durationMs % 60_000) / 1000);
  return `${minutes} 分 ${seconds} 秒`;
};

const addGeneratedHistory = (record: ImageGenerationRecord) => {
  generatedHistory.value = [record, ...generatedHistory.value].slice(0, maxGeneratedHistory);
  activeHistoryId.value = record.id;
  writeJsonStorage(generatedHistoryStorageKey, generatedHistory.value);
};

const selectGeneratedHistory = (item: ImageGenerationRecord) => {
  result.value = item.result;
  currentResultPrompt.value = item.prompt;
  activeHistoryId.value = item.id;
  resultViewMode.value = 'gallery';
  previewImage.value = null;
  hiddenGeneratedImageSources.value = [];
};

const resetCurrentResult = () => {
  activeHistoryId.value = '';
  result.value = null;
  currentResultPrompt.value = '';
  previewImage.value = null;
  hiddenGeneratedImageSources.value = [];
};

const clearCurrentResult = async () => {
  if (activeHistoryId.value) {
    await deleteGeneratedHistory(activeHistoryId.value);
    return;
  }

  resetCurrentResult();
};

const hideGeneratedImage = (src: string) => {
  if (hiddenGeneratedImageSources.value.includes(src)) return;
  hiddenGeneratedImageSources.value = [...hiddenGeneratedImageSources.value, src];
  if (previewImage.value?.src === src) {
    previewImage.value = null;
  }
};

const hideHistoryThumbnail = (id: string) => {
  if (hiddenHistoryThumbnailIds.value.includes(id)) return;
  hiddenHistoryThumbnailIds.value = [...hiddenHistoryThumbnailIds.value, id];
};

const clearGeneratedHistory = async () => {
  await Promise.all(generatedHistory.value.map(item => deleteLocalLibraryRecord(item.id)));
  generatedHistory.value = [];
  resetCurrentResult();
  removeStorage(generatedHistoryStorageKey);
};

const deleteGeneratedHistory = async (id: string) => {
  await deleteLocalLibraryRecord(id);
  generatedHistory.value = generatedHistory.value.filter(item => item.id !== id);
  hiddenHistoryThumbnailIds.value = hiddenHistoryThumbnailIds.value.filter(itemId => itemId !== id);
  if (generatedHistory.value.length > 0) {
    writeJsonStorage(generatedHistoryStorageKey, generatedHistory.value);
  } else {
    removeStorage(generatedHistoryStorageKey);
  }

  if (activeHistoryId.value !== id) return;

  const next = generatedHistory.value[0];
  if (next) {
    selectGeneratedHistory(next);
    return;
  }

  resetCurrentResult();
};

const extractPreferredImageSources = (value: unknown): string[] => {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const localMedia = (value as { local_media?: unknown }).local_media;
    if (Array.isArray(localMedia)) {
      const localSources = localMedia.filter((item): item is string => (
        typeof item === 'string'
        && looksLikeImageSource(item)
      ));
      if (localSources.length > 0) return localSources;
    }
  }

  return extractImageSources(value, { includeRemoteSource: true });
};

const extractImageSources = (value: unknown, options: { includeRemoteSource?: boolean } = {}): string[] => {
  const sources: string[] = [];
  const imageKeys = new Set(['image_url', 'image_urls', 'imageUrl', 'image', 'url', 'output_url', 'download_url', 'local_media']);
  const seen = new Set<unknown>();
  const queue: unknown[] = [value];

  while (queue.length > 0) {
    const current = queue.shift();
    if (seen.has(current)) continue;
    seen.add(current);

    if (typeof current === 'string') {
      if (looksLikeImageSource(current) && !sources.includes(current)) {
        sources.push(current);
      }
      continue;
    }

    if (!current || typeof current !== 'object') continue;

    if (Array.isArray(current)) {
      for (const item of current) {
        if (typeof item === 'string' && looksLikeImageSource(item) && !sources.includes(item)) {
          sources.push(item);
        } else {
          queue.push(item);
        }
      }
      continue;
    }

    for (const [key, nested] of Object.entries(current as Record<string, unknown>)) {
      if (imageKeys.has(key)) {
        if (Array.isArray(nested)) {
          for (const item of nested) {
            if (typeof item === 'string' && looksLikeImageSource(item) && !sources.includes(item)) {
              sources.push(item);
            }
          }
          continue;
        }
        if (typeof nested === 'string' && looksLikeImageSource(nested) && !sources.includes(nested)) {
          sources.push(nested);
          continue;
        }
      }

      if (options.includeRemoteSource || key !== 'source') {
        queue.push(nested);
      }
    }
  }

  return sources;
};

const looksLikeImageSource = (value: string) => (
  /^data:image\//i.test(value)
  || /^\/local-library\/files\/image\/.+\.(png|jpe?g|webp|gif)(\?|#|$)/i.test(value)
  || /^https?:\/\/.+\.(png|jpe?g|webp|gif)(\?|#|$)/i.test(value)
);

const buildImageFilename = (index: number) => {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const slug = (currentResultPrompt.value || prompt.value)
    .trim()
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, '-')
    .slice(0, 48) || 'image';
  return `minimax-image-${stamp}-${slug}-${index + 1}.jpg`;
};
</script>

<style lang="less" scoped>
@import '../styles/panel.less';

.generation-options,
.size-options {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
}

.prompt-sample-picker {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 14px;
  background:
    linear-gradient(180deg, var(--accent-soft), transparent 62%),
    var(--control-bg);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-lg);
}

.sample-controls {
  display: grid;
  grid-template-columns: minmax(180px, 0.7fr) minmax(260px, 1.3fr);
  gap: 14px;
}

.sample-search-field,
.sample-select-field {
  min-width: 0;
}

.sample-preview {
  display: grid;
  gap: 8px;
  padding: 12px 14px;
  background: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);

  strong,
  span {
    display: block;
  }

  strong {
    color: var(--text-primary);
    font-size: 13px;
    font-weight: 760;
  }

  span {
    margin-top: 3px;
    color: var(--text-muted);
    font-size: 12px;
    font-weight: 650;
  }
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

  input,
  select {
    min-height: 46px;
    padding: 10px 12px;
    color: var(--text-primary);
    background: var(--control-bg);
    border: 1px solid var(--border-strong);
    border-radius: var(--radius-md);
    min-width: 0;
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

.reference-options {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) auto auto;
  align-items: start;
  gap: 14px;
}

.paste-dropzone {
  min-height: 72px;
  padding: 14px 16px;
  background: var(--control-bg);
  border: 1px dashed var(--border-strong);
  border-radius: var(--radius-md);
  color: var(--text-secondary);
  cursor: text;
  transition: transform var(--motion-fast), border-color var(--motion-med), box-shadow var(--motion-med), background-color var(--motion-med);

  strong,
  span {
    display: block;
  }

  strong {
    color: var(--text-primary);
    font-size: 14px;
    font-weight: 750;
    word-break: break-word;
  }

  span {
    margin-top: 4px;
    color: var(--text-muted);
    font-size: 13px;
  }

  &:hover,
  &:focus {
    outline: none;
    border-color: var(--accent-primary);
    box-shadow: var(--shadow-glow);
    background: var(--bg-surface);
    transform: translateY(-1px);
  }

  &.active {
    border-style: solid;
    border-color: var(--accent-primary);
    background: var(--accent-soft);
  }
}

.image-preview {
  width: 96px;
  aspect-ratio: 1;
  border: 1px solid var(--border-subtle);
  border-radius: 8px;
  padding: 4px;
  background-color: var(--bg-base);

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
    border-radius: 4px;
  }
}

.clear-reference-btn {
  min-height: 46px;
  padding: 10px 14px;
  background: var(--control-bg);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  color: var(--text-secondary);
  cursor: pointer;
  font-size: 13px;
  font-weight: 700;
  transition: transform var(--motion-fast), background-color var(--motion-med), border-color var(--motion-med), color var(--motion-med);

  &:hover:not(:disabled) {
    transform: translateY(-1px);
    border-color: var(--accent-primary);
    color: var(--text-primary);
    background: var(--bg-surface);
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }
}

.result-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  margin-bottom: 16px;

  h4 {
    margin: 0;
  }
}

.view-toggle {
  display: flex;
  background: var(--control-bg);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  padding: 3px;

  button {
    min-height: 32px;
    padding: 4px 12px;
    background: transparent;
    border: none;
    border-radius: 7px;
    color: var(--text-secondary);
    cursor: pointer;
    font-size: 12px;
    transition: transform var(--motion-fast), background-color var(--motion-med), color var(--motion-med), box-shadow var(--motion-med);

    &.active {
      background: var(--bg-surface);
      color: var(--text-primary);
      box-shadow: var(--shadow-sm);
    }

    &:not(.active):hover {
      color: var(--text-primary);
      transform: translateY(-1px);
    }
  }
}

.result-toolbar {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.result-clear-btn {
  min-height: 36px;
  padding: 6px 10px;
  background: transparent;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  color: var(--text-muted);
  cursor: pointer;
  font-size: 13px;
  transition: transform var(--motion-fast), background-color var(--motion-med), border-color var(--motion-med), color var(--motion-med);

  &:hover {
    transform: translateY(-1px);
    background: var(--accent-soft);
    border-color: var(--accent-primary);
    color: var(--accent-primary);
  }
}

.generated-gallery {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 16px;
}

.generated-card {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 0;
}

.generated-preview {
  width: 100%;
  aspect-ratio: 1;
  padding: 0;
  overflow: hidden;
  background: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  cursor: zoom-in;
  transition: transform var(--motion-fast), border-color var(--motion-med), box-shadow var(--motion-med);

  &:hover {
    transform: translateY(-1px);
    border-color: var(--accent-primary);
    box-shadow: var(--shadow-md);
  }

  img {
    width: 100%;
    height: 100%;
    object-fit: contain;
    display: block;
  }
}

.generated-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;

  .icon-button {
    width: 40px;
    height: 40px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    background: var(--control-bg);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-sm);
    color: var(--text-secondary);
    cursor: pointer;
    font-size: 13px;
    font-weight: 700;
    text-decoration: none;
    transition: transform var(--motion-fast), background-color var(--motion-med), border-color var(--motion-med), color var(--motion-med);

    &:hover {
      transform: translateY(-1px);
      border-color: var(--accent-primary);
      color: var(--text-primary);
      background: var(--bg-surface);
    }

    svg {
      width: 20px;
      height: 20px;
      fill: none;
      stroke: currentColor;
      stroke-width: 2;
      stroke-linecap: round;
      stroke-linejoin: round;
    }
  }
}

.history-gallery {
  margin-top: 24px;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  margin-bottom: 12px;

  h4 {
    margin: 0;
    color: var(--text-secondary);
    font-size: 15px;
    font-weight: 750;
  }
}

.clear-history-btn {
  min-height: 34px;
  padding: 6px 10px;
  background: transparent;
  border: none;
  border-radius: var(--radius-sm);
  color: var(--text-muted);
  cursor: pointer;
  font-size: 13px;
  transition: transform var(--motion-fast), background-color var(--motion-med), color var(--motion-med);

  &:hover {
    transform: translateY(-1px);
    background: var(--accent-soft);
    color: var(--accent-primary);
  }
}

.history-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 12px;
}

.history-card {
  position: relative;
  min-width: 0;
  padding: 8px;
  background: var(--control-bg);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  color: var(--text-secondary);
  text-align: left;
  transition: transform var(--motion-fast), background-color var(--motion-med), border-color var(--motion-med), box-shadow var(--motion-med);

  &:hover {
    transform: translateY(-1px);
    border-color: var(--accent-primary);
    background: var(--bg-surface);
  }

  &.active {
    border-color: var(--accent-primary);
    box-shadow: var(--shadow-glow);
  }

  .history-select {
    width: 100%;
    padding: 0;
    background: transparent;
    border: none;
    color: inherit;
    cursor: pointer;
    text-align: left;
  }

  .history-delete {
    position: absolute;
    top: 8px;
    right: 8px;
    width: 30px;
    height: 30px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: color-mix(in srgb, var(--bg-surface) 86%, transparent);
    border: 1px solid var(--border-subtle);
    border-radius: 50%;
    color: var(--text-secondary);
    cursor: pointer;
    font-size: 18px;
    font-weight: 700;
    line-height: 1;
    transition: transform var(--motion-fast), background-color var(--motion-med), border-color var(--motion-med), color var(--motion-med);

    &:hover {
      transform: scale(1.04);
      border-color: var(--error);
      color: var(--error);
      background: var(--bg-surface);
    }
  }

  img,
  .history-placeholder {
    width: 100%;
    aspect-ratio: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    object-fit: cover;
    background: var(--bg-surface);
    border-radius: var(--radius-sm);
  }

  .history-prompt {
    display: block;
    margin-top: 8px;
    overflow: hidden;
    color: var(--text-primary);
    font-size: 12px;
    font-weight: 650;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .history-duration {
    display: block;
    margin-top: 4px;
    overflow: hidden;
    color: var(--text-muted);
    font-size: 11px;
    font-weight: 650;
    font-variant-numeric: tabular-nums;
    line-height: 1.3;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.empty-result {
  padding: 20px;
  color: var(--text-secondary);
  background: var(--bg-surface);
  border: 1px dashed var(--border-strong);
  border-radius: var(--radius-md);
}

.image-lightbox {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: rgba(0, 0, 0, 0.72);
}

.lightbox-content {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: min(96vw, 1100px);
  max-height: 92vh;
  padding: 14px;
  background: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);

  img {
    max-width: 100%;
    max-height: 76vh;
    object-fit: contain;
    border-radius: var(--radius-md);
    background: var(--bg-base);
  }
}

.lightbox-close {
  position: absolute;
  top: 10px;
  right: 10px;
  width: 40px;
  height: 40px;
  border: 1px solid var(--border-subtle);
  border-radius: 50%;
  background: var(--control-bg);
  color: var(--text-primary);
  cursor: pointer;
  font-size: 24px;
  line-height: 1;
}

.lightbox-download {
  align-self: flex-end;
  min-height: 38px;
  padding: 8px 14px;
  background: var(--accent-gradient);
  border-radius: var(--radius-sm);
  color: var(--text-on-accent);
  font-size: 13px;
  font-weight: 760;
  text-decoration: none;
}

@media (max-width: 800px) {
  .sample-controls,
  .generation-options,
  .size-options,
  .reference-options {
    grid-template-columns: 1fr;
  }

  .result-header {
    align-items: stretch;
    flex-direction: column;

    .result-toolbar {
      align-self: flex-start;
      justify-content: flex-start;
    }
  }
}
</style>
