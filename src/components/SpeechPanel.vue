<template>
  <div class="speech-panel panel">
    <h2>语音合成 (Speech Synthesis)</h2>
    <QuotaSummary
      title="语音合成配额"
      :model-patterns="['speech-2.8', 'speech-2.6', 'speech-02', 'speech-01', 'speech-hd', 'speech-turbo']"
    />
    <div class="input-group">
      <textarea
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

    <div
      v-if="result"
      class="result-box"
    >
      <h4>合成结果:</h4>
      <!-- Provide audio element if base64 or url is returned -->
      <pre>{{ formatResult(result) }}</pre>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
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
import { downloadMediaFromResponse } from '../utils/fileExport';
import { saveLocalLibraryRecord } from '../utils/localLibrary';

const text = ref('');
const loading = ref(false);
const result = ref<any>(null);
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

const { history, addToHistory, deleteHistory, clearHistory } = useHistory('mmx_speech_history');

const selectHistory = (item: string) => {
  text.value = item;
};

const performSynth = async () => {
  if (!text.value.trim() || loading.value) return;
  loading.value = true;
  result.value = null;
  addToHistory(text.value);
  try {
    result.value = await synthesizeSpeech(text.value, {
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
    });
    await saveLocalLibraryRecord('audio', text.value, result.value);
    downloadMediaFromResponse(result.value, { kind: 'audio', prompt: text.value });
  } finally {
    loading.value = false;
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

@media (max-width: 900px) {
  .speech-options,
  .clone-grid {
    grid-template-columns: 1fr;
  }

  .voice-field {
    grid-column: auto;
  }

  .voice-row {
    grid-template-columns: 1fr;
  }
}
</style>
