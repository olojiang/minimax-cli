import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.minimax.ji',
  appName: 'Minimax 纪',
  webDir: 'dist',
  plugins: {
    CapacitorHttp: {
      enabled: true,
    },
  },
  android: {
    backgroundColor: '#f5f7fb',
  },
};

export default config;
