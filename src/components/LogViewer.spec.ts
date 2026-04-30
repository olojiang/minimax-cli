import { mount } from '@vue/test-utils';
import { describe, it, expect, beforeEach } from 'vitest';
import LogViewer from './LogViewer.vue';
import { logger } from '../utils/logger';

describe('LogViewer.vue', () => {
  beforeEach(() => {
    logger.clear();
  });

  it('renders correctly with empty logs', () => {
    const wrapper = mount(LogViewer);
    expect(wrapper.find('.log-viewer').exists()).toBe(true);
    expect(wrapper.findAll('.log-entry').length).toBe(0);
  });

  it('displays logs reactively', async () => {
    const wrapper = mount(LogViewer);
    
    logger.info('Test info message');
    logger.error('Test error message');
    
    await wrapper.vm.$nextTick();
    
    const entries = wrapper.findAll('.log-entry');
    expect(entries.length).toBe(2);
    expect(entries[0].text()).toContain('Test info message');
    expect(entries[1].text()).toContain('Test error message');
  });

  it('can clear logs', async () => {
    const wrapper = mount(LogViewer);
    logger.info('Message');
    await wrapper.vm.$nextTick();
    
    expect(wrapper.findAll('.log-entry').length).toBe(1);
    
    await wrapper.find('.clear-btn').trigger('click');
    expect(wrapper.findAll('.log-entry').length).toBe(0);
    expect(logger.getLogs().length).toBe(0);
  });
});
