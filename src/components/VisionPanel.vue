<template>
  <div class="vision-panel panel">
    <h2>图像理解 (Vision)</h2>
    <QuotaSummary title="图像理解配额" :model-patterns="['coding-plan-vlm']" />
    <div class="input-group">
      <input 
        v-model="prompt" 
        class="prompt-input" 
        type="text" 
        placeholder="输入提示词，例如：请描述这张图" 
        :disabled="loading"
      />
      <div
        class="paste-dropzone"
        :class="{ active: selectedFile }"
        role="button"
        tabindex="0"
        :aria-label="selectedFile ? `已选择图片 ${selectedFile.name}` : '粘贴截图或选择图片'"
        @paste="onPasteImage"
      >
        <div>
          <strong>{{ selectedFile ? selectedFile.name : '粘贴截图' }}</strong>
          <span>{{ selectedFile ? '可以重新粘贴或重新选择文件' : '复制截图后点击这里，按 Ctrl/Cmd + V' }}</span>
        </div>
      </div>
      <input 
        class="file-input" 
        type="file" 
        accept="image/*" 
        @change="onFileChange" 
        :disabled="loading"
      />
      <button class="btn vision-btn" :class="{ loading: loading }" 
        @click="performVision" 
        :disabled="loading || !prompt.trim() || !selectedFile"
      >
        {{ loading ? 'Processing...' : 'Understand Image' }}
      </button>
    </div>
    <ApiProgress v-if="loading" title="正在解析图像" detail="图片与提示词已上传，正在调用视觉理解接口" />
    <p
      v-if="error"
      class="error-message"
      role="alert"
    >
      {{ error }}
    </p>
    
    <div v-if="previewUrl" class="image-preview">
      <img :src="previewUrl" alt="Preview" />
    </div>
    
    <div v-if="result" class="result-box">
      <div class="result-header">
        <h4>解析结果:</h4>
        <div class="view-toggle">
          <button :class="{ active: viewMode === 'readable' }" @click="viewMode = 'readable'">阅读</button>
          <button :class="{ active: viewMode === 'json' }" @click="viewMode = 'json'">JSON</button>
        </div>
      </div>
      <!-- eslint-disable vue/no-v-html -->
      <div
        v-if="viewMode === 'readable'"
        class="vision-readable markdown-content"
        v-html="renderMarkdown(readableResult)"
      />
      <!-- eslint-enable vue/no-v-html -->
      <pre v-else>{{ formatResult(result) }}</pre>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { understandImage, fileToDataUrl } from '../api/client';
import ApiProgress from './ApiProgress.vue';
import QuotaSummary from './QuotaSummary.vue';

const prompt = ref('');
const loading = ref(false);
const result = ref<any>(null);
const error = ref('');
const selectedFile = ref<File | null>(null);
const previewUrl = ref<string>('');
const viewMode = ref<'readable' | 'json'>('readable');

const setSelectedFile = async (file: File) => {
  selectedFile.value = file;
  previewUrl.value = await fileToDataUrl(file);
  error.value = '';
};

const onFileChange = async (event: Event) => {
  const target = event.target as HTMLInputElement;
  if (target.files && target.files.length > 0) {
    await setSelectedFile(target.files[0]);
  } else {
    selectedFile.value = null;
    previewUrl.value = '';
  }
};

const onPasteImage = async (event: ClipboardEvent) => {
  if (loading.value) return;

  const items = Array.from(event.clipboardData?.items || []);
  const imageItem = items.find(item => item.type.startsWith('image/'));
  const pastedFile = imageItem?.getAsFile();

  if (!pastedFile) {
    error.value = '剪贴板里没有图片，请先复制截图后再粘贴。';
    return;
  }

  event.preventDefault();
  const extension = pastedFile.type.split('/')[1] || 'png';
  const file = new File([pastedFile], `pasted-screenshot.${extension}`, {
    type: pastedFile.type,
    lastModified: Date.now(),
  });
  await setSelectedFile(file);
};

const performVision = async () => {
  if (!prompt.value.trim() || !selectedFile.value || loading.value) return;
  
  loading.value = true;
  result.value = null;
  error.value = '';
  
  try {
    const res = await understandImage(prompt.value, selectedFile.value);
    result.value = res;
    viewMode.value = 'readable';
  } catch (err) {
    error.value = err instanceof Error ? err.message : '图像理解失败，请检查设置或稍后重试。';
  } finally {
    loading.value = false;
  }
};

const formatResult = (data: any) => {
  return JSON.stringify(data, null, 2);
};

const readableResult = computed(() => extractVisionText(result.value));

const extractVisionText = (data: any): string => {
  if (typeof data === 'string') return data;

  const candidates = [
    data?.content,
    data?.text,
    data?.reply,
    data?.output_text,
    data?.data?.content,
    data?.data?.text,
    data?.data?.reply,
    data?.choices?.[0]?.message?.content,
    data?.choices?.[0]?.text,
  ];

  const text = candidates.find(value => typeof value === 'string' && value.trim());
  return text ? text.trim() : formatResult(data);
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
</script>

<style lang="less" scoped>
@import '../styles/panel.less';

.paste-dropzone {
  min-height: 72px;
  padding: 14px 16px;
  background: var(--control-bg);
  border: 1px dashed var(--border-strong);
  border-radius: var(--radius-md);
  color: var(--text-secondary);
  cursor: text;
  transition: transform var(--motion-fast), border-color var(--motion-med), box-shadow var(--motion-med), background-color var(--motion-med);

  strong,
  span {
    display: block;
  }

  strong {
    color: var(--text-primary);
    font-size: 14px;
    font-weight: 750;
    word-break: break-word;
  }

  span {
    margin-top: 4px;
    color: var(--text-muted);
    font-size: 13px;
  }

  &:hover,
  &:focus {
    outline: none;
    border-color: var(--accent-primary);
    box-shadow: var(--shadow-glow);
    background: var(--bg-surface);
    transform: translateY(-1px);
  }

  &.active {
    border-style: solid;
    border-color: var(--accent-primary);
    background: var(--accent-soft);
  }
}

.image-preview {
  margin-top: 24px;
  max-width: 200px;
  border: 1px solid var(--border-subtle);
  border-radius: 8px;
  padding: 4px;
  background-color: var(--bg-base);
  
  img {
    max-width: 100%;
    height: auto;
    display: block;
    border-radius: 4px;
  }
}

.result-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  margin-bottom: 16px;

  h4 {
    margin: 0;
  }
}

.view-toggle {
  display: flex;
  background: var(--control-bg);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  padding: 3px;

  button {
    min-height: 32px;
    padding: 4px 12px;
    background: transparent;
    border: none;
    border-radius: 7px;
    color: var(--text-secondary);
    cursor: pointer;
    font-size: 12px;
    transition: transform var(--motion-fast), background-color var(--motion-med), color var(--motion-med), box-shadow var(--motion-med);

    &.active {
      background: var(--bg-surface);
      color: var(--text-primary);
      box-shadow: var(--shadow-sm);
    }

    &:not(.active):hover {
      color: var(--text-primary);
      transform: translateY(-1px);
    }
  }
}

.vision-readable {
  padding: 14px;
  background: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  color: var(--text-primary);
  font-size: 14px;
  line-height: 1.7;
  overflow-wrap: anywhere;
}

.markdown-content {
  :deep(p) {
    margin: 0 0 12px;

    &:last-child {
      margin-bottom: 0;
    }
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

  :deep(strong) {
    font-weight: 780;
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

@media (max-width: 640px) {
  .result-header {
    align-items: stretch;
    flex-direction: column;

    .view-toggle {
      align-self: flex-start;
    }
  }
}
</style>
