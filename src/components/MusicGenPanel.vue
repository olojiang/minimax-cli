<template>
  <div class="music-gen-panel panel">
    <div class="panel-header">
      <h2>音乐生成 (Music Generation)</h2>
      <div class="stats" v-if="musics.length > 0">
        已生成 {{ musics.length }} 首
      </div>
    </div>
    <QuotaSummary title="音乐生成配额" :model-patterns="['music-2.6']" />

    <div class="input-group">
      <div class="field">
        <label>风格描述</label>
        <input 
          v-model="prompt" 
          type="text" 
          placeholder="例如：轻音乐、雨声、温柔女声" 
          :disabled="loading"
        />
      </div>
      <div class="field">
        <label>歌词 (可选)</label>
        <textarea 
          v-model="lyrics" 
          placeholder="输入歌词，留空将由 AI 自动创作..." 
          :disabled="loading"
          rows="3"
        ></textarea>
      </div>
      <button class="btn btn-primary" :class="{ loading: loading }" @click="performGen" :disabled="loading || !prompt.trim()">
        <span class="icon" aria-hidden="true">♪</span>
        {{ loading ? '正在谱曲...' : '开始生成音乐' }}
      </button>
    </div>
    <ApiProgress v-if="loading" title="正在生成音乐" detail="音乐任务已提交，正在合成音频并写入本地曲库" />

    <!-- 当前选中 / 正在播放 -->
    <div v-if="currentMusic" class="now-playing">
      <div class="player-card">
        <div class="music-info">
          <div class="music-icon" aria-hidden="true">♪</div>
          <div class="text-content">
            <h3>{{ currentMusic.prompt }}</h3>
            <p class="timestamp">{{ formatDate(currentMusic.timestamp) }}</p>
          </div>
          <button class="play-status-btn" @click="togglePlay">
            {{ isPlaying ? 'Pause' : 'Play' }}
          </button>
        </div>
        <div class="player-hint">
          正在使用全局播放器持续播放中...
        </div>
      </div>
    </div>

    <!-- 音乐库 -->
    <div v-if="musics.length > 0" class="music-library">
      <div class="section-header">
        <h3>音乐库 (最近 {{ musics.length }} 首)</h3>
        <button class="text-btn" @click="clearLibrary">清空列表</button>
      </div>
      <div class="music-grid">
        <div 
          v-for="music in musics" 
          :key="music.id" 
          class="music-item"
          :class="{ active: currentMusic?.id === music.id }"
          @click="selectMusic(music)"
        >
          <div class="item-icon">
            <span v-if="isPlaying && currentMusic?.id === music.id">ON</span>
            <span v-else-if="currentMusic?.id === music.id">PL</span>
            <span v-else>MU</span>
          </div>
          <div class="item-info">
            <div class="item-prompt">{{ music.prompt }}</div>
            <div class="item-meta">{{ formatDate(music.timestamp) }}</div>
          </div>
        </div>
      </div>
    </div>

    <!-- 输入历史 -->
    <InputHistory 
      :history="history" 
      title="最近输入"
      @select="selectHistory"
      @delete="deleteHistory"
      @clear="clearHistory"
    />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { generateMusic } from '../api/client';
import InputHistory from './InputHistory.vue';
import ApiProgress from './ApiProgress.vue';
import QuotaSummary from './QuotaSummary.vue';
import { useHistory } from '../composables/useHistory';
import { useMusicStore, type MusicItem } from '../composables/useMusicStore';

const prompt = ref('');
const lyrics = ref('');
const loading = ref(false);

const { 
  musics, 
  currentMusic, 
  isPlaying, 
  addMusic, 
  playMusic, 
  togglePlay, 
  clearLibrary 
} = useMusicStore();

const { history, addToHistory, deleteHistory, clearHistory } = useHistory('mmx_music_history');

const formatDate = (ts: number) => {
  return new Date(ts).toLocaleString();
};

const selectHistory = (item: string) => {
  prompt.value = item;
};

const selectMusic = (music: MusicItem) => {
  playMusic(music);
};

const performGen = async () => {
  if (!prompt.value.trim() || loading.value) return;
  loading.value = true;
  
  addToHistory(prompt.value);
  
  try {
    const result = await generateMusic(prompt.value, lyrics.value);
    
    if (result?.data?.audio) {
      const newMusicData = {
        id: result.trace_id || Math.random().toString(36).substr(2, 9),
        prompt: prompt.value,
        lyrics: lyrics.value,
        audioHex: result.data.audio,
        timestamp: Date.now()
      };
      
      const added = await addMusic(newMusicData);
      playMusic(added);
      
      lyrics.value = '';
    }
  } catch (error) {
    console.error('Generation failed:', error);
  } finally {
    loading.value = false;
  }
};
</script>


<style lang="less" scoped>
@import '../styles/panel.less';

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
  
  h2 { margin: 0; }
  .stats {
    font-size: 13px;
    color: var(--text-muted);
    background: var(--control-bg);
    border: 1px solid var(--border-subtle);
    padding: 4px 12px;
    border-radius: 20px;
  }
}

.input-group {
  .field {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-bottom: 16px;
    
    label {
      font-size: 13px;
      font-weight: 600;
      color: var(--text-secondary);
    }
    
  }
}

.now-playing {
  margin-top: 32px;
  
  .player-card {
    background: var(--accent-gradient);
    padding: 24px;
    border-radius: var(--radius-xl);
    color: var(--text-on-accent);
    box-shadow: var(--shadow-accent);
    transition: transform var(--motion-med), box-shadow var(--motion-med);

    &:hover {
      transform: translateY(-2px);
      box-shadow: var(--shadow-accent), 0 18px 36px rgba(0, 0, 0, 0.16);
    }
    
    .music-info {
      display: flex;
      gap: 16px;
      margin-bottom: 12px;
      align-items: center;
      
      .music-icon {
        font-size: 32px;
        background: rgba(255,255,255,0.2);
        width: 64px;
        height: 64px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: var(--radius-lg);
      }
      
      .text-content {
        flex: 1;
        h3 {
          margin: 0 0 4px 0;
          font-size: 18px;
          overflow: hidden;
          text-overflow: ellipsis;
          display: -webkit-box;
          -webkit-line-clamp: 1;
          -webkit-box-orient: vertical;
        }
        .timestamp {
          margin: 0;
          font-size: 12px;
          opacity: 0.8;
        }
      }

      .play-status-btn {
        background: white;
        color: var(--accent-primary);
        border: none;
        min-width: 64px;
        height: 48px;
        border-radius: 999px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 12px;
        font-weight: 800;
        cursor: pointer;
        transition: transform var(--motion-fast), box-shadow var(--motion-med);
        box-shadow: var(--shadow-sm);
        &:hover {
          transform: translateY(-1px) scale(1.03);
        }
        &:active {
          transform: scale(0.96);
        }
      }
    }

    .player-hint {
      font-size: 11px;
      opacity: 0.7;
      text-align: center;
      padding-top: 12px;
      border-top: 1px solid rgba(255,255,255,0.2);
    }
  }
}

.music-library {
  margin-top: 32px;
  
  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
    
    h3 { margin: 0; font-size: 16px; }
    .text-btn {
      background: none;
      border: none;
      color: var(--accent-primary);
      cursor: pointer;
      font-size: 13px;
      &:hover { text-decoration: underline; }
    }
  }
  
  .music-grid {
    display: grid;
    gap: 12px;
    
    .music-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px;
      background: var(--bg-surface);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-md);
      cursor: pointer;
      transition: transform var(--motion-med), border-color var(--motion-med), background-color var(--motion-med), box-shadow var(--motion-med);
      
      &:hover {
        border-color: var(--accent-primary);
        transform: translateX(4px);
        box-shadow: var(--shadow-sm);
      }

      &:active {
        transform: translateX(4px) scale(0.99);
      }
      
      &.active {
        background: var(--accent-soft);
        border-color: var(--accent-primary);
      }
      
      .item-icon {
        font-size: 11px;
        font-weight: 800;
        width: 40px;
        height: 40px;
        background: var(--control-bg);
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: var(--radius-sm);
      }
      
      .item-info {
        flex: 1;
        .item-prompt {
          font-size: 14px;
          font-weight: 500;
          margin-bottom: 2px;
          display: -webkit-box;
          -webkit-line-clamp: 1;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        .item-meta {
          font-size: 11px;
          color: var(--text-muted);
        }
      }
    }
  }
}
</style>
