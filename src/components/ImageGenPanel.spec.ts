import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ImageGenPanel from './ImageGenPanel.vue';
import { fileToDataUrl, generateImage } from '../api/client';
import { deleteLocalLibraryRecord, loadLocalLibraryRecords, saveLocalLibraryRecord } from '../utils/localLibrary';

vi.mock('../api/client', () => ({
  checkQuota: vi.fn().mockResolvedValue({ model_remains: [] }),
  fileToDataUrl: vi.fn().mockResolvedValue('data:image/png;base64,mocked'),
  generateImage: vi.fn(),
}));

vi.mock('../utils/fileExport', () => ({
  downloadMediaFromResponse: vi.fn(),
}));

vi.mock('../utils/localLibrary', () => ({
  deleteLocalLibraryRecord: vi.fn().mockResolvedValue(true),
  loadLocalLibraryRecords: vi.fn().mockResolvedValue([]),
  saveLocalLibraryRecord: vi.fn().mockResolvedValue(null),
}));

describe('ImageGenPanel.vue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    (loadLocalLibraryRecords as any).mockResolvedValue([]);
  });

  it('accepts a pasted screenshot as the image-to-image reference', async () => {
    (generateImage as any).mockResolvedValue({ data: { image_urls: ['https://example.com/image.png'] } });
    const wrapper = mount(ImageGenPanel);
    const pastedFile = new File(['image-bytes'], 'clipboard.png', { type: 'image/png' });

    await wrapper.find('textarea').setValue('保持截图结构，改成赛博朋克风格');
    await wrapper.find('#image-mode').setValue('reference');
    await wrapper.find('.paste-dropzone').trigger('paste', {
      clipboardData: {
        items: [
          {
            type: 'image/png',
            getAsFile: () => pastedFile,
          },
        ],
      },
    });
    await flushPromises();

    expect(fileToDataUrl).toHaveBeenCalled();
    expect(wrapper.find('.paste-dropzone strong').text()).toBe('pasted-reference.png');
    expect(wrapper.find('.btn').attributes('disabled')).toBeUndefined();

    await wrapper.find('.btn').trigger('click');
    await flushPromises();

    expect(generateImage).toHaveBeenCalledWith(
      '保持截图结构，改成赛博朋克风格',
      expect.objectContaining({
        subjectReference: expect.objectContaining({
          name: 'pasted-reference.png',
          type: 'image/png',
        }),
      }),
    );
  });

  it('renders generated image results with preview actions and JSON fallback', async () => {
    const imageUrl = 'https://example.com/generated.jpeg?token=123';
    (generateImage as any).mockResolvedValue({ data: { image_urls: [imageUrl] } });
    const wrapper = mount(ImageGenPanel);

    await wrapper.find('textarea').setValue('生成一张粉色房子');
    await wrapper.find('.btn').trigger('click');
    await flushPromises();

    expect(wrapper.find('.generated-gallery img').attributes('src')).toBe(imageUrl);
    expect(wrapper.find('.generated-actions a').attributes('href')).toBe(imageUrl);
    expect(wrapper.find('.generated-actions button').attributes('title')).toBe('放大');
    expect(wrapper.find('.generated-actions a').attributes('title')).toBe('下载');
    expect(wrapper.find('.generated-actions button svg').exists()).toBe(true);

    await wrapper.find('.generated-preview').trigger('click');

    expect(wrapper.find('.image-lightbox').exists()).toBe(true);
    expect(wrapper.find('.image-lightbox img').attributes('src')).toBe(imageUrl);

    await wrapper.find('.lightbox-close').trigger('click');
    await wrapper.findAll('.view-toggle button')[1].trigger('click');

    expect(wrapper.find('.result-box pre').text()).toContain('image_urls');
  });

  it('hides a generated image card when it fails to load', async () => {
    const brokenImage = 'https://example.com/broken.jpeg';
    const goodImage = 'https://example.com/good.jpeg';
    (generateImage as any).mockResolvedValue({ data: { image_urls: [brokenImage, goodImage] } });
    const wrapper = mount(ImageGenPanel);

    await wrapper.find('textarea').setValue('生成两张图');
    await wrapper.find('.btn').trigger('click');
    await flushPromises();

    expect(wrapper.findAll('.generated-gallery img')).toHaveLength(2);

    await wrapper.findAll('.generated-gallery img')[0].trigger('error');

    const remainingImages = wrapper.findAll('.generated-gallery img');
    expect(remainingImages).toHaveLength(1);
    expect(remainingImages[0].attributes('src')).toBe(goodImage);
  });

  it('can delete the current generated result from the result header', async () => {
    const imageUrl = 'https://example.com/generated.jpeg';
    (generateImage as any).mockResolvedValue({ data: { image_urls: [imageUrl] } });
    const wrapper = mount(ImageGenPanel);

    await wrapper.find('textarea').setValue('生成一张图');
    await wrapper.find('.btn').trigger('click');
    await flushPromises();

    await wrapper.find('.result-clear-btn').trigger('click');
    await flushPromises();

    expect(wrapper.find('.result-box').exists()).toBe(false);
    expect(wrapper.find('.history-gallery').exists()).toBe(false);
    expect(localStorage.getItem('mmx_image_generation_history')).toBeNull();
  });

  it('persists generated image history and can switch between records', async () => {
    const firstImage = 'https://example.com/first.jpeg';
    const secondImage = 'https://example.com/second.jpeg';
    (generateImage as any)
      .mockResolvedValueOnce({ data: { image_urls: [firstImage] } })
      .mockResolvedValueOnce({ data: { image_urls: [secondImage] } });
    const wrapper = mount(ImageGenPanel);

    await wrapper.find('textarea').setValue('第一张图');
    await wrapper.find('.btn').trigger('click');
    await flushPromises();

    await wrapper.find('textarea').setValue('第二张图');
    await wrapper.find('.btn').trigger('click');
    await flushPromises();

    expect(wrapper.findAll('.history-card')).toHaveLength(2);
    expect(wrapper.findAll('.history-duration')[0].text()).toMatch(/^耗时 /);
    expect(wrapper.find('.generated-gallery img').attributes('src')).toBe(secondImage);
    const savedHistory = JSON.parse(localStorage.getItem('mmx_image_generation_history') || '[]');
    expect(savedHistory).toHaveLength(2);
    expect(savedHistory[0].durationMs).toEqual(expect.any(Number));
    expect(saveLocalLibraryRecord).toHaveBeenLastCalledWith(
      'image',
      '第二张图',
      expect.objectContaining({ data: { image_urls: [secondImage] } }),
      { durationMs: expect.any(Number) },
    );

    await wrapper.findAll('.history-select')[1].trigger('click');

    expect(wrapper.find('.generated-gallery img').attributes('src')).toBe(firstImage);
  });

  it('selects prompt history without generating immediately', async () => {
    localStorage.setItem('mmx_image_history', JSON.stringify(['历史提示词']));
    const wrapper = mount(ImageGenPanel);
    await flushPromises();

    await wrapper.find('.history-text').trigger('click');

    expect((wrapper.find('textarea').element as HTMLTextAreaElement).value).toBe('历史提示词');
    expect(generateImage).not.toHaveBeenCalled();
  });

  it('searches and applies built-in text-to-image prompt samples', async () => {
    const wrapper = mount(ImageGenPanel);

    await wrapper.find('#image-prompt-sample-search').setValue('高端无线耳机');

    const options = wrapper.findAll('#image-prompt-sample option');
    expect(options.some(option => option.text().includes('7.19｜高端无线耳机产品图'))).toBe(true);
    expect(options.some(option => option.text().includes('参考图'))).toBe(false);

    await wrapper.find('#image-prompt-sample').setValue('prompt-7.19');

    const textarea = wrapper.find('textarea').element as HTMLTextAreaElement;
    expect(textarea.value).toContain('一张高端无线降噪耳机的商业产品照片');
    expect(textarea.value).toContain('哑光午夜蓝');
    expect(wrapper.find('.sample-preview').text()).toContain('7.19｜高端无线耳机产品图');
    expect(generateImage).not.toHaveBeenCalled();
  });

  it('applies only the editable example text from prompt template samples', async () => {
    const wrapper = mount(ImageGenPanel);

    await wrapper.find('#image-prompt-sample-search').setValue('人像摄影英文模板');
    await wrapper.find('#image-prompt-sample').setValue('prompt-12.3');

    const textarea = wrapper.find('textarea').element as HTMLTextAreaElement;
    expect(textarea.value).toBe('Business woman portrait photography, modern office background, natural lighting, shot on Canon EOS R5, 85mm lens, shallow depth of field, professional color grading, high resolution, 4k。');
    expect(textarea.value).not.toContain('[主题]');
    expect(textarea.value).not.toContain('示例：');
    expect(wrapper.find('.sample-preview').text()).toContain('12.3｜人像摄影英文模板');
    expect(wrapper.find('.sample-preview').text()).not.toContain('Business woman portrait photography');
    expect(generateImage).not.toHaveBeenCalled();
  });

  it('restores generated image history after refresh', async () => {
    const imageUrl = 'https://example.com/restored.jpeg';
    localStorage.setItem('mmx_image_generation_history', JSON.stringify([
      {
        id: 'saved',
        prompt: '恢复图',
        result: { data: { image_urls: [imageUrl] } },
        thumbnail: imageUrl,
        createdAt: Date.now(),
        durationMs: 3600,
      },
    ]));

    const wrapper = mount(ImageGenPanel);
    await flushPromises();

    expect(wrapper.find('.generated-gallery img').attributes('src')).toBe(imageUrl);
    expect(wrapper.find('.history-card.active').exists()).toBe(true);
    expect(wrapper.find('.history-duration').text()).toBe('耗时 3.6 秒');
  });

  it('restores disk image history without showing stale source URLs as thumbnails', async () => {
    const staleUrl = 'https://expired.example.com/generated.jpeg';
    (loadLocalLibraryRecords as any).mockResolvedValue([
      {
        id: 'disk-record',
        kind: 'image',
        prompt: '磁盘图',
        response: { data: { image_urls: [staleUrl] } },
        media: [
          {
            source: staleUrl,
            url: '/local-library/files/image/disk-record-1.jpeg',
            file: 'image/disk-record-1.jpeg',
            mime: 'image/jpeg',
          },
        ],
        createdAt: new Date().toISOString(),
        durationMs: 62_000,
      },
    ]);

    const wrapper = mount(ImageGenPanel);
    await flushPromises();

    expect(wrapper.find('.generated-gallery img').attributes('src')).toBe('/local-library/files/image/disk-record-1.jpeg');
    expect(wrapper.find('.history-card img').attributes('src')).toBe('/local-library/files/image/disk-record-1.jpeg');
    expect(wrapper.find('.history-duration').text()).toBe('耗时 1 分 2 秒');
    expect(wrapper.html()).not.toContain(staleUrl);
  });

  it('hides a broken generated history thumbnail', async () => {
    localStorage.setItem('mmx_image_generation_history', JSON.stringify([
      {
        id: 'saved',
        prompt: '坏缩略图',
        result: { data: { image_urls: ['https://example.com/restored.jpeg'] } },
        thumbnail: 'https://example.com/broken-thumbnail.jpeg',
        createdAt: Date.now(),
      },
    ]));

    const wrapper = mount(ImageGenPanel);
    await flushPromises();

    expect(wrapper.find('.history-card img').exists()).toBe(true);

    await wrapper.find('.history-card img').trigger('error');

    expect(wrapper.find('.history-card img').exists()).toBe(false);
    expect(wrapper.find('.history-placeholder').exists()).toBe(true);
  });

  it('deletes a single generated history record', async () => {
    const firstImage = 'https://example.com/first.jpeg';
    const secondImage = 'https://example.com/second.jpeg';
    (generateImage as any)
      .mockResolvedValueOnce({ data: { image_urls: [firstImage] } })
      .mockResolvedValueOnce({ data: { image_urls: [secondImage] } });
    const wrapper = mount(ImageGenPanel);

    await wrapper.find('textarea').setValue('第一张图');
    await wrapper.find('.btn').trigger('click');
    await flushPromises();
    await wrapper.find('textarea').setValue('第二张图');
    await wrapper.find('.btn').trigger('click');
    await flushPromises();

    await wrapper.find('.history-card .history-delete').trigger('click');
    await flushPromises();

    expect(wrapper.findAll('.history-card')).toHaveLength(1);
    expect(wrapper.find('.generated-gallery img').attributes('src')).toBe(firstImage);
  });

  it('deletes disk-backed generated history from the local library', async () => {
    const imageUrl = '/local-library/files/image/disk-record-1.jpeg';
    (loadLocalLibraryRecords as any).mockResolvedValue([
      {
        id: 'disk-record',
        kind: 'image',
        prompt: '磁盘图',
        response: { data: { image_urls: ['https://expired.example.com/generated.jpeg'] } },
        media: [
          {
            source: 'https://expired.example.com/generated.jpeg',
            url: imageUrl,
            file: 'image/disk-record-1.jpeg',
            mime: 'image/jpeg',
          },
        ],
        createdAt: new Date().toISOString(),
      },
    ]);
    const wrapper = mount(ImageGenPanel);
    await flushPromises();

    await wrapper.find('.history-card .history-delete').trigger('click');
    await flushPromises();

    expect(deleteLocalLibraryRecord).toHaveBeenCalledWith('disk-record');
    expect(wrapper.find('.history-gallery').exists()).toBe(false);
    expect(wrapper.find('.result-box').exists()).toBe(false);
  });

  it('clears generated image history', async () => {
    const imageUrl = 'https://example.com/generated.jpeg';
    (generateImage as any).mockResolvedValue({ data: { image_urls: [imageUrl] } });
    const wrapper = mount(ImageGenPanel);

    await wrapper.find('textarea').setValue('生成一张图');
    await wrapper.find('.btn').trigger('click');
    await flushPromises();

    await wrapper.find('.clear-history-btn').trigger('click');

    expect(wrapper.find('.history-gallery').exists()).toBe(false);
    expect(wrapper.find('.result-box').exists()).toBe(false);
    expect(localStorage.getItem('mmx_image_generation_history')).toBeNull();
  });

  it('keeps image-to-image generation disabled until a reference image exists', async () => {
    const wrapper = mount(ImageGenPanel);

    await wrapper.find('textarea').setValue('生成一张参考图变体');
    await wrapper.find('#image-mode').setValue('reference');

    expect(wrapper.find('.btn').attributes('disabled')).toBeDefined();
  });

  it('clears the selected reference image', async () => {
    const wrapper = mount(ImageGenPanel);
    const file = new File(['image-bytes'], 'reference.png', { type: 'image/png' });

    await wrapper.find('textarea').setValue('生成一张参考图变体');
    await wrapper.find('#image-mode').setValue('reference');
    Object.defineProperty(wrapper.find('.file-input').element, 'files', {
      value: [file],
    });
    await wrapper.find('.file-input').trigger('change');
    await flushPromises();

    expect(wrapper.find('.image-preview').exists()).toBe(true);
    expect(wrapper.find('.clear-reference-btn').exists()).toBe(true);
    expect(wrapper.find('.btn').attributes('disabled')).toBeUndefined();

    await wrapper.find('.clear-reference-btn').trigger('click');

    expect(wrapper.find('.image-preview').exists()).toBe(false);
    expect(wrapper.find('.clear-reference-btn').exists()).toBe(false);
    expect(wrapper.find('.btn').attributes('disabled')).toBeDefined();
  });
});
