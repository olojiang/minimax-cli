import { flushPromises, mount } from '@vue/test-utils';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MusicGenPanel from './MusicGenPanel.vue';
import { generateMusic } from '../api/client';

vi.mock('../api/client', () => ({
  checkQuota: vi.fn().mockResolvedValue({ model_remains: [] }),
  generateMusic: vi.fn(),
}));

vi.mock('../composables/useMusicStore', () => ({
  useMusicStore: () => ({
    musics: [],
    currentMusic: null,
    isPlaying: false,
    addMusic: vi.fn(async (item) => item),
    playMusic: vi.fn(),
    togglePlay: vi.fn(),
    clearLibrary: vi.fn(),
  }),
}));

describe('MusicGenPanel.vue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('submits music prompt with selected options', async () => {
    (generateMusic as any).mockResolvedValue({ data: { audio: 'abcdef' } });
    const wrapper = mount(MusicGenPanel);
    const textareas = wrapper.findAll('textarea');

    await textareas[0].setValue('轻音乐、雨声、温柔女声');
    await textareas[1].setValue('歌词内容');
    await wrapper.findAll('input[type="checkbox"]')[0].setValue(true);
    await wrapper.findAll('input[type="checkbox"]')[1].setValue(false);
    await wrapper.find('#music-format').setValue('wav');
    await wrapper.find('#music-sample-rate').setValue('48000');
    await wrapper.find('#music-bitrate').setValue('256000');
    await wrapper.find('.btn-primary').trigger('click');
    await flushPromises();

    expect(generateMusic).toHaveBeenCalledWith('轻音乐、雨声、温柔女声', {
      lyrics: '歌词内容',
      lyricsOptimizer: false,
      instrumental: true,
      format: 'wav',
      sampleRate: 48000,
      bitrate: 256000,
    });
  });
});
