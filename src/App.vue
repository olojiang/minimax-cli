<template>
  <div class="app-container">
    <header class="header">
      <div class="brand-lockup">
        <span class="brand-mark" aria-hidden="true">M</span>
        <div>
          <h1>MiniMax 纪</h1>
          <p>Creative API Workbench</p>
        </div>
      </div>
      <button
        class="theme-toggle"
        :class="{ active: isDark }"
        @click="toggleTheme"
        :aria-label="isDark ? '切换到浅色模式' : '切换到深色模式'"
        :title="isDark ? '切换到浅色模式' : '切换到深色模式'"
      >
        <span class="toggle-track">
          <span class="toggle-thumb"></span>
        </span>
        <span class="toggle-label">{{ isDark ? 'Dark' : 'Light' }}</span>
      </button>
    </header>
    
    <main class="main-content">
      <div class="sidebar">
        <ul class="nav-list" aria-label="MiniMax 功能导航">
          <li
            v-for="tab in tabs"
            :key="tab.id"
            :class="{ active: currentTab === tab.id }"
            :aria-current="currentTab === tab.id ? 'page' : undefined"
            @click="selectTab(tab.id)"
            @keyup.enter="selectTab(tab.id)"
            @keyup.space="selectTab(tab.id)"
            role="button"
            tabindex="0"
          >
            <span class="nav-mark" aria-hidden="true">{{ tab.mark }}</span>
            <span>
              <strong>{{ tab.title }}</strong>
              <small>{{ tab.subtitle }}</small>
            </span>
          </li>
        </ul>

        <div v-if="currentMusic" class="global-mini-player">
          <div class="player-content">
            <div class="music-info">
              <span class="icon" aria-hidden="true">♪</span>
              <div class="text">
                <div class="name">{{ currentMusic.prompt }}</div>
                <div class="state">{{ isPlaying ? '正在播放...' : '已暂停' }}</div>
              </div>
            </div>
            <audio 
              :ref="bindAudioRef" 
              :src="currentMusic.url" 
              controls 
              class="mini-audio"
              @play="isPlaying = true"
              @pause="isPlaying = false"
              autoplay
            ></audio>
          </div>
        </div>
      </div>
      
      <div class="center-pane">
        <SettingsPanel v-if="currentTab === 'settings'" />
        <SearchPanel v-if="currentTab === 'search'" />
        <VisionPanel v-if="currentTab === 'vision'" />
        <ChatPanel v-if="currentTab === 'chat'" />
        <ImageGenPanel v-if="currentTab === 'image'" />
        <SpeechPanel v-if="currentTab === 'speech'" />
        <VideoGenPanel v-if="currentTab === 'video'" />
        <MusicGenPanel v-if="currentTab === 'music'" />
      </div>
      
      <div class="right-pane" :class="{ 'is-collapsed': isLogViewerCollapsed }">
        <LogViewer
          :collapsed="isLogViewerCollapsed"
          @update:collapsed="setLogViewerCollapsed"
        />
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, type ComponentPublicInstance } from 'vue';
import SettingsPanel from './components/SettingsPanel.vue';
import SearchPanel from './components/SearchPanel.vue';
import VisionPanel from './components/VisionPanel.vue';
import ChatPanel from './components/ChatPanel.vue';
import ImageGenPanel from './components/ImageGenPanel.vue';
import SpeechPanel from './components/SpeechPanel.vue';
import VideoGenPanel from './components/VideoGenPanel.vue';
import MusicGenPanel from './components/MusicGenPanel.vue';
import LogViewer from './components/LogViewer.vue';
import { useMusicStore } from './composables/useMusicStore';
import { readStorage, writeStorage } from './utils/safeStorage';

type Tab = 'settings' | 'search' | 'vision' | 'chat' | 'image' | 'speech' | 'video' | 'music';
const currentTab = ref<Tab>('settings');
const tabs: Array<{ id: Tab; title: string; subtitle: string; mark: string }> = [
  { id: 'settings', title: '设置与配额', subtitle: 'Settings', mark: 'SE' },
  { id: 'search', title: '联网搜索', subtitle: 'Search', mark: 'SR' },
  { id: 'vision', title: '图像理解', subtitle: 'Vision', mark: 'VI' },
  { id: 'chat', title: '文本对话', subtitle: 'Chat', mark: 'CH' },
  { id: 'image', title: '图像生成', subtitle: 'Image', mark: 'IM' },
  { id: 'speech', title: '语音合成', subtitle: 'Speech', mark: 'SP' },
  { id: 'video', title: '视频生成', subtitle: 'Video', mark: 'VD' },
  { id: 'music', title: '音乐生成', subtitle: 'Music', mark: 'MU' },
];
const tabIds = new Set<Tab>(tabs.map(tab => tab.id));

const parseHashTab = (): Tab | null => {
  const hash = window.location.hash.replace(/^#\/?/, '').trim();
  return tabIds.has(hash as Tab) ? hash as Tab : null;
};

const syncTabFromHash = () => {
  currentTab.value = parseHashTab() || 'settings';
};

const selectTab = (tab: Tab) => {
  currentTab.value = tab;
  const nextHash = `#${tab}`;
  if (window.location.hash !== nextHash) {
    window.location.hash = tab;
  }
};

const { currentMusic, isPlaying, audioRef, init: initMusicStore } = useMusicStore();
const bindAudioRef = (element: Element | ComponentPublicInstance | null) => {
  audioRef.value = element as HTMLAudioElement | null;
};

const logViewerStorageKey = 'mmx_log_viewer_collapsed';
const isLogViewerCollapsed = ref(readStorage(logViewerStorageKey) === 'true');

const setLogViewerCollapsed = (collapsed: boolean) => {
  isLogViewerCollapsed.value = collapsed;
  writeStorage(logViewerStorageKey, collapsed ? 'true' : 'false');
};

// Theme Toggle Logic
const isDark = ref(false);

const applyTheme = (dark: boolean) => {
  if (dark) {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
};

const toggleTheme = () => {
  isDark.value = !isDark.value;
  applyTheme(isDark.value);
  writeStorage('mmx-theme', isDark.value ? 'dark' : 'light');
};

onMounted(() => {
  syncTabFromHash();
  window.addEventListener('hashchange', syncTabFromHash);
  void initMusicStore();
  const savedTheme = readStorage('mmx-theme');
  if (savedTheme === 'dark' || (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
    isDark.value = true;
    applyTheme(true);
  }
});

onBeforeUnmount(() => {
  window.removeEventListener('hashchange', syncTabFromHash);
});
</script>

<style lang="less">
.app-container {
  display: flex;
  flex-direction: column;
  height: 100dvh;
  overflow: hidden;
  background: var(--bg-radial);
}

.header {
  position: sticky;
  top: 0;
  z-index: 10;
  padding: 16px 32px;
  background: var(--header-bg);
  backdrop-filter: blur(18px);
  border-bottom: 1px solid var(--border-subtle);
  display: flex;
  align-items: center;
  justify-content: space-between;
  box-shadow: var(--shadow-header);

  .brand-lockup {
    display: flex;
    align-items: center;
    gap: 14px;
  }

  .brand-mark {
    width: 42px;
    height: 42px;
    border-radius: 10px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: var(--accent-gradient);
    color: var(--text-on-accent);
    font-size: 17px;
    font-weight: 800;
    box-shadow: var(--shadow-accent);
  }

  h1, p {
    margin: 0;
  }

  h1 {
    font-size: 20px;
    font-weight: 760;
    color: var(--text-primary);
  }

  p {
    margin-top: 2px;
    color: var(--text-muted);
    font-size: 12px;
    font-weight: 600;
    text-transform: uppercase;
  }
  
  .theme-toggle {
    min-height: 44px;
    padding: 6px 10px 6px 6px;
    background: var(--control-bg);
    border: 1px solid var(--border-strong);
    color: var(--text-primary);
    border-radius: 999px;
    display: inline-flex;
    align-items: center;
    gap: 10px;
    justify-content: center;
    cursor: pointer;
    font-size: 13px;
    font-weight: 700;
    transition: transform var(--motion-fast), box-shadow var(--motion-med), border-color var(--motion-med), background-color var(--motion-med);
    box-shadow: var(--shadow-sm);

    .toggle-track {
      width: 54px;
      height: 32px;
      border-radius: 999px;
      padding: 4px;
      display: inline-flex;
      align-items: center;
      background: var(--bg-surface-active);
      transition: background-color var(--motion-med);
    }

    .toggle-thumb {
      width: 24px;
      height: 24px;
      border-radius: 50%;
      background: var(--text-primary);
      box-shadow: var(--shadow-sm);
      transform: translateX(0);
      transition: transform var(--motion-med), background-color var(--motion-med);
    }

    &.active .toggle-thumb {
      transform: translateX(22px);
      background: var(--accent-primary);
    }
    
    &:hover {
      transform: translateY(-1px);
      box-shadow: var(--shadow-md);
      border-color: var(--accent-primary);
    }
    
    &:active {
      transform: scale(0.95);
    }
  }
}

.main-content {
  display: flex;
  flex: 1;
  overflow: hidden;
  max-width: 1600px;
  margin: 0 auto;
  width: 100%;
  padding: 24px 32px;
  gap: 24px;
  
  .sidebar {
    flex: 0 0 256px;
    background: var(--panel-bg);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-lg);
    padding: 16px;
    display: flex;
    flex-direction: column;
    height: fit-content;
    max-height: 100%;
    box-shadow: var(--shadow-lg);
    
    .nav-list {
      list-style: none;
      padding: 0;
      margin: 0 0 24px 0;
      display: flex;
      flex-direction: column;
      gap: 4px;
      overflow-y: auto;
      overflow-x: hidden;
      
      li {
        min-height: 56px;
        padding: 10px 12px;
        cursor: pointer;
        border-radius: var(--radius-md);
        color: var(--text-secondary);
        font-weight: 500;
        font-size: 14px;
        transition: transform var(--motion-fast), background-color var(--motion-med), color var(--motion-med), box-shadow var(--motion-med);
        display: flex;
        align-items: center;
        gap: 12px;

        .nav-mark {
          flex: 0 0 34px;
          width: 34px;
          height: 34px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 9px;
          color: var(--text-muted);
          background: var(--control-bg);
          border: 1px solid var(--border-subtle);
          font-size: 11px;
          font-weight: 800;
        }

        strong, small {
          display: block;
          line-height: 1.2;
        }

        small {
          margin-top: 3px;
          color: var(--text-muted);
          font-size: 11px;
          font-weight: 600;
        }
        
        &:hover {
          background-color: var(--bg-surface-hover);
          color: var(--text-primary);
          transform: translateX(3px);
        }

        &:active {
          transform: translateX(3px) scale(0.985);
        }
        
        &.active {
          background: var(--accent-soft);
          color: var(--text-primary);
          box-shadow: inset 3px 0 0 var(--accent-primary);

          .nav-mark {
            color: var(--text-on-accent);
            background: var(--accent-gradient);
            border-color: transparent;
            box-shadow: var(--shadow-accent);
          }
        }
      }
    }

    .global-mini-player {
      margin-top: auto;
      padding-top: 16px;
      border-top: 1px solid var(--border-subtle);
      
      .player-content {
        background: var(--accent-gradient);
        border-radius: var(--radius-lg);
        padding: 12px;
        color: var(--text-on-accent);
        box-shadow: var(--shadow-accent);
        
        .music-info {
          display: flex;
          gap: 10px;
          margin-bottom: 8px;
          
          .icon {
            font-size: 20px;
            background: rgba(255,255,255,0.2);
            width: 32px;
            height: 32px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 8px;
          }
          
          .text {
            flex: 1;
            min-width: 0;
            .name {
              font-size: 12px;
              font-weight: 600;
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
            }
            .state {
              font-size: 10px;
              opacity: 0.8;
            }
          }
        }
        
        .mini-audio {
          width: 100%;
          height: 32px;
          filter: invert(100%) brightness(1.5);
        }
      }
    }
  }
  
  .center-pane {
    flex: 2;
    min-width: 0; 
    min-height: 0;
    display: flex;
    flex-direction: column;
    overflow-y: auto;
    overflow-x: hidden;
    padding-right: 8px; /* For scrollbar breathing room */
  }
  
  .right-pane {
    flex: 1;
    min-width: 320px;
    background: var(--panel-bg);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-lg);
    overflow: hidden;
    box-shadow: var(--shadow-lg);
    display: flex;
    flex-direction: column;
    transition: flex-basis var(--motion-med), min-width var(--motion-med), width var(--motion-med), opacity var(--motion-fast), border-color var(--motion-med), box-shadow var(--motion-med);

    &.is-collapsed {
      flex: 0 0 0;
      width: 0;
      min-width: 0;
      border-color: transparent;
      box-shadow: none;
      overflow: visible;
      opacity: 1;
    }
  }
}

@media (max-width: 1024px) {
  .header {
    padding: 16px 20px;
  }
  .main-content {
    flex-direction: column;
    padding: 20px;
    overflow-y: auto;
    overflow-x: hidden;
    gap: 20px;
    
    .sidebar {
      flex: none;
      width: 100%;
      padding: 12px;
      
      .nav-list {
        flex-direction: row;
        flex-wrap: wrap;
        gap: 8px;
        margin-bottom: 12px;
        
        li {
          flex: 1 1 auto;
          text-align: center;
          justify-content: center;
          padding: 10px 16px;
          
          &.active {
            box-shadow: inset 0 -2px 0 var(--accent-primary);
            background: var(--bg-surface-hover);
          }
        }
      }

      .global-mini-player {
        margin-top: 0;
        padding-top: 12px;
      }
    }
    
    .center-pane, .right-pane {
      flex: none;
      width: 100%;
      overflow: visible;
    }
    
    .right-pane {
      height: 400px; /* Fixed height for log viewer on mobile */

      &.is-collapsed {
        width: 0;
        height: 0;
        min-height: 0;
        align-self: flex-end;
      }
    }
  }
}
</style>
