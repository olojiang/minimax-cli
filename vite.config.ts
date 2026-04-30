import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [vue()],
    define: {
      'import.meta.env.MINIMAX_TOKEN': JSON.stringify(env.MINIMAX_TOKEN || '')
    },
    server: {
      proxy: {
        '/api': {
          target: 'https://api.minimaxi.com',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, '')
        }
      }
    }
  };
})
