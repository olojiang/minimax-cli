import { defineConfig } from 'vitest/config';
import { loadEnv } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [vue()],
    define: {
      'import.meta.env.MINIMAX_TOKEN': JSON.stringify(env.MINIMAX_TOKEN || '')
    },
    test: {
      environment: 'jsdom',
      include: ['src/**/*.spec.ts'],
      globals: true
    }
  };
});
