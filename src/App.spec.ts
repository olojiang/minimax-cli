import { mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { nextTick } from 'vue';
import App from './App.vue';

vi.mock('./composables/useMusicStore', () => ({
  useMusicStore: () => ({
    currentMusic: null,
    isPlaying: false,
    audioRef: { value: null },
    init: vi.fn(),
  }),
}));

const stubs = {
  SettingsPanel: { template: '<section data-test="settings-panel" />' },
  SearchPanel: { template: '<section data-test="search-panel" />' },
  VisionPanel: { template: '<section data-test="vision-panel" />' },
  ChatPanel: { template: '<section data-test="chat-panel" />' },
  ImageGenPanel: { template: '<section data-test="image-panel" />' },
  SpeechPanel: { template: '<section data-test="speech-panel" />' },
  VideoGenPanel: { template: '<section data-test="video-panel" />' },
  MusicGenPanel: { template: '<section data-test="music-panel" />' },
  LogViewer: {
    props: ['collapsed'],
    emits: ['update:collapsed'],
    template: '<aside data-test="log-viewer" :data-collapsed="String(collapsed)" @click="$emit(\'update:collapsed\', true)" />',
  },
};

const mountApp = () => mount(App, {
  global: {
    stubs,
  },
});

describe('App.vue hash tab routing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    window.history.replaceState(null, '', '/');
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: vi.fn().mockReturnValue({ matches: false }),
    });
  });

  it('restores the active tab from the URL hash on mount', async () => {
    window.history.replaceState(null, '', '/#vision');

    const wrapper = mountApp();
    await nextTick();

    expect(wrapper.find('[data-test="vision-panel"]').exists()).toBe(true);
    expect(wrapper.find('[data-test="settings-panel"]').exists()).toBe(false);
  });

  it('updates the URL hash when selecting a tab', async () => {
    const wrapper = mountApp();

    await wrapper.findAll('.nav-list li')[1].trigger('click');

    expect(window.location.hash).toBe('#search');
    expect(wrapper.find('[data-test="search-panel"]').exists()).toBe(true);
  });

  it('updates the active tab when the hash changes', async () => {
    const wrapper = mountApp();

    window.location.hash = '#music';
    window.dispatchEvent(new Event('hashchange'));
    await nextTick();

    expect(wrapper.find('[data-test="music-panel"]').exists()).toBe(true);
  });

  it('restores the collapsed log viewer state from storage', () => {
    localStorage.setItem('mmx_log_viewer_collapsed', 'true');

    const wrapper = mountApp();

    expect(wrapper.find('.right-pane').classes()).toContain('is-collapsed');
    expect(wrapper.find('[data-test="log-viewer"]').attributes('data-collapsed')).toBe('true');
  });

  it('persists collapsed log viewer changes', async () => {
    const wrapper = mountApp();

    await wrapper.find('[data-test="log-viewer"]').trigger('click');

    expect(wrapper.find('.right-pane').classes()).toContain('is-collapsed');
    expect(localStorage.getItem('mmx_log_viewer_collapsed')).toBe('true');
  });
});
