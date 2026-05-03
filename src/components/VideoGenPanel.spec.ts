import { flushPromises, mount } from '@vue/test-utils';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import VideoGenPanel from './VideoGenPanel.vue';
import { generateVideo, waitForVideoGenerationResult } from '../api/client';
import { loadLocalLibraryRecords, saveLocalLibraryRecord } from '../utils/localLibrary';

vi.mock('../api/client', () => ({
  checkQuota: vi.fn().mockResolvedValue({ model_remains: [] }),
  generateVideo: vi.fn(),
  waitForVideoGenerationResult: vi.fn(),
}));

vi.mock('../utils/fileExport', () => ({
  downloadMediaFromResponse: vi.fn(),
}));

vi.mock('../utils/localLibrary', () => ({
  deleteLocalLibraryRecord: vi.fn().mockResolvedValue(true),
  loadLocalLibraryRecords: vi.fn().mockResolvedValue([]),
  saveLocalLibraryRecord: vi.fn().mockResolvedValue(null),
}));

describe('VideoGenPanel.vue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    (loadLocalLibraryRecords as any).mockResolvedValue([]);
    (saveLocalLibraryRecord as any).mockResolvedValue(null);
    (waitForVideoGenerationResult as any).mockResolvedValue({
      task: { task_id: 'task-1', status: 'Success', file_id: 'file-1' },
      file: { file_id: 'file-1', download_url: 'https://cdn.example.com/video.mp4' },
      video_url: 'https://cdn.example.com/video.mp4',
    });
  });

  it('submits video prompt with selected options', async () => {
    (generateVideo as any).mockResolvedValue({ task_id: 'task-1' });
    const wrapper = mount(VideoGenPanel);

    await wrapper.find('textarea').setValue('海浪在日落时分拍打沙滩');
    await wrapper.find('#video-model').setValue('MiniMax-Hailuo-02');
    await wrapper.find('#video-duration').setValue('10');
    await wrapper.findAll('input[type="checkbox"]')[0].setValue(false);
    await wrapper.findAll('input[type="checkbox"]')[1].setValue(true);
    await wrapper.find('.btn').trigger('click');
    await flushPromises();

    expect(generateVideo).toHaveBeenCalledWith('海浪在日落时分拍打沙滩', {
      model: 'MiniMax-Hailuo-02',
      duration: 10,
      resolution: '768P',
      promptOptimizer: false,
      fastPretreatment: true,
    });
    expect(waitForVideoGenerationResult).toHaveBeenCalledWith('task-1', expect.objectContaining({
      onStatus: expect.any(Function),
    }));
    expect(wrapper.find('.video-player').attributes('src')).toBe('https://cdn.example.com/video.mp4');
    expect(wrapper.find('.current-prompt').text()).toBe('海浪在日落时分拍打沙滩');
    expect(wrapper.find('.open-video-link').text()).toBe('下载视频');
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

  it('restores generated video history from the local library after refresh', async () => {
    (loadLocalLibraryRecords as any).mockResolvedValue([
      {
        id: 'video-record-1',
        kind: 'video',
        prompt: '历史视频生成',
        response: {
          video_url: 'https://remote.example.com/video.mp4',
        },
        media: [
          {
            source: 'https://remote.example.com/video.mp4',
            file: 'video/video-record-1.mp4',
            url: '/local-library/files/video/video-record-1.mp4',
            mime: 'video/mp4',
          },
        ],
        createdAt: new Date().toISOString(),
        durationMs: 4200,
      },
    ]);

    const wrapper = mount(VideoGenPanel);
    await flushPromises();

    expect(wrapper.find('.video-library').exists()).toBe(true);
    expect(wrapper.find('.video-player').attributes('src')).toBe('/local-library/files/video/video-record-1.mp4');
    expect(wrapper.find('.history-prompt').text()).toBe('历史视频生成');
    expect(wrapper.find('.history-duration').text()).toBe('耗时 4.2 秒');
  });

  it('persists generated video history in browser storage when disk library is unavailable', async () => {
    (generateVideo as any).mockResolvedValue({ task_id: 'task-1' });
    (saveLocalLibraryRecord as any).mockResolvedValue(null);
    const wrapper = mount(VideoGenPanel);

    await wrapper.find('textarea').setValue('刷新后还要能找到的视频');
    await wrapper.find('.btn').trigger('click');
    await flushPromises();

    const stored = JSON.parse(localStorage.getItem('mmx_video_generation_history') || '[]');
    expect(stored).toHaveLength(1);
    expect(stored[0]).toEqual(expect.objectContaining({
      prompt: '刷新后还要能找到的视频',
      url: 'https://cdn.example.com/video.mp4',
    }));

    (loadLocalLibraryRecords as any).mockResolvedValue([]);
    const restored = mount(VideoGenPanel);
    await flushPromises();

    expect(restored.find('.video-player').attributes('src')).toBe('https://cdn.example.com/video.mp4');
    expect(restored.find('.history-prompt').text()).toBe('刷新后还要能找到的视频');
  });

  it('switches generated history playback without regenerating', async () => {
    (loadLocalLibraryRecords as any).mockResolvedValue([
      {
        id: 'video-record-2',
        kind: 'video',
        prompt: '第二条视频',
        response: { video_url: 'https://remote.example.com/two.mp4' },
        media: [{ source: 'https://remote.example.com/two.mp4', file: 'video/two.mp4', url: '/local-library/files/video/two.mp4', mime: 'video/mp4' }],
        createdAt: new Date('2026-05-02T12:00:00.000Z').toISOString(),
      },
      {
        id: 'video-record-1',
        kind: 'video',
        prompt: '第一条视频',
        response: { video_url: 'https://remote.example.com/one.mp4' },
        media: [{ source: 'https://remote.example.com/one.mp4', file: 'video/one.mp4', url: '/local-library/files/video/one.mp4', mime: 'video/mp4' }],
        createdAt: new Date('2026-05-01T12:00:00.000Z').toISOString(),
      },
    ]);
    const wrapper = mount(VideoGenPanel);
    await flushPromises();

    expect(wrapper.find('.video-player').attributes('src')).toBe('/local-library/files/video/two.mp4');

    await wrapper.findAll('.video-history-select')[1].trigger('click');

    expect(wrapper.find('.video-player').attributes('src')).toBe('/local-library/files/video/one.mp4');
    expect(wrapper.find('.current-prompt').text()).toBe('第一条视频');
    expect(generateVideo).not.toHaveBeenCalled();
  });
});
