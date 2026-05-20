import { flushPromises, mount } from '@vue/test-utils';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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

  afterEach(() => {
    delete (window as any).minimaxDesktop;
  });

  it('updates token', async () => {
    const wrapper = mount(SettingsPanel);
    const input = wrapper.find('textarea');
    await input.setValue('new-token');
    expect(setApiToken).toHaveBeenCalledWith('new-token');
  });

  it('calls checkQuota', async () => {
    const wrapper = mount(SettingsPanel);
    (checkQuota as any).mockResolvedValue({ data: 'quota' });

    await wrapper.find('textarea').setValue('token');
    await wrapper.find('.btn').trigger('click');

    expect(setApiToken).toHaveBeenLastCalledWith('token');
    expect(checkQuota).toHaveBeenCalled();
  });

  it('persists token to desktop config before checking quota', async () => {
    const setApiTokenDesktop = vi.fn().mockResolvedValue({ ok: true, hasApiToken: true });
    (window as any).minimaxDesktop = {
      getConfig: vi.fn().mockResolvedValue({
        shortcut: 'Shift+Alt+M',
        activeShortcut: 'Shift+Alt+M',
        defaultShortcut: 'Shift+Alt+M',
        generationRoot: '/tmp/minimax-output',
        defaultGenerationRoot: '/tmp/default-output',
        configPath: '/tmp/desktop-config.json',
        platform: 'darwin',
      }),
      setApiToken: setApiTokenDesktop,
      chooseGenerationRoot: vi.fn(),
      setShortcut: vi.fn(),
    };
    (checkQuota as any).mockResolvedValue({ data: 'quota' });

    const wrapper = mount(SettingsPanel);
    await flushPromises();
    await wrapper.find('textarea').setValue('desktop-token');
    await wrapper.find('.btn').trigger('click');
    await flushPromises();

    expect(setApiTokenDesktop).toHaveBeenCalledWith('desktop-token');
    expect(checkQuota).toHaveBeenCalled();
  });

  it('restores saved desktop token on mount', async () => {
    (window as any).minimaxDesktop = {
      getConfig: vi.fn().mockResolvedValue({
        apiToken: 'desktop-token',
        shortcut: 'Shift+Alt+M',
        activeShortcut: 'Shift+Alt+M',
        defaultShortcut: 'Shift+Alt+M',
        generationRoot: '/tmp/minimax-output',
        defaultGenerationRoot: '/tmp/default-output',
        configPath: '/tmp/desktop-config.json',
        platform: 'darwin',
      }),
      setApiToken: vi.fn().mockResolvedValue({ ok: true, hasApiToken: true }),
      chooseGenerationRoot: vi.fn(),
      setShortcut: vi.fn(),
    };
    (checkQuota as any).mockResolvedValue({ data: 'quota' });

    const wrapper = mount(SettingsPanel);
    await flushPromises();

    expect((wrapper.find('textarea').element as HTMLTextAreaElement).value).toBe('desktop-token');
    expect(setApiToken).toHaveBeenCalledWith('desktop-token');
    expect(checkQuota).toHaveBeenCalledOnce();
  });

  it('shows and updates the desktop generation root', async () => {
    const chooseGenerationRoot = vi.fn().mockResolvedValue({
      ok: true,
      generationRoot: '/Users/test/MiniMax Output',
    });
    (window as any).minimaxDesktop = {
      getConfig: vi.fn().mockResolvedValue({
        shortcut: 'Shift+Alt+M',
        activeShortcut: 'Shift+Alt+M',
        defaultShortcut: 'Shift+Alt+M',
        generationRoot: '/Users/test/Old Output',
        defaultGenerationRoot: '/Users/test/Library/Application Support/Minimax/.mmx-library/files',
        configPath: '/Users/test/Library/Application Support/Minimax/desktop-config.json',
        platform: 'darwin',
      }),
      setApiToken: vi.fn().mockResolvedValue({ ok: true, hasApiToken: true }),
      chooseGenerationRoot,
      setShortcut: vi.fn(),
    };

    const wrapper = mount(SettingsPanel);
    await flushPromises();

    expect(wrapper.text()).toContain('/Users/test/Old Output');
    expect(wrapper.text()).toContain('image、speech、video、music');

    const chooseButton = wrapper.findAll('button').find(button => button.text() === 'Choose Folder');
    expect(chooseButton).toBeTruthy();
    await chooseButton!.trigger('click');
    await flushPromises();

    expect(chooseGenerationRoot).toHaveBeenCalledOnce();
    expect(wrapper.text()).toContain('/Users/test/MiniMax Output');
    expect(wrapper.text()).toContain('生成根目录已保存。');
  });

  it('renders quota usage and total on two rows', async () => {
    const wrapper = mount(SettingsPanel);
    (checkQuota as any).mockResolvedValue({
      model_remains: [{
        model_name: 'MiniMax-M*',
        current_interval_total_count: 4500,
        current_interval_usage_count: 273,
        current_weekly_total_count: 45000,
        current_weekly_usage_count: 1481,
      }]
    });

    await wrapper.find('textarea').setValue('token');
    await wrapper.find('.btn').trigger('click');
    await flushPromises();

    expect(wrapper.text()).toContain('区间:273/4500');
    expect(wrapper.text()).toContain('本周:1481/45000');
    expect(wrapper.text()).not.toContain('区间总量');
    expect(wrapper.text()).not.toContain('区间已用');
    expect(wrapper.text()).not.toContain('本周总量');
    expect(wrapper.text()).not.toContain('本周已用');
  });

  it('checks quota on mount when a token already exists', async () => {
    (getApiToken as any).mockReturnValue('saved-token');
    (checkQuota as any).mockResolvedValue({ data: 'quota' });

    mount(SettingsPanel);
    await flushPromises();

    expect(checkQuota).toHaveBeenCalledOnce();
  });
});
