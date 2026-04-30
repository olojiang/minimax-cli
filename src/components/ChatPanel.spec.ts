import { mount } from '@vue/test-utils';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ChatPanel from './ChatPanel.vue';
import { textChat } from '../api/client';

vi.mock('../api/client', () => ({
  checkQuota: vi.fn().mockResolvedValue({ model_remains: [] }),
  textChat: vi.fn()
}));

describe('ChatPanel.vue', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('renders input and button', () => {
    const wrapper = mount(ChatPanel);
    expect(wrapper.find('.chat-input').exists()).toBe(true);
    expect(wrapper.find('.chat-btn').exists()).toBe(true);
  });

  it('calls textChat on submit', async () => {
    const wrapper = mount(ChatPanel);
    (textChat as any).mockResolvedValue({ data: 'response' });

    await wrapper.find('.chat-input').setValue('Hello');
    await wrapper.find('.chat-btn').trigger('click');

    expect(textChat).toHaveBeenCalledWith('Hello');
  });
});
