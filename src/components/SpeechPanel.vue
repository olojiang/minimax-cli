<template>
  <div class="speech-panel panel">
    <h2>语音合成 (Speech Synthesis)</h2>
    <QuotaSummary
      title="语音合成配额"
      :model-patterns="['speech-2.8', 'speech-2.6', 'speech-02', 'speech-01', 'speech-hd', 'speech-turbo']"
    />
    <div class="input-group">
      <section class="quote-library">
        <div class="quote-library-header">
          <div>
            <h3>名人名言</h3>
            <p>{{ filteredQuotes.length }} 条可选内容</p>
          </div>
          <input
            id="quote-search"
            v-model="quoteSearch"
            type="search"
            placeholder="搜索人物、分类、标签或内容"
            :disabled="loading"
          >
        </div>
        <div class="quote-results">
          <button
            v-for="quote in visibleQuotes"
            :key="quote.id"
            class="quote-item"
            :class="{ selected: quote.id === selectedQuoteId }"
            type="button"
            :disabled="loading"
            @click="selectQuote(quote)"
          >
            <span class="quote-content">{{ quote.content }}</span>
            <span class="quote-meta">{{ quote.person }} · {{ quote.category }} · {{ quote.tags.join(' / ') }}</span>
          </button>
        </div>
        <p
          v-if="visibleQuotes.length === 0"
          class="quote-empty"
        >
          没有匹配的名言
        </p>
      </section>
      <textarea
        id="speech-text"
        v-model="text" 
        placeholder="输入需要合成的文本，例如：你好，欢迎使用 MiniMax" 
        rows="5"
        :disabled="loading"
      />
      <div class="speech-options">
        <div class="field">
          <label for="speech-model">模型</label>
          <select
            id="speech-model"
            v-model="model"
            :disabled="loading"
          >
            <option
              v-for="item in speechModels"
              :key="item"
              :value="item"
            >
              {{ item }}
            </option>
          </select>
        </div>

        <div class="field voice-field">
          <label for="speech-voice">音色</label>
          <div class="voice-row">
            <select
              id="speech-voice"
              v-model="voiceId"
              :disabled="loading || voicesLoading"
            >
              <option
                v-for="item in voiceOptions"
                :key="item.voice_id"
                :value="item.voice_id"
              >
                {{ item.voice_name ? `${item.voice_name} (${item.voice_id})` : item.voice_id }}
              </option>
            </select>
            <button
              class="secondary-btn"
              type="button"
              :disabled="voicesLoading"
              @click="refreshVoices"
            >
              {{ voicesLoading ? '刷新中...' : '刷新音色' }}
            </button>
          </div>
          <input
            v-model="voiceId"
            class="voice-id-input"
            type="text"
            placeholder="也可以直接粘贴 voice_id"
            :disabled="loading"
          >
        </div>

        <div class="field">
          <label for="speech-speed">语速 {{ speed.toFixed(1) }}</label>
          <input
            id="speech-speed"
            v-model.number="speed"
            type="range"
            min="0.5"
            max="2"
            step="0.1"
            :disabled="loading"
          >
        </div>

        <div class="field">
          <label for="speech-volume">音量 {{ volume.toFixed(1) }}</label>
          <input
            id="speech-volume"
            v-model.number="volume"
            type="range"
            min="0.1"
            max="10"
            step="0.1"
            :disabled="loading"
          >
        </div>

        <div class="field">
          <label for="speech-pitch">音高 {{ pitch }}</label>
          <input
            id="speech-pitch"
            v-model.number="pitch"
            type="range"
            min="-12"
            max="12"
            step="1"
            :disabled="loading"
          >
        </div>

        <div class="field">
          <label for="speech-format">格式</label>
          <select
            id="speech-format"
            v-model="format"
            :disabled="loading"
          >
            <option value="mp3">
              mp3
            </option>
            <option value="wav">
              wav
            </option>
            <option value="flac">
              flac
            </option>
            <option value="pcm">
              pcm
            </option>
          </select>
        </div>

        <div class="field">
          <label for="speech-sample-rate">采样率</label>
          <select
            id="speech-sample-rate"
            v-model.number="sampleRate"
            :disabled="loading"
          >
            <option :value="16000">
              16000
            </option>
            <option :value="24000">
              24000
            </option>
            <option :value="32000">
              32000
            </option>
            <option :value="44100">
              44100
            </option>
          </select>
        </div>

        <div class="field">
          <label for="speech-bitrate">码率</label>
          <select
            id="speech-bitrate"
            v-model.number="bitrate"
            :disabled="loading"
          >
            <option :value="64000">
              64k
            </option>
            <option :value="128000">
              128k
            </option>
            <option :value="256000">
              256k
            </option>
          </select>
        </div>

        <div class="field">
          <label for="speech-channel">声道</label>
          <select
            id="speech-channel"
            v-model.number="channel"
            :disabled="loading"
          >
            <option :value="1">
              单声道
            </option>
            <option :value="2">
              双声道
            </option>
          </select>
        </div>

        <div class="field">
          <label for="speech-language">语言增强</label>
          <select
            id="speech-language"
            v-model="languageBoost"
            :disabled="loading"
          >
            <option value="">
              自动
            </option>
            <option value="Chinese">
              Chinese
            </option>
            <option value="English">
              English
            </option>
            <option value="Japanese">
              Japanese
            </option>
            <option value="Korean">
              Korean
            </option>
            <option value="Spanish">
              Spanish
            </option>
            <option value="French">
              French
            </option>
            <option value="German">
              German
            </option>
          </select>
        </div>
      </div>
      <button
        class="btn"
        :class="{ loading: loading }"
        :disabled="loading || !text.trim()"
        @click="performSynth"
      >
        {{ loading ? 'Synthesizing...' : 'Synthesize Speech' }}
      </button>
    </div>
    <ApiProgress
      v-if="loading"
      title="正在合成语音"
      detail="文本已提交，正在生成音频数据"
    />

    <details class="clone-section">
      <summary>音色文件上传 / 克隆</summary>
      <div class="clone-grid">
        <div class="field">
          <label for="clone-file">音色文件</label>
          <input
            id="clone-file"
            type="file"
            accept=".mp3,.m4a,.wav,audio/mpeg,audio/mp4,audio/wav"
            :disabled="cloneLoading"
            @change="handleCloneFileChange"
          >
        </div>
        <div class="field">
          <label for="clone-voice-id">新 voice_id</label>
          <input
            id="clone-voice-id"
            v-model="cloneVoiceId"
            type="text"
            placeholder="例如：my_custom_voice_001"
            :disabled="cloneLoading"
          >
        </div>
        <div class="field full">
          <label for="clone-preview">试听文本</label>
          <textarea
            id="clone-preview"
            v-model="clonePreviewText"
            rows="3"
            placeholder="用于克隆后试听，可留空"
            :disabled="cloneLoading"
          />
        </div>
        <label class="check-field">
          <input
            v-model="cloneNoiseReduction"
            type="checkbox"
            :disabled="cloneLoading"
          >
          降噪
        </label>
        <label class="check-field">
          <input
            v-model="cloneVolumeNormalization"
            type="checkbox"
            :disabled="cloneLoading"
          >
          音量归一化
        </label>
        <button
          class="btn clone-btn"
          :class="{ loading: cloneLoading }"
          :disabled="cloneLoading || !cloneFile || !cloneVoiceId.trim()"
          @click="performClone"
        >
          {{ cloneLoading ? '克隆中...' : '上传并克隆音色' }}
        </button>
      </div>
      <ApiProgress
        v-if="cloneLoading"
        title="正在克隆音色"
        detail="音频文件正在上传并生成自定义 voice_id"
      />
      <div
        v-if="cloneMessage"
        class="clone-message"
      >
        {{ cloneMessage }}
      </div>
    </details>

    <!-- 输入历史 -->
    <InputHistory 
      :history="history" 
      title="最近输入"
      @select="selectHistory"
      @delete="deleteHistory"
      @clear="clearHistory"
    />

    <section
      v-if="speechItems.length > 0"
      class="speech-library"
    >
      <div class="section-header">
        <div>
          <h3>语音结果库</h3>
          <p>最近 {{ speechItems.length }} 条合成结果</p>
        </div>
        <div class="section-actions">
          <button
            class="text-btn"
            type="button"
            :disabled="libraryLoading"
            @click="refreshSpeechLibrary"
          >
            {{ libraryLoading ? '刷新中...' : '刷新' }}
          </button>
          <button
            class="text-btn danger"
            type="button"
            :disabled="libraryLoading"
            @click="clearSpeechLibrary"
          >
            清空列表
          </button>
        </div>
      </div>

      <div
        v-if="currentSpeech"
        class="speech-player"
      >
        <div class="speech-player-meta">
          <span
            class="speech-mark"
            aria-hidden="true"
          >SP</span>
          <div>
            <h4>{{ currentSpeech.prompt }}</h4>
            <p>{{ currentSpeech.voiceId }} · {{ currentSpeech.model }} · {{ currentSpeech.format }}</p>
          </div>
        </div>
        <audio
          ref="speechAudioRef"
          :src="currentSpeech.url"
          controls
          class="speech-audio"
        />
      </div>

      <div class="speech-list">
        <button
          v-for="item in speechItems"
          :key="item.id"
          type="button"
          class="speech-item"
          :class="{ active: currentSpeech?.id === item.id }"
          @click="playSpeech(item)"
        >
          <span class="item-mark">
            {{ currentSpeech?.id === item.id ? 'PL' : 'SP' }}
          </span>
          <span class="item-copy">
            <strong>{{ item.prompt }}</strong>
            <small>{{ formatDate(item.createdAt) }} · {{ item.voiceId }} · {{ item.model }}</small>
          </span>
        </button>
      </div>
    </section>

    <div
      v-if="result"
      class="result-box"
    >
      <div class="result-summary">
        <h4>合成结果:</h4>
        <button
          class="text-btn result-toggle"
          type="button"
          @click="resultExpanded = !resultExpanded"
        >
          {{ resultExpanded ? '收起 JSON' : '查看 JSON' }}
        </button>
      </div>
      <pre v-if="resultExpanded">{{ formatResult(result) }}</pre>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import {
  cloneVoice,
  getVoices,
  synthesizeSpeech,
  uploadVoiceCloneFile,
  type SpeechFormat,
  type SpeechModel,
  type VoiceInfo
} from '../api/client';
import InputHistory from './InputHistory.vue';
import ApiProgress from './ApiProgress.vue';
import QuotaSummary from './QuotaSummary.vue';
import { useHistory } from '../composables/useHistory';
import { buildMediaObjectUrlFromHex, downloadMediaFromResponse } from '../utils/fileExport';
import { deleteLocalLibraryRecord, loadLocalLibraryRecords, saveLocalLibraryRecord, type LocalLibraryRecord } from '../utils/localLibrary';
import { famousQuotes, type FamousQuote } from '../data/famousQuotes';

type SpeechItem = {
  id: string;
  prompt: string;
  url: string;
  createdAt: number;
  voiceId: string;
  model: string;
  format: string;
  result: unknown;
};

type SpeechItemMeta = {
  prompt: string;
  voiceId: string;
  model: string;
  format: SpeechFormat;
};

type SpeechOptionsSnapshot = {
  model: SpeechModel;
  voiceId: string;
  speed: number;
  vol: number;
  pitch: number;
  format: SpeechFormat;
  sampleRate: number;
  bitrate: number;
  channel: number;
  languageBoost?: string;
};

const text = ref('');
const loading = ref(false);
const result = ref<any>(null);
const resultExpanded = ref(false);
const quoteSearch = ref('');
const selectedQuoteId = ref<number | null>(null);
const speechModels: SpeechModel[] = [
  'speech-2.8-hd',
  'speech-2.8-turbo',
  'speech-2.6-hd',
  'speech-2.6-turbo',
  'speech-02-hd',
  'speech-02-turbo',
  'speech-01-hd',
  'speech-01-turbo',
  'speech-01',
];
const model = ref<SpeechModel>('speech-2.8-hd');
const voiceId = ref('female-shaonv');
const speed = ref(1);
const volume = ref(1);
const pitch = ref(0);
const format = ref<SpeechFormat>('mp3');
const sampleRate = ref(32000);
const bitrate = ref(128000);
const channel = ref(1);
const languageBoost = ref('');
const voicesLoading = ref(false);
const voiceOptions = ref<VoiceInfo[]>([
  { voice_id: 'female-shaonv', voice_name: '默认女声' },
  { voice_id: 'male-qn-qingse', voice_name: '默认男声' },
]);
const cloneFile = ref<File | null>(null);
const cloneVoiceId = ref('');
const clonePreviewText = ref('');
const cloneNoiseReduction = ref(true);
const cloneVolumeNormalization = ref(true);
const cloneLoading = ref(false);
const cloneMessage = ref('');
const speechItems = ref<SpeechItem[]>([]);
const currentSpeech = ref<SpeechItem | null>(null);
const speechAudioRef = ref<HTMLAudioElement | null>(null);
const libraryLoading = ref(false);

const { history, addToHistory, deleteHistory, clearHistory } = useHistory('mmx_speech_history');

const filteredQuotes = computed(() => {
  const query = quoteSearch.value.trim().toLowerCase();
  if (!query) return famousQuotes;

  return famousQuotes.filter((quote) => {
    const searchable = [
      quote.category,
      quote.person,
      quote.origin,
      quote.era,
      quote.content,
      quote.tags.join(' '),
    ].join(' ').toLowerCase();

    return searchable.includes(query);
  });
});

const visibleQuotes = computed(() => filteredQuotes.value);

const selectQuote = (quote: FamousQuote) => {
  selectedQuoteId.value = quote.id;
  text.value = quote.content;
};

const selectHistory = (item: string) => {
  selectedQuoteId.value = null;
  text.value = item;
};

const formatDate = (ts: number) => {
  return new Date(ts).toLocaleString();
};

const performSynth = async () => {
  if (!text.value.trim() || loading.value) return;
  loading.value = true;
  result.value = null;
  resultExpanded.value = false;
  const startedAt = Date.now();
  const prompt = text.value;
  addToHistory(prompt);
  try {
    const speechOptions = {
      model: model.value,
      voiceId: voiceId.value,
      speed: speed.value,
      vol: volume.value,
      pitch: pitch.value,
      format: format.value,
      sampleRate: sampleRate.value,
      bitrate: bitrate.value,
      channel: channel.value,
      languageBoost: languageBoost.value || undefined,
    };
    result.value = await synthesizeSpeech(prompt, speechOptions);
    const pendingItem = addSpeechItemFromResult(result.value, null, startedAt, {
      prompt,
      voiceId: speechOptions.voiceId,
      model: speechOptions.model,
      format: speechOptions.format,
    });
    void persistSpeechLibraryRecord(prompt, speechOptions, result.value, startedAt, pendingItem?.id);
    downloadMediaFromResponse(result.value, { kind: 'audio', prompt });
  } finally {
    loading.value = false;
  }
};

const persistSpeechLibraryRecord = async (
  prompt: string,
  speechOptions: SpeechOptionsSnapshot,
  speechResult: unknown,
  startedAt: number,
  replaceId?: string,
) => {
  const libraryRecord = await saveLocalLibraryRecord('audio', prompt, {
    mmxPanel: 'speech',
    text: prompt,
    options: speechOptions,
    result: speechResult,
  });
  if (libraryRecord) {
    addSpeechItemFromResult(speechResult, libraryRecord, startedAt, {
      prompt,
      voiceId: speechOptions.voiceId,
      model: speechOptions.model,
      format: speechOptions.format,
    }, replaceId);
  }
};

const refreshVoices = async () => {
  voicesLoading.value = true;
  try {
    const data = await getVoices('all');
    const nextOptions = [
      ...normalizeVoices(data?.system_voice),
      ...normalizeVoices(data?.voice_cloning),
      ...normalizeVoices(data?.voice_generation),
    ];

    if (nextOptions.length > 0) {
      voiceOptions.value = dedupeVoices(nextOptions);
      if (!voiceOptions.value.some(item => item.voice_id === voiceId.value)) {
        voiceId.value = voiceOptions.value[0].voice_id;
      }
    }
  } finally {
    voicesLoading.value = false;
  }
};

const handleCloneFileChange = (event: Event) => {
  const input = event.target as HTMLInputElement;
  cloneFile.value = input.files?.[0] || null;
};

const performClone = async () => {
  if (!cloneFile.value || !cloneVoiceId.value.trim() || cloneLoading.value) return;
  cloneLoading.value = true;
  cloneMessage.value = '';
  resultExpanded.value = false;

  try {
    const uploadResult = await uploadVoiceCloneFile(cloneFile.value);
    const fileId = uploadResult?.file?.file_id;
    if (!fileId) {
      throw new Error('音频上传成功，但响应中没有 file_id');
    }

    const cleanVoiceId = cloneVoiceId.value.trim();
    const cloneResult = await cloneVoice({
      fileId,
      voiceId: cleanVoiceId,
      text: clonePreviewText.value,
      model: model.value,
      languageBoost: languageBoost.value || undefined,
      needNoiseReduction: cloneNoiseReduction.value,
      needVolumeNormalization: cloneVolumeNormalization.value,
    });

    result.value = cloneResult;
    voiceId.value = cleanVoiceId;
    voiceOptions.value = dedupeVoices([
      { voice_id: cleanVoiceId, voice_name: cleanVoiceId },
      ...voiceOptions.value,
    ]);
    cloneMessage.value = `音色已克隆：${cleanVoiceId}`;
  } finally {
    cloneLoading.value = false;
  }
};

const normalizeVoices = (items: unknown): VoiceInfo[] => {
  if (!Array.isArray(items)) return [];
  return items
    .filter((item): item is VoiceInfo => (
      item
      && typeof item === 'object'
      && typeof (item as VoiceInfo).voice_id === 'string'
    ));
};

const dedupeVoices = (items: VoiceInfo[]) => {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.voice_id)) return false;
    seen.add(item.voice_id);
    return true;
  });
};

const formatResult = (data: any) => JSON.stringify(data, null, 2);

const refreshSpeechLibrary = async () => {
  libraryLoading.value = true;
  try {
    const records = await loadLocalLibraryRecords('audio');
    const restored = records
      .filter(isSpeechRecord)
      .map(recordToSpeechItem)
      .filter((item): item is SpeechItem => Boolean(item))
      .slice(0, 20);
    revokeBlobUrls();
    speechItems.value = restored;
    currentSpeech.value = restored[0] || null;
  } finally {
    libraryLoading.value = false;
  }
};

const playSpeech = async (item: SpeechItem) => {
  currentSpeech.value = item;
  await nextTick();
  if (!speechAudioRef.value) return;
  speechAudioRef.value.currentTime = 0;
  void speechAudioRef.value.play();
};

const clearSpeechLibrary = async () => {
  const ids = speechItems.value.map(item => item.id);
  await Promise.all(ids.map(id => deleteLocalLibraryRecord(id)));
  revokeBlobUrls();
  speechItems.value = [];
  currentSpeech.value = null;
  result.value = null;
  resultExpanded.value = false;
};

const addSpeechItemFromResult = (
  speechResult: unknown,
  record: LocalLibraryRecord | null,
  createdAt: number,
  meta: SpeechItemMeta,
  replaceId?: string,
) => {
  const fromRecord = record ? recordToSpeechItem(record) : null;
  const fallbackUrl = buildFallbackAudioUrl(speechResult, meta.format);
  const item: SpeechItem | null = fromRecord || (fallbackUrl ? {
    id: record?.id || `${createdAt}`,
    prompt: meta.prompt,
    url: fallbackUrl,
    createdAt,
    voiceId: meta.voiceId,
    model: meta.model,
    format: meta.format,
    result: speechResult,
  } : null);

  if (!item) return null;
  if (replaceId && replaceId !== item.id) {
    const replaced = speechItems.value.find(existing => existing.id === replaceId);
    if (replaced?.url.startsWith('blob:')) {
      URL.revokeObjectURL(replaced.url);
    }
  }
  speechItems.value = [
    item,
    ...speechItems.value.filter(existing => existing.id !== item.id && existing.id !== replaceId),
  ].slice(0, 20);
  currentSpeech.value = item;
  void nextTick(() => {
    void speechAudioRef.value?.play();
  });
  return item;
};

const recordToSpeechItem = (record: LocalLibraryRecord): SpeechItem | null => {
  const url = [...record.media].reverse().find(media => media?.url)?.url;
  if (!url) return null;
  const response = record.response as any;
  const options = response?.options || {};
  const rawResult = response?.result || record.response;
  return {
    id: record.id,
    prompt: record.prompt,
    url,
    createdAt: Date.parse(record.createdAt) || Date.now(),
    voiceId: options.voiceId || rawResult?.voice_id || rawResult?.voiceId || 'voice',
    model: options.model || rawResult?.model || 'speech',
    format: options.format || detectAudioFormat(record) || 'audio',
    result: rawResult,
  };
};

const isSpeechRecord = (record: LocalLibraryRecord) => {
  const response = record.response as any;
  if (response?.mmxPanel === 'speech') return true;
  if (response?.mmxPanel === 'music' || typeof response?.lyrics === 'string') return false;
  return hasSpeechAudio(response);
};

const hasSpeechAudio = (value: unknown): boolean => {
  if (!value || typeof value !== 'object') return false;
  const data = (value as any).data;
  return Boolean(typeof data?.audio === 'string' || typeof (value as any).audio === 'string');
};

const buildFallbackAudioUrl = (speechResult: unknown, speechFormat: SpeechFormat) => {
  const audio = (speechResult as any)?.data?.audio || (speechResult as any)?.audio;
  return typeof audio === 'string' && audio.length > 32
    ? buildMediaObjectUrlFromHex(audio, mimeForSpeechFormat(speechFormat))
    : '';
};

const detectAudioFormat = (record: LocalLibraryRecord) => {
  const mime = record.media.find(media => media.mime)?.mime || '';
  if (mime.includes('wav')) return 'wav';
  if (mime.includes('flac')) return 'flac';
  if (mime.includes('mpeg') || mime.includes('mp3')) return 'mp3';
  return '';
};

const mimeForSpeechFormat = (speechFormat: SpeechFormat) => {
  if (speechFormat === 'wav') return 'audio/wav';
  if (speechFormat === 'flac') return 'audio/flac';
  if (speechFormat === 'pcm') return 'application/octet-stream';
  return 'audio/mpeg';
};

const revokeBlobUrls = () => {
  speechItems.value.forEach(item => {
    if (item.url.startsWith('blob:')) {
      URL.revokeObjectURL(item.url);
    }
  });
};

onMounted(() => {
  void refreshSpeechLibrary();
});

onBeforeUnmount(() => {
  revokeBlobUrls();
});
</script>

<style lang="less" scoped>
@import '../styles/panel.less';

.speech-options,
.clone-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 8px;

  &.full {
    grid-column: 1 / -1;
  }

  label {
    color: var(--text-secondary);
    font-size: 13px;
    font-weight: 700;
  }

  select,
  input[type="text"],
  input[type="file"] {
    min-height: 46px;
    padding: 10px 12px;
    color: var(--text-primary);
    background: var(--control-bg);
    border: 1px solid var(--border-strong);
    border-radius: var(--radius-md);
  }
}

.quote-library {
  padding: 16px;
  background: var(--control-bg);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-lg);
}

.quote-library-header {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(220px, 320px);
  gap: 14px;
  align-items: center;
  margin-bottom: 14px;

  h3 {
    margin: 0 0 4px;
    color: var(--text-primary);
    font-size: 16px;
    font-weight: 760;
  }

  p {
    margin: 0;
    color: var(--text-muted);
    font-size: 13px;
    font-weight: 650;
  }

  input[type="search"] {
    min-height: 42px;
    padding: 10px 12px;
    color: var(--text-primary);
    background: var(--bg-surface);
    border: 1px solid var(--border-strong);
    border-radius: var(--radius-md);
  }
}

.quote-results {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  max-height: 430px;
  overflow-y: auto;
  padding-right: 4px;
}

.quote-item {
  min-height: 92px;
  padding: 12px;
  text-align: left;
  color: var(--text-primary);
  background: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  cursor: pointer;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 10px;
  transition: border-color var(--motion-fast), background-color var(--motion-fast), transform var(--motion-fast);

  &:hover:not(:disabled) {
    border-color: var(--accent-primary);
    transform: translateY(-1px);
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.65;
  }

  &.selected {
    border-color: var(--accent-primary);
    background: var(--accent-soft);
  }
}

.quote-content {
  line-height: 1.5;
  font-size: 14px;
  font-weight: 700;
}

.quote-meta {
  color: var(--text-muted);
  font-size: 12px;
  font-weight: 650;
  line-height: 1.4;
}

.quote-empty {
  margin: 0;
  padding: 18px 0 4px;
  color: var(--text-muted);
  font-size: 13px;
  font-weight: 650;
}

.voice-field {
  grid-column: span 2;
}

.voice-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 10px;
}

.secondary-btn {
  min-height: 46px;
  padding: 10px 14px;
  color: var(--text-secondary);
  background: var(--control-bg);
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-md);
  cursor: pointer;
  font-weight: 700;

  &:hover:not(:disabled) {
    color: var(--text-primary);
    border-color: var(--accent-primary);
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.55;
  }
}

.voice-id-input {
  font-family: var(--font-mono);
}

.clone-section {
  margin-top: 24px;
  padding: 16px;
  background: var(--control-bg);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-lg);

  summary {
    cursor: pointer;
    color: var(--text-primary);
    font-weight: 760;
  }

  &[open] summary {
    margin-bottom: 16px;
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

.clone-btn {
  align-self: end;
}

.clone-message {
  margin-top: 14px;
  color: var(--success);
  font-size: 13px;
  font-weight: 700;
}

.result-summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;

  h4 {
    margin: 0;
  }
}

.result-toggle {
  flex: 0 0 auto;
}

.speech-library {
  margin-top: 24px;
  padding: 16px;
  background: var(--control-bg);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-lg);
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 14px;

  h3,
  p {
    margin: 0;
  }

  h3 {
    color: var(--text-primary);
    font-size: 16px;
    font-weight: 760;
  }

  p {
    margin-top: 4px;
    color: var(--text-muted);
    font-size: 12px;
    font-weight: 650;
  }
}

.section-actions {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.text-btn {
  min-height: 40px;
  padding: 8px 12px;
  color: var(--accent-primary);
  background: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  cursor: pointer;
  font-size: 13px;
  font-weight: 750;

  &:hover:not(:disabled) {
    border-color: var(--accent-primary);
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.55;
  }

  &.danger {
    color: var(--error);
  }
}

.speech-player {
  margin-bottom: 14px;
  padding: 14px;
  background: var(--accent-soft);
  border: 1px solid var(--accent-primary);
  border-radius: var(--radius-md);
}

.speech-player-meta {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;

  h4,
  p {
    margin: 0;
  }

  h4 {
    color: var(--text-primary);
    font-size: 15px;
    font-weight: 760;
    line-height: 1.45;
  }

  p {
    margin-top: 3px;
    color: var(--text-muted);
    font-size: 12px;
    font-weight: 650;
  }
}

.speech-mark,
.item-mark {
  flex: 0 0 auto;
  width: 40px;
  height: 40px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--text-on-accent);
  background: var(--accent-gradient);
  border-radius: var(--radius-sm);
  font-size: 11px;
  font-weight: 850;
}

.speech-audio {
  width: 100%;
}

.speech-list {
  display: grid;
  gap: 10px;
}

.speech-item {
  width: 100%;
  min-height: 68px;
  padding: 12px;
  display: flex;
  align-items: center;
  gap: 12px;
  text-align: left;
  color: var(--text-primary);
  background: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: border-color var(--motion-fast), background-color var(--motion-fast), transform var(--motion-fast), box-shadow var(--motion-fast);

  &:hover {
    border-color: var(--accent-primary);
    box-shadow: var(--shadow-sm);
    transform: translateX(3px);
  }

  &.active {
    background: var(--accent-soft);
    border-color: var(--accent-primary);
  }
}

.item-copy {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;

  strong {
    overflow: hidden;
    color: var(--text-primary);
    font-size: 14px;
    font-weight: 700;
    line-height: 1.35;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  small {
    color: var(--text-muted);
    font-size: 11px;
    font-weight: 650;
  }
}

@media (max-width: 900px) {
  .speech-options,
  .clone-grid {
    grid-template-columns: 1fr;
  }

  .quote-library-header,
  .quote-results {
    grid-template-columns: 1fr;
  }

  .quote-results {
    max-height: 360px;
  }

  .voice-field {
    grid-column: auto;
  }

  .voice-row {
    grid-template-columns: 1fr;
  }

  .section-header {
    align-items: flex-start;
    flex-direction: column;
  }

  .item-copy strong {
    white-space: normal;
  }
}
</style>
