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
    localStorage.clear();
  });

  const flushPromises = () => new Promise(resolve => setTimeout(resolve, 0));

  const makeOrganicResults = (count: number) => ({
    organic: Array.from({ length: count }, (_, index) => ({
      title: `Result ${index + 1}`,
      snippet: `Snippet ${index + 1}`,
      link: `https://example.com/${index + 1}`,
    })),
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

  it('renders every organic result returned by the API', async () => {
    const wrapper = mount(SearchPanel);
    (searchWeb as any).mockResolvedValue(makeOrganicResults(12));

    await wrapper.find('.search-input').setValue('Vue results');
    await wrapper.find('.search-btn').trigger('click');
    await flushPromises();

    expect(wrapper.findAll('.organic-item')).toHaveLength(12);
    expect(wrapper.find('.result-count').text()).toBe('MiniMax 本次返回 12 条');
    expect(wrapper.find('.organic-item .item-title').text()).toBe('Result 1');
    expect(wrapper.find('.pagination').exists()).toBe(false);
    expect(wrapper.find('#search-page-size').exists()).toBe(false);
  });

  it('restores the last search result from local storage', async () => {
    localStorage.setItem('mmx_search_last_result', JSON.stringify({
      query: 'cached query',
      result: makeOrganicResults(12),
      viewMode: 'panel',
      savedAt: Date.now(),
    }));

    const wrapper = mount(SearchPanel);
    await flushPromises();

    expect((wrapper.find('.search-input').element as HTMLInputElement).value).toBe('cached query');
    expect(wrapper.find('#search-page-size').exists()).toBe(false);
    expect(wrapper.findAll('.organic-item')).toHaveLength(12);
    expect(wrapper.find('.result-count').text()).toContain('本次返回 12 条');
    expect(searchWeb).not.toHaveBeenCalled();
  });

  it('caches successful search results for refresh recovery', async () => {
    const wrapper = mount(SearchPanel);
    (searchWeb as any).mockResolvedValue(makeOrganicResults(3));

    await wrapper.find('.search-input').setValue('persist me');
    await wrapper.find('.search-btn').trigger('click');
    await flushPromises();

    const cache = JSON.parse(localStorage.getItem('mmx_search_last_result') || '{}');
    expect(cache.query).toBe('persist me');
    expect(cache).not.toHaveProperty('pageSize');
    expect(cache.result.organic).toHaveLength(3);
  });
});
