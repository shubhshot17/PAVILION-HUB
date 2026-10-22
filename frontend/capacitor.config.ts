import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.pavilionhub.app',
  appName: 'PAVILION HUB',
  // Vite outputs the built site to frontend/dist
  webDir: 'dist',
  // The backend URL is configured separately through VITE_API_URL.
  server: {
    androidScheme: 'https',
  },
};

export default config;
