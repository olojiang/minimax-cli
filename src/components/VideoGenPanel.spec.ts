import { flushPromises, mount } from '@vue/test-utils';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import VideoGenPanel from './VideoGenPanel.vue';
import { generateVideo } from '../api/client';

vi.mock('../api/client', () => ({
  checkQuota: vi.fn().mockResolvedValue({ model_remains: [] }),
  generateVideo: vi.fn(),
}));

vi.mock('../utils/fileExport', () => ({
  downloadMediaFromResponse: vi.fn(),
}));

vi.mock('../utils/localLibrary', () => ({
  saveLocalLibraryRecord: vi.fn().mockResolvedValue(null),
}));

describe('VideoGenPanel.vue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('submits video prompt with selected options', async () => {
    (generateVideo as any).mockResolvedValue({ task_id: 'task-1' });
    const wrapper = mount(VideoGenPanel);

    await wrapper.find('textarea').setValue('海浪在日落时分拍打沙滩');
    await wrapper.find('#video-model').setValue('MiniMax-Hailuo-02');
    await wrapper.find('#video-duration').setValue('10');
    await wrapper.findAll('input[type="checkbox"]')[0].setValue(false);
    await wrapper.findAll('input[type="checkbox"]')[1].setValue(true);
    await wrapper.findAll('input[type="checkbox"]')[2].setValue(true);
    await wrapper.find('.btn').trigger('click');
    await flushPromises();

    expect(generateVideo).toHaveBeenCalledWith('海浪在日落时分拍打沙滩', {
      model: 'MiniMax-Hailuo-02',
      duration: 10,
      resolution: '768P',
      promptOptimizer: false,
      fastPretreatment: true,
      watermark: true,
    });
  });

  it('limits non-Hailuo models to supported options', async () => {
    (generateVideo as any).mockResolvedValue({ task_id: 'task-1' });
    const wrapper = mount(VideoGenPanel);

    await wrapper.find('textarea').setValue('海浪在日落时分拍打沙滩');
    await wrapper.find('#video-model').setValue('T2V-01-Director');
    await wrapper.find('#video-resolution').setValue('1080P');
    await wrapper.find('.btn').trigger('click');
    await flushPromises();

    expect(wrapper.find('#video-duration').text()).toBe('6 秒');
    expect(generateVideo).toHaveBeenCalledWith('海浪在日落时分拍打沙滩', {
      model: 'T2V-01-Director',
      duration: 6,
      resolution: '1080P',
      promptOptimizer: true,
      fastPretreatment: false,
      watermark: false,
    });
  });

  it('selects prompt history without generating immediately', async () => {
    localStorage.setItem('mmx_video_history', JSON.stringify(['历史视频提示词']));
    const wrapper = mount(VideoGenPanel);
    await flushPromises();

    await wrapper.find('.history-text').trigger('click');

    expect((wrapper.find('textarea').element as HTMLTextAreaElement).value).toBe('历史视频提示词');
    expect(generateVideo).not.toHaveBeenCalled();
  });

  it('persists and manages video prompt history', async () => {
    (generateVideo as any).mockResolvedValue({ task_id: 'task-1' });
    const wrapper = mount(VideoGenPanel);

    await wrapper.find('textarea').setValue('第一段视频提示词');
    await wrapper.find('.btn').trigger('click');
    await flushPromises();

    await wrapper.find('textarea').setValue('第二段视频提示词');
    await wrapper.find('.btn').trigger('click');
    await flushPromises();

    expect(wrapper.findAll('.history-text').map(item => item.text())).toEqual([
      '第二段视频提示词',
      '第一段视频提示词',
    ]);
    expect(JSON.parse(localStorage.getItem('mmx_video_history') || '[]')).toEqual([
      '第二段视频提示词',
      '第一段视频提示词',
    ]);

    await wrapper.findAll('.history-delete')[1].trigger('click');
    await flushPromises();

    expect(wrapper.findAll('.history-text').map(item => item.text())).toEqual(['第二段视频提示词']);
    expect(JSON.parse(localStorage.getItem('mmx_video_history') || '[]')).toEqual(['第二段视频提示词']);

    await wrapper.find('.history-clear').trigger('click');
    await flushPromises();

    expect(wrapper.find('.input-history').exists()).toBe(false);
    expect(JSON.parse(localStorage.getItem('mmx_video_history') || '[]')).toEqual([]);
  });
});
