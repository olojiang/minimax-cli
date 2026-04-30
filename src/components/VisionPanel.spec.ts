import { mount } from '@vue/test-utils';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import VisionPanel from './VisionPanel.vue';
import { understandImage } from '../api/client';

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
    expect(wrapper.find('.file-input').exists()).toBe(true);
    expect(wrapper.find('.vision-btn').exists()).toBe(true);
  });

  it('calls understandImage when valid data is provided', async () => {
    const wrapper = mount(VisionPanel);
    (understandImage as any).mockResolvedValue({ data: 'vision results' });

    await wrapper.find('.prompt-input').setValue('Describe this');
    
    // Simulate file selection
    const file = new File([''], 'test.png', { type: 'image/png' });
    Object.defineProperty(wrapper.find('.file-input').element, 'files', {
      value: [file]
    });
    await wrapper.find('.file-input').trigger('change');

    await wrapper.find('.vision-btn').trigger('click');

    expect(understandImage).toHaveBeenCalledWith('Describe this', file);
  });

  it('button is disabled if prompt or file is missing', async () => {
    const wrapper = mount(VisionPanel);
    expect(wrapper.find('.vision-btn').attributes('disabled')).toBeDefined();

    await wrapper.find('.prompt-input').setValue('prompt');
    expect(wrapper.find('.vision-btn').attributes('disabled')).toBeDefined();
  });
});
