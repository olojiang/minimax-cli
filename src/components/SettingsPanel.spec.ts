import { mount } from '@vue/test-utils';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import SettingsPanel from './SettingsPanel.vue';
import { checkQuota, setApiToken } from '../api/client';

vi.mock('../api/client', () => ({
  checkQuota: vi.fn(),
  getApiToken: vi.fn(() => ''),
  setApiToken: vi.fn()
}));

describe('SettingsPanel.vue', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('updates token', async () => {
    const wrapper = mount(SettingsPanel);
    const input = wrapper.find('input[type="password"]');
    await input.setValue('new-token');
    await input.trigger('change');
    expect(setApiToken).toHaveBeenCalledWith('new-token');
  });

  it('calls checkQuota', async () => {
    const wrapper = mount(SettingsPanel);
    (checkQuota as any).mockResolvedValue({ data: 'quota' });

    await wrapper.find('input[type="password"]').setValue('token');
    await wrapper.find('.btn').trigger('click');

    expect(checkQuota).toHaveBeenCalled();
  });
});
