import { mount } from '@vue/test-utils';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import SearchPanel from './SearchPanel.vue';
import { searchWeb } from '../api/client';

vi.mock('../api/client', () => ({
  checkQuota: vi.fn().mockResolvedValue({ model_remains: [] }),
  searchWeb: vi.fn()
}));

describe('SearchPanel.vue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders input and button', () => {
    const wrapper = mount(SearchPanel);
    expect(wrapper.find('.search-input').exists()).toBe(true);
    expect(wrapper.find('.search-btn').exists()).toBe(true);
  });

  it('calls searchWeb on submit', async () => {
    const wrapper = mount(SearchPanel);
    (searchWeb as any).mockResolvedValue({ data: 'results' });

    await wrapper.find('.search-input').setValue('Vue 3');
    await wrapper.find('.search-btn').trigger('click');

    expect(searchWeb).toHaveBeenCalledWith('Vue 3');
  });

  it('displays loading state during search', async () => {
    const wrapper = mount(SearchPanel);
    let resolveSearch: any;
    (searchWeb as any).mockReturnValue(new Promise(r => resolveSearch = r));

    await wrapper.find('.search-input').setValue('Wait');
    await wrapper.find('.search-btn').trigger('click');

    expect(wrapper.find('.search-btn').text()).toContain('Searching');
    expect(wrapper.find('.search-btn').attributes('disabled')).toBeDefined();

    resolveSearch({ data: 'done' });
    await wrapper.vm.$nextTick(); // Wait for promise resolution to update state
    await new Promise(r => setTimeout(r, 0)); // flush promises
    
    expect(wrapper.find('.search-btn').text()).not.toContain('Searching');
  });
});
