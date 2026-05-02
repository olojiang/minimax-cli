<template>
  <div class="chat-panel panel">
    <div class="chat-heading">
      <h2>文本对话 (Text Chat)</h2>
      <button
        class="clear-chat-btn"
        type="button"
        :disabled="loading || chatMessages.length === 0"
        @click="clearChat"
      >
        清空对话
      </button>
    </div>
    <QuotaSummary
      title="文本对话配额"
      :model-patterns="['MiniMax-M']"
    />

    <div
      ref="conversationRef"
      class="conversation"
      aria-live="polite"
    >
      <div
        v-if="chatMessages.length === 0 && !loading"
        class="empty-chat"
      >
        还没有对话，发送第一条消息开始。
      </div>

      <div
        v-for="item in chatMessages"
        :key="item.id"
        class="chat-row"
        :class="item.role"
      >
        <div class="bubble">
          <div class="bubble-meta">
            {{ item.role === 'user' ? '你' : 'MiniMax' }}
          </div>
          <!-- eslint-disable vue/no-v-html -->
          <div
            v-if="item.role === 'assistant'"
            class="bubble-content markdown-content"
            v-html="renderMarkdown(item.content)"
          />
          <!-- eslint-enable vue/no-v-html -->
          <div
            v-else
            class="bubble-content"
          >
            {{ item.content }}
          </div>
          <details
            v-if="item.raw"
            class="raw-response"
          >
            <summary>原始响应</summary>
            <pre>{{ formatResult(item.raw) }}</pre>
          </details>
        </div>
      </div>

      <div
        v-if="loading"
        class="chat-row assistant"
      >
        <div class="bubble pending">
          <div class="bubble-meta">
            MiniMax
          </div>
          <div
            class="typing-indicator"
            aria-label="正在生成回复"
          >
            <span />
            <span />
            <span />
          </div>
        </div>
      </div>
    </div>

    <div class="input-group">
      <textarea
        v-model="message" 
        class="chat-input" 
        placeholder="输入对话内容，例如：什么是 MiniMax？" 
        rows="3"
        :disabled="loading"
        @keydown.enter.exact.prevent="performChat"
      />
      <div class="chat-actions">
        <label class="search-toggle">
          <input
            v-model="webSearchEnabled"
            type="checkbox"
            :disabled="loading"
          >
          联网搜索后回答
        </label>
        <button
          class="btn chat-btn"
          :class="{ loading: loading }" 
          :disabled="loading || !message.trim()" 
          @click="performChat"
        >
          {{ loading ? 'Sending...' : 'Send' }}
        </button>
      </div>
    </div>
    <ApiProgress
      v-if="loading"
      title="正在发送对话"
      detail="消息已提交，正在等待模型生成回复"
    />
  </div>
</template>

<script setup lang="ts">
import { nextTick, onMounted, ref, watch } from 'vue';
import { searchWeb, textChat } from '../api/client';
import type { ChatMessage } from '../api/client';
import ApiProgress from './ApiProgress.vue';
import QuotaSummary from './QuotaSummary.vue';
import { readJsonStorage, removeStorage, writeJsonStorage } from '../utils/safeStorage';

type ConversationItem = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  raw?: unknown;
};

const CHAT_STORAGE_KEY = 'mmx_text_chat_messages';

const message = ref('');
const loading = ref(false);
const chatMessages = ref<ConversationItem[]>([]);
const conversationRef = ref<HTMLElement | null>(null);
const webSearchEnabled = ref(false);

const createMessageId = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;

const loadChatMessages = () => {
  const saved = readJsonStorage<ConversationItem[]>(
    CHAT_STORAGE_KEY,
    (value): value is ConversationItem[] => (
      Array.isArray(value)
      && value.every((item): item is ConversationItem => (
        item
        && (item.role === 'user' || item.role === 'assistant')
        && typeof item.content === 'string'
        && typeof item.id === 'string'
      ))
    ),
  );

  if (saved) {
    chatMessages.value = saved.map(normalizeStoredMessage);
  }
};

const toApiMessages = (items: ConversationItem[]): ChatMessage[] => (
  items.map((item) => ({
    role: item.role,
    content: item.content,
  }))
);

const toRecentApiMessages = (items: ConversationItem[], limit = 8): ChatMessage[] => (
  toApiMessages(items.slice(-limit))
);

const extractAssistantText = (data: any) => {
  if (data?.base_resp?.status_code && data.base_resp.status_code !== 0) {
    return `请求失败：${data.base_resp.status_msg || 'API returned an error'}`;
  }

  const choice = Array.isArray(data?.choices) ? data.choices[0] : null;
  const content = choice?.message?.content
    ?? choice?.messages?.[0]?.content
    ?? choice?.text
    ?? data?.reply
    ?? data?.text
    ?? data?.output_text
    ?? data?.data?.reply
    ?? data?.data?.text;

  if (typeof content === 'string' && content.trim()) {
    return content.trim();
  }

  if (data?.choices === null) {
    return '模型没有返回文本内容。';
  }

  return formatResult(data);
};

const normalizeStoredMessage = (item: ConversationItem): ConversationItem => {
  if (item.role !== 'assistant' || item.raw) {
    return item;
  }

  const parsed = parseJsonContent(item.content);
  if (!parsed) {
    return item;
  }

  return {
    ...item,
    content: extractAssistantText(parsed),
    raw: parsed,
  };
};

const parseJsonContent = (content: string) => {
  const trimmed = content.trim();
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
    return null;
  }

  try {
    return JSON.parse(trimmed);
  } catch {
    return null;
  }
};

const renderMarkdown = (content: string) => {
  const lines = content.split(/\r?\n/);
  const html: string[] = [];
  let paragraph: string[] = [];
  let listItems: string[] = [];
  let listTag: 'ul' | 'ol' | null = null;
  let codeLines: string[] = [];
  let inCodeBlock = false;

  const flushParagraph = () => {
    if (paragraph.length === 0) return;
    html.push(`<p>${renderInline(paragraph.join(' '))}</p>`);
    paragraph = [];
  };

  const flushList = () => {
    if (listItems.length === 0) return;
    html.push(`<${listTag || 'ul'}>${listItems.map(item => `<li>${renderInline(item)}</li>`).join('')}</${listTag || 'ul'}>`);
    listItems = [];
    listTag = null;
  };

  const flushCodeBlock = () => {
    html.push(`<pre><code>${escapeHtml(codeLines.join('\n'))}</code></pre>`);
    codeLines = [];
  };

  for (const line of lines) {
    if (line.trim().startsWith('```')) {
      if (inCodeBlock) {
        flushCodeBlock();
        inCodeBlock = false;
      } else {
        flushParagraph();
        flushList();
        inCodeBlock = true;
      }
      continue;
    }

    if (inCodeBlock) {
      codeLines.push(line);
      continue;
    }

    const trimmed = line.trim();
    if (!trimmed) {
      flushParagraph();
      flushList();
      continue;
    }

    const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      flushParagraph();
      flushList();
      const level = headingMatch[1].length;
      html.push(`<h${level}>${renderInline(headingMatch[2])}</h${level}>`);
      continue;
    }

    const unorderedListMatch = trimmed.match(/^[-*+]\s+(.+)$/);
    if (unorderedListMatch) {
      flushParagraph();
      if (listTag && listTag !== 'ul') flushList();
      listTag = 'ul';
      listItems.push(unorderedListMatch[1]);
      continue;
    }

    const orderedListMatch = trimmed.match(/^\d+[.)]\s+(.+)$/);
    if (orderedListMatch) {
      flushParagraph();
      if (listTag && listTag !== 'ol') flushList();
      listTag = 'ol';
      listItems.push(orderedListMatch[1]);
      continue;
    }

    flushList();
    paragraph.push(trimmed);
  }

  flushParagraph();
  flushList();
  if (inCodeBlock) {
    flushCodeBlock();
  }

  return html.join('');
};

const renderInline = (value: string) => {
  const escaped = escapeHtml(value);
  return escaped
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
    .replace(/`([^`]+)`/g, '<code>$1</code>');
};

const escapeHtml = (value: string) => (
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
);

const scrollToBottom = async () => {
  await nextTick();
  if (conversationRef.value) {
    conversationRef.value.scrollTop = conversationRef.value.scrollHeight;
  }
};

onMounted(() => {
  loadChatMessages();
  scrollToBottom();
});

watch(chatMessages, (items) => {
  if (items.length === 0) {
    removeStorage(CHAT_STORAGE_KEY);
    return;
  }

  writeJsonStorage(CHAT_STORAGE_KEY, items);
  scrollToBottom();
}, { deep: true });

const performChat = async () => {
  if (!message.value.trim() || loading.value) return;

  const userMessage: ConversationItem = {
    id: createMessageId(),
    role: 'user',
    content: message.value.trim(),
  };

  chatMessages.value.push(userMessage);
  message.value = '';
  loading.value = true;

  try {
    const res = webSearchEnabled.value
      ? await performSearchAugmentedChat()
      : await textChat(toApiMessages(chatMessages.value));
    chatMessages.value.push({
      id: createMessageId(),
      role: 'assistant',
      content: extractAssistantText(res),
      raw: res,
    });
  } catch (err: any) {
    chatMessages.value.push({
      id: createMessageId(),
      role: 'assistant',
      content: err?.message || '对话请求失败，请检查设置或稍后重试。',
    });
  } finally {
    loading.value = false;
  }
};

const performSearchAugmentedChat = async () => {
  const queryResult = await textChat([
    {
      role: 'system',
      content: [
        '你是搜索词生成器。根据当前日期和对话上下文，生成一个适合联网搜索的简短中文搜索词。',
        '只输出搜索词，不要解释，不要加引号。',
        `当前日期：${new Date().toLocaleDateString('zh-CN')}`,
      ].join('\n'),
    },
    ...toRecentApiMessages(chatMessages.value),
  ]);
  const query = sanitizeSearchQuery(extractAssistantText(queryResult));
  const searchResult = await searchWeb(query);
  const answerResult = await textChat([
    {
      role: 'system',
      content: [
        '你正在回答用户问题，并且已经拿到了联网搜索结果。',
        '请优先根据搜索结果回答；如果搜索结果不足，请说明不足，不要编造。',
        '回答要自然、直接。必要时注明信息来自搜索结果。',
        `搜索词：${query}`,
        `搜索结果：${summarizeSearchResult(searchResult)}`,
      ].join('\n\n'),
    },
    ...toRecentApiMessages(chatMessages.value),
  ]);

  return {
    ...answerResult,
    web_search: {
      query,
      result: searchResult,
    },
  };
};

const sanitizeSearchQuery = (value: string) => (
  value
    .replace(/^["“”'‘’]+|["“”'‘’]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120)
);

const summarizeSearchResult = (data: any) => {
  const organic = Array.isArray(data?.organic) ? data.organic.slice(0, 5) : [];
  if (organic.length > 0) {
    return organic.map((item: any, index: number) => [
      `${index + 1}. ${item.title || 'Untitled'}`,
      item.snippet ? `摘要：${item.snippet}` : '',
      item.link ? `链接：${item.link}` : '',
    ].filter(Boolean).join('\n')).join('\n\n');
  }

  return formatResult(data).slice(0, 6000);
};

const clearChat = () => {
  chatMessages.value = [];
  removeStorage(CHAT_STORAGE_KEY);
};

const formatResult = (data: any) => JSON.stringify(data, null, 2);
</script>

<style lang="less" scoped>
@import '../styles/panel.less';

.chat-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 22px;

  h2 {
    margin-bottom: 0;
  }
}

.clear-chat-btn {
  min-height: 38px;
  padding: 8px 14px;
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-sm);
  background: var(--control-bg);
  color: var(--text-secondary);
  cursor: pointer;
  font-size: 13px;
  font-weight: 700;
  transition: transform var(--motion-fast), border-color var(--motion-med), color var(--motion-med), background-color var(--motion-med);

  &:hover:not(:disabled) {
    transform: translateY(-1px);
    border-color: var(--accent-primary);
    color: var(--text-primary);
    background: var(--bg-surface);
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.48;
  }
}

.conversation {
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-height: 260px;
  max-height: min(56vh, 640px);
  margin: 22px 0;
  padding: 18px;
  overflow-y: auto;
  background: var(--control-bg);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-lg);
}

.empty-chat {
  display: flex;
  min-height: 220px;
  align-items: center;
  justify-content: center;
  text-align: center;
  color: var(--text-muted);
  font-size: 14px;
}

.chat-row {
  display: flex;

  &.user {
    justify-content: flex-end;

    .bubble {
      color: var(--text-on-accent);
      background: var(--accent-gradient);
      border-color: transparent;
      box-shadow: var(--shadow-accent);
    }

    .bubble-meta {
      color: rgba(255, 255, 255, 0.78);
    }
  }

  &.assistant {
    justify-content: flex-start;
  }
}

.bubble {
  width: fit-content;
  max-width: min(78%, 760px);
  padding: 12px 14px;
  background: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-sm);
}

.bubble-meta {
  margin-bottom: 5px;
  color: var(--text-muted);
  font-size: 12px;
  font-weight: 750;
}

.bubble-content {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  color: inherit;
  font-size: 14px;
  line-height: 1.65;
}

.markdown-content {
  white-space: normal;

  :deep(p) {
    margin: 0 0 12px;

    &:last-child {
      margin-bottom: 0;
    }
  }

  :deep(strong) {
    font-weight: 780;
  }

  :deep(h1),
  :deep(h2),
  :deep(h3),
  :deep(h4),
  :deep(h5),
  :deep(h6) {
    margin: 14px 0 8px;
    color: inherit;
    font-weight: 780;
    line-height: 1.35;

    &:first-child {
      margin-top: 0;
    }
  }

  :deep(h1) {
    font-size: 20px;
  }

  :deep(h2) {
    font-size: 18px;
  }

  :deep(h3) {
    font-size: 16px;
  }

  :deep(h4),
  :deep(h5),
  :deep(h6) {
    font-size: 15px;
  }

  :deep(ul),
  :deep(ol) {
    margin: 0 0 12px;
    padding-left: 20px;

    &:last-child {
      margin-bottom: 0;
    }
  }

  :deep(li + li) {
    margin-top: 6px;
  }

  :deep(a) {
    color: var(--accent-primary);
    font-weight: 700;
    text-decoration: underline;
    text-underline-offset: 2px;
  }

  :deep(code) {
    padding: 2px 5px;
    font-family: var(--font-mono);
    font-size: 0.92em;
    background: var(--bg-surface-active);
    border-radius: 5px;
  }

  :deep(pre) {
    margin: 0 0 12px;
    padding: 12px;
    overflow: auto;
    color: var(--text-primary);
    background: var(--bg-surface);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-sm);

    &:last-child {
      margin-bottom: 0;
    }

    code {
      padding: 0;
      background: transparent;
      border-radius: 0;
    }
  }
}

.raw-response {
  margin-top: 10px;
  color: var(--text-secondary);
  font-size: 12px;

  summary {
    cursor: pointer;
    font-weight: 700;
  }

  pre {
    margin-top: 8px;
    max-height: 260px;
    overflow: auto;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }
}

.chat-actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 14px;
  justify-content: flex-start;
}

.search-toggle {
  min-height: 46px;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: var(--text-secondary);
  font-size: 13px;
  font-weight: 700;

  input {
    width: 16px;
    height: 16px;
    accent-color: var(--accent-primary);
  }
}

.typing-indicator {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  min-height: 24px;

  span {
    width: 7px;
    height: 7px;
    border-radius: 999px;
    background: var(--accent-primary);
    animation: typing-pulse 900ms ease-in-out infinite;

    &:nth-child(2) {
      animation-delay: 120ms;
    }

    &:nth-child(3) {
      animation-delay: 240ms;
    }
  }
}

@keyframes typing-pulse {
  0%, 80%, 100% {
    opacity: 0.35;
    transform: translateY(0);
  }
  40% {
    opacity: 1;
    transform: translateY(-3px);
  }
}

@media (max-width: 700px) {
  .chat-heading {
    align-items: stretch;
    flex-direction: column;
  }

  .conversation {
    max-height: 58vh;
    padding: 14px;
  }

  .bubble {
    max-width: 92%;
  }
}
</style>
