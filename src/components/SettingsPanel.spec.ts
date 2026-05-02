import { flushPromises, mount } from '@vue/test-utils';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import SettingsPanel from './SettingsPanel.vue';
import { checkQuota, getApiToken, setApiToken } from '../api/client';

vi.mock('../api/client', () => ({
  checkQuota: vi.fn(),
  getApiToken: vi.fn(() => ''),
  setApiToken: vi.fn()
}));

describe('SettingsPanel.vue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (getApiToken as any).mockReturnValue('');
  });

  it('updates token', async () => {
    const wrapper = mount(SettingsPanel);
    const input = wrapper.find('textarea');
    await input.setValue('new-token');
    await input.trigger('change');
    expect(setApiToken).toHaveBeenCalledWith('new-token');
  });

  it('calls checkQuota', async () => {
    const wrapper = mount(SettingsPanel);
    (checkQuota as any).mockResolvedValue({ data: 'quota' });

    await wrapper.find('textarea').setValue('token');
    await wrapper.find('.btn').trigger('click');

    expect(checkQuota).toHaveBeenCalled();
  });

  it('checks quota on mount when a token already exists', async () => {
    (getApiToken as any).mockReturnValue('saved-token');
    (checkQuota as any).mockResolvedValue({ data: 'quota' });

    mount(SettingsPanel);
    await flushPromises();

    expect(checkQuota).toHaveBeenCalledOnce();
  });
});
