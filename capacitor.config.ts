import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.marketalmacen.app',
  appName: 'Market Almacén',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
};

export default config;
