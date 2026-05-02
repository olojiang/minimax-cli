import { flushPromises, mount } from '@vue/test-utils';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ChatPanel from './ChatPanel.vue';
import { searchWeb, textChat } from '../api/client';

vi.mock('../api/client', () => ({
  checkQuota: vi.fn().mockResolvedValue({ model_remains: [] }),
  searchWeb: vi.fn(),
  textChat: vi.fn()
}));

describe('ChatPanel.vue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('renders input and button', () => {
    const wrapper = mount(ChatPanel);
    expect(wrapper.find('.chat-input').exists()).toBe(true);
    expect(wrapper.find('.chat-btn').exists()).toBe(true);
  });

  it('calls textChat on submit', async () => {
    const wrapper = mount(ChatPanel);
    (textChat as any).mockResolvedValue({
      choices: [{ message: { content: 'Hi there' } }]
    });

    await wrapper.find('.chat-input').setValue('Hello');
    await wrapper.find('.chat-btn').trigger('click');
    await flushPromises();

    expect(textChat).toHaveBeenCalledWith([
      { role: 'user', content: 'Hello' }
    ]);
    expect(wrapper.text()).toContain('Hello');
    expect(wrapper.text()).toContain('Hi there');
  });

  it('sends previous turns as context for the next message', async () => {
    const wrapper = mount(ChatPanel);
    (textChat as any)
      .mockResolvedValueOnce({ choices: [{ message: { content: 'First reply' } }] })
      .mockResolvedValueOnce({ choices: [{ message: { content: 'Second reply' } }] });

    await wrapper.find('.chat-input').setValue('First');
    await wrapper.find('.chat-btn').trigger('click');
    await flushPromises();

    await wrapper.find('.chat-input').setValue('Second');
    await wrapper.find('.chat-btn').trigger('click');
    await flushPromises();

    expect(textChat).toHaveBeenLastCalledWith([
      { role: 'user', content: 'First' },
      { role: 'assistant', content: 'First reply' },
      { role: 'user', content: 'Second' }
    ]);
  });

  it('restores and clears persisted conversation', async () => {
    localStorage.setItem('mmx_text_chat_messages', JSON.stringify([
      { id: '1', role: 'user', content: 'Saved question' },
      { id: '2', role: 'assistant', content: 'Saved answer' }
    ]));

    const wrapper = mount(ChatPanel);
    await flushPromises();

    expect(wrapper.text()).toContain('Saved question');
    expect(wrapper.text()).toContain('Saved answer');

    await wrapper.find('.clear-chat-btn').trigger('click');

    expect(wrapper.text()).not.toContain('Saved question');
    expect(localStorage.getItem('mmx_text_chat_messages')).toBeNull();
  });

  it('normalizes old persisted JSON responses into readable messages', async () => {
    localStorage.setItem('mmx_text_chat_messages', JSON.stringify([
      { id: '1', role: 'user', content: 'hello' },
      {
        id: '2',
        role: 'assistant',
        content: JSON.stringify({
          id: '064270976512ac47e5e36092b1c95ee5',
          choices: null,
          model: 'abab6.5s-chat',
          base_resp: {
            status_code: 2061,
            status_msg: 'your current token plan not support model, abab6.5s-chat'
          }
        }, null, 2)
      }
    ]));

    const wrapper = mount(ChatPanel);
    await flushPromises();

    expect(wrapper.text()).toContain('请求失败：your current token plan not support model, abab6.5s-chat');
    expect(wrapper.find('.bubble-content').text()).not.toContain('"base_resp"');
    expect(wrapper.find('.raw-response').exists()).toBe(true);
  });

  it('renders assistant markdown formatting safely', async () => {
    (textChat as any).mockResolvedValue({
      choices: [{
        message: {
          content: [
            '## 二、安装方法',
            '',
            '### 方法一',
            '',
            '您上一个问题是：',
            '',
            '**"我想知道，北京海淀今天天气怎么样？"**',
            '',
            '- 第一项',
            '- 第二项',
            '',
            '1. 第一步',
            '2. 第二步',
            '',
            '[官网](https://example.com)',
            '',
            '`code` <script>alert(1)</script>',
          ].join('\n')
        }
      }]
    });
    const wrapper = mount(ChatPanel);

    await wrapper.find('.chat-input').setValue('markdown');
    await wrapper.find('.chat-btn').trigger('click');
    await flushPromises();

    expect(wrapper.find('.markdown-content h2').text()).toBe('二、安装方法');
    expect(wrapper.find('.markdown-content h3').text()).toBe('方法一');
    expect(wrapper.find('.markdown-content strong').text()).toBe('"我想知道，北京海淀今天天气怎么样？"');
    expect(wrapper.findAll('.markdown-content ul li')).toHaveLength(2);
    expect(wrapper.findAll('.markdown-content ol li')).toHaveLength(2);
    expect(wrapper.find('.markdown-content a').attributes('href')).toBe('https://example.com');
    expect(wrapper.find('.markdown-content code').text()).toBe('code');
    expect(wrapper.find('.markdown-content script').exists()).toBe(false);
    expect(wrapper.html()).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
  });

  it('can answer with generated search query and web results', async () => {
    (textChat as any)
      .mockResolvedValueOnce({ choices: [{ message: { content: '北京海淀 今天 天气' } }] })
      .mockResolvedValueOnce({ choices: [{ message: { content: '北京海淀今天晴，气温适宜。' } }] });
    (searchWeb as any).mockResolvedValue({
      organic: [
        { title: '北京天气', snippet: '海淀晴，20 摄氏度', link: 'https://example.com/weather' }
      ]
    });
    const wrapper = mount(ChatPanel);

    await wrapper.find('.search-toggle input').setValue(true);
    await wrapper.find('.chat-input').setValue('北京海淀今天天气怎么样？');
    await wrapper.find('.chat-btn').trigger('click');
    await flushPromises();

    expect(textChat).toHaveBeenNthCalledWith(1, expect.arrayContaining([
      expect.objectContaining({ role: 'system', content: expect.stringContaining('搜索词生成器') })
    ]));
    expect(searchWeb).toHaveBeenCalledWith('北京海淀 今天 天气');
    expect(textChat).toHaveBeenNthCalledWith(2, expect.arrayContaining([
      expect.objectContaining({ role: 'system', content: expect.stringContaining('搜索结果') })
    ]));
    expect(wrapper.text()).toContain('北京海淀今天晴，气温适宜。');
  });
});
