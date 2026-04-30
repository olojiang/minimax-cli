<template>
  <div class="api-progress" role="status" aria-live="polite">
    <div class="progress-orb" aria-hidden="true"></div>
    <div class="progress-copy">
      <strong>{{ title }}</strong>
      <span>{{ detail }}</span>
    </div>
    <div class="progress-meter" aria-hidden="true">
      <span></span>
    </div>
  </div>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  title?: string;
  detail?: string;
}>(), {
  title: '正在调用 MiniMax API',
  detail: '请求已提交，正在等待服务返回结果'
});
</script>

<style lang="less" scoped>
.api-progress {
  position: relative;
  display: grid;
  grid-template-columns: 38px 1fr;
  gap: 12px;
  align-items: center;
  margin-top: 18px;
  padding: 14px;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-lg);
  background:
    linear-gradient(135deg, var(--accent-soft), transparent 62%),
    var(--control-bg);
  box-shadow: var(--shadow-sm);
  overflow: hidden;
  animation: progress-enter var(--motion-slow);

  .progress-orb {
    width: 38px;
    height: 38px;
    border-radius: 12px;
    background: var(--accent-gradient);
    box-shadow: var(--shadow-accent);
    position: relative;

    &::before,
    &::after {
      content: "";
      position: absolute;
      inset: 10px;
      border: 2px solid rgba(255, 255, 255, 0.7);
      border-left-color: transparent;
      border-radius: 50%;
      animation: spin 820ms linear infinite;
    }

    &::after {
      inset: 15px;
      border-width: 2px;
      animation-duration: 1200ms;
      animation-direction: reverse;
    }
  }

  .progress-copy {
    min-width: 0;

    strong,
    span {
      display: block;
    }

    strong {
      color: var(--text-primary);
      font-size: 14px;
      font-weight: 700;
    }

    span {
      margin-top: 2px;
      color: var(--text-secondary);
      font-size: 12px;
    }
  }

  .progress-meter {
    grid-column: 1 / -1;
    height: 3px;
    border-radius: 999px;
    background: var(--bg-surface-active);
    overflow: hidden;

    span {
      display: block;
      width: 44%;
      height: 100%;
      border-radius: inherit;
      background: var(--accent-gradient);
      animation: progress-sweep 1.25s ease-in-out infinite;
    }
  }
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

@keyframes progress-sweep {
  0% { transform: translateX(-105%); }
  55% { transform: translateX(90%); }
  100% { transform: translateX(245%); }
}

@keyframes progress-enter {
  from {
    opacity: 0;
    transform: translateY(8px) scale(0.985);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}
</style>
