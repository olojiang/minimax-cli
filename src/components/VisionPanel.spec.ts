import { flushPromises, mount } from '@vue/test-utils';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import VisionPanel from './VisionPanel.vue';
import { understandImage, fileToDataUrl } from '../api/client';

vi.mock('../api/client', () => ({
  checkQuota: vi.fn().mockResolvedValue({ model_remains: [] }),
  understandImage: vi.fn(),
  fileToDataUrl: vi.fn().mockResolvedValue('data:image/png;base64,mocked')
}));

describe('VisionPanel.vue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders inputs and button', () => {
    const wrapper = mount(VisionPanel);
    expect(wrapper.find('.prompt-input').exists()).toBe(true);
    expect(wrapper.find('.paste-dropzone').exists()).toBe(true);
    expect(wrapper.find('.file-input').exists()).toBe(true);
    expect(wrapper.find('.vision-btn').exists()).toBe(true);
  });

  it('calls understandImage when valid data is provided', async () => {
    const wrapper = mount(VisionPanel);
    (understandImage as any).mockResolvedValue({ content: '## 总结\n\n- 第一项\n- 第二项' });

    await wrapper.find('.prompt-input').setValue('Describe this');
    
    // Simulate file selection
    const file = new File([''], 'test.png', { type: 'image/png' });
    Object.defineProperty(wrapper.find('.file-input').element, 'files', {
      value: [file]
    });
    await wrapper.find('.file-input').trigger('change');

    await wrapper.find('.vision-btn').trigger('click');
    await flushPromises();

    expect(understandImage).toHaveBeenCalledWith('Describe this', file);
    expect(wrapper.find('.vision-readable h2').text()).toBe('总结');
    expect(wrapper.findAll('.vision-readable li')).toHaveLength(2);
  });

  it('can switch between readable and raw JSON result views', async () => {
    const wrapper = mount(VisionPanel);
    (understandImage as any).mockResolvedValue({ content: 'Readable text', trace_id: 'abc' });
    const file = new File([''], 'test.png', { type: 'image/png' });

    await wrapper.find('.prompt-input').setValue('Describe this');
    Object.defineProperty(wrapper.find('.file-input').element, 'files', {
      value: [file]
    });
    await wrapper.find('.file-input').trigger('change');
    await wrapper.find('.vision-btn').trigger('click');
    await flushPromises();

    expect(wrapper.find('.vision-readable').text()).toContain('Readable text');
    expect(wrapper.find('.result-box pre').exists()).toBe(false);

    await wrapper.findAll('.view-toggle button')[1].trigger('click');

    expect(wrapper.find('.result-box pre').text()).toContain('"trace_id": "abc"');
  });

  it('accepts a pasted screenshot as the selected image', async () => {
    const wrapper = mount(VisionPanel);
    (understandImage as any).mockResolvedValue({ data: 'vision results' });
    const pastedFile = new File(['image-bytes'], 'clipboard.png', { type: 'image/png' });

    await wrapper.find('.prompt-input').setValue('Describe pasted image');
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
    expect(wrapper.find('.paste-dropzone strong').text()).toBe('pasted-screenshot.png');
    expect(wrapper.find('.vision-btn').attributes('disabled')).toBeUndefined();

    await wrapper.find('.vision-btn').trigger('click');

    expect(understandImage).toHaveBeenCalledWith(
      'Describe pasted image',
      expect.objectContaining({
        name: 'pasted-screenshot.png',
        type: 'image/png',
      }),
    );
  });

  it('shows an error when paste does not include an image', async () => {
    const wrapper = mount(VisionPanel);

    await wrapper.find('.paste-dropzone').trigger('paste', {
      clipboardData: {
        items: [
          {
            type: 'text/plain',
            getAsFile: () => null,
          },
        ],
      },
    });

    expect(wrapper.find('.error-message').text()).toContain('剪贴板里没有图片');
  });

  it('button is disabled if prompt or file is missing', async () => {
    const wrapper = mount(VisionPanel);
    expect(wrapper.find('.vision-btn').attributes('disabled')).toBeDefined();

    await wrapper.find('.prompt-input').setValue('prompt');
    expect(wrapper.find('.vision-btn').attributes('disabled')).toBeDefined();
  });
});
